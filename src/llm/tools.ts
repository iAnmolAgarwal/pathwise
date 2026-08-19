import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { generatePath } from "@/engine";
import type { DashboardSummary } from "@/engine/dashboard";
import { diffPaths } from "@/engine/replan";
import { applyProfileOps } from "@/engine/profile";
import type { EngineData } from "@/engine/types";
import {
  CatalogKindSchema,
  DomainSchema,
  ChatProfileOpSchema,
  type Evidence,
  type Path,
  type PathDiff,
  type Profile,
  type ProfileOp,
} from "@/schemas";
import { buildProfileCard } from "@/lib/profileCard";
import type { ProfileCard } from "@/schemas/profileCard";
import { mapCustomGoal } from "./mapGoal";
import { filterOpsToVocabulary } from "./extract";

/**
 * The assistant's tools are the engine (§8.3), exposed read/write-through-ops only.
 * Persistence is injected by the route handler so this module never touches the DB.
 */
export interface ChatContext {
  learnerId: string;
  data: EngineData;
  getProfile(): Promise<Profile>;
  saveProfile(profile: Profile): Promise<void>;
  getLatestPath(): Promise<{ version: number; path: Path } | null>;
  savePath(path: Path, diff: PathDiff | null): Promise<{ version: number }>;
  /** Same computation as /api/dashboard (§8.3). */
  dashboardSummary(): Promise<DashboardSummary>;
  now(): Date;
}

export type ToolSideEffect =
  | { type: "profile_updated"; profile: Profile; ops: ProfileOp[] }
  | { type: "path_updated"; version: number; path: Path; diff: PathDiff | null }
  | { type: "ui_card"; card: ProfileCard };

export type ToolOutcome = {
  result: unknown;
  isError?: boolean;
  effects: ToolSideEffect[];
  usage?: Anthropic.Usage;
};

const Empty = z.object({});
const ApplyOpsInput = z.object({ ops: z.array(ChatProfileOpSchema).min(1).max(50) });
const MapGoalInput = z.object({ text: z.string().min(1) });
const ReplanInput = z.object({ reason: z.string().min(1) });
const ExplainInput = z.object({ catalogId: z.string().min(1) });
const SearchInput = z.object({
  q: z.string().optional(),
  skill: z.string().optional(),
  domain: DomainSchema.optional(),
  kind: CatalogKindSchema.optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

function inputSchema(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const json = z.toJSONSchema(schema, { reused: "inline" }) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Tool.InputSchema;
}

/** Deterministic order and content: the tool list is part of the cached prefix (§8.2). */
export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_profile",
    description:
      "Read the learner's current profile: goals, recorded skill levels with their source, and preferences. Call this when you need exact current values before changing them (for example the index of a goal to remove).",
    input_schema: inputSchema(Empty),
  },
  {
    name: "apply_profile_ops",
    description:
      "Record facts about the learner by applying profile operations; the application is deterministic and validated. Use add_goal (type role with a templateId, or type custom with text and mappedSkills from map_custom_goal), remove_goal (by index from get_profile), set_skill (skillId from the vocabulary, level 0-3, source stated or inferred), and set_preference (hoursPerWeek, formats, budget, pace). Call this as soon as the learner tells you something about their goal, skills, or preferences. Returns the updated profile.",
    input_schema: inputSchema(ApplyOpsInput),
  },
  {
    name: "map_custom_goal",
    description:
      "Map a goal described in the learner's own words onto the closed skill vocabulary. Call this when the goal is not clearly one of the role templates. Returns the mapped skills with target levels and, if the goal is really a role template in disguise, its templateId; then record the goal with apply_profile_ops.",
    input_schema: inputSchema(MapGoalInput),
  },
  {
    name: "generate_path",
    description:
      "Run the recommendation engine against the current profile and save a new learning path. Call this once the profile has at least one goal. Returns a summary of the phases, milestones and items with hours. Fails if there is no goal.",
    input_schema: inputSchema(Empty),
  },
  {
    name: "replan_path",
    description:
      "Regenerate the learning path after the profile changed (new or removed goal, changed skill levels, hours, budget or pace). Give the reason in the learner's terms. Returns the new path summary.",
    input_schema: inputSchema(ReplanInput),
  },
  {
    name: "explain_item",
    description:
      "Fetch the evidence behind one item on the current path: which gap skills it closes and why they matter for the goal, what it is sequenced after, and its score breakdown. Call this when the learner asks why something is on their path or what an item is for, and explain using only what it returns.",
    input_schema: inputSchema(ExplainInput),
  },
  {
    name: "search_catalog",
    description:
      "Search the curated catalog of courses, projects and assessments by free text, skill id, domain, or kind. Call this when the learner asks whether there is a course on a topic, or wants alternatives. Returns up to 20 items with title, provider, kind, hours, cost, and skills taught.",
    input_schema: inputSchema(SearchInput),
  },
  {
    name: "get_dashboard_summary",
    description:
      "Summarise the learner's progress: items done versus planned, skills recorded, and the next best action. Call this for progress or 'what should I do next' questions.",
    input_schema: inputSchema(Empty),
  },
  {
    name: "propose_profile_card",
    description:
      "Show the learner an interactive check-in card inside the chat: the skills their goal needs (with a level chooser for each) plus hours per week, pace, budget and formats. Call this right after recording a goal when the learner has stated no skills yet, instead of generate_path, and then end your turn with one short sentence inviting them to fill it in. Their answer arrives as their next message; generate the path then. Do not call it if they already told you what they know.",
    input_schema: inputSchema(Empty),
  },
];

export async function executeTool(
  client: Anthropic,
  ctx: ChatContext,
  name: string,
  rawInput: unknown,
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "get_profile":
        return { result: await ctx.getProfile(), effects: [] };
      case "apply_profile_ops":
        return applyOps(ctx, ApplyOpsInput.parse(rawInput).ops);
      case "map_custom_goal":
        return mapGoal(client, ctx, MapGoalInput.parse(rawInput).text);
      case "generate_path":
        return regenerate(ctx, "initial");
      case "replan_path":
        return regenerate(ctx, "replan", ReplanInput.parse(rawInput).reason);
      case "explain_item":
        return explainItem(ctx, ExplainInput.parse(rawInput).catalogId);
      case "search_catalog":
        return { result: searchCatalog(ctx.data, SearchInput.parse(rawInput)), effects: [] };
      case "get_dashboard_summary": {
        // Skill-by-skill status is for the graph; the assistant gets the readable parts.
        const { skillStatus: _skillStatus, gap, ...summary } = await ctx.dashboardSummary();
        void _skillStatus;
        const skillName = (id: string) => ctx.data.skills.find((s) => s.id === id)?.name ?? id;
        return { result: { ...summary, openGap: gap.map((g) => `${skillName(g.skillId)} ${g.currentLevel}→${g.targetLevel}`) }, effects: [] };
      }
      case "propose_profile_card":
        return proposeCard(ctx);
      default:
        return { result: { error: `Unknown tool ${name}` }, isError: true, effects: [] };
    }
  } catch (err) {
    const message = err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : String(err);
    return { result: { error: message }, isError: true, effects: [] };
  }
}

async function proposeCard(ctx: ChatContext): Promise<ToolOutcome> {
  const profile = await ctx.getProfile();
  const card = buildProfileCard(`card-${ctx.now().getTime().toString(36)}`, profile, ctx.data);
  if ("error" in card) return { result: card, isError: true, effects: [] };
  return {
    result: { shown: true, goal: card.goal.label, skills: card.skills.length, note: "The card is on screen. End the turn with one inviting sentence; the answer arrives as the learner's next message." },
    effects: [{ type: "ui_card", card }],
  };
}

async function applyOps(ctx: ChatContext, ops: ProfileOp[]): Promise<ToolOutcome> {
  const skillIds = ctx.data.skills.map((s) => s.id);
  const templateIds = ctx.data.goals.map((g) => g.id);
  const { kept, dropped } = filterOpsToVocabulary(ops, skillIds, templateIds);
  const current = await ctx.getProfile();
  const next = applyProfileOps(current, kept);
  await ctx.saveProfile(next);
  return {
    result: {
      profile: next,
      applied: kept.length,
      ignored: dropped.map((op) => ({ op, reason: "unknown skill or template id" })),
    },
    effects: kept.length ? [{ type: "profile_updated", profile: next, ops: kept }] : [],
  };
}

async function mapGoal(client: Anthropic, ctx: ChatContext, text: string): Promise<ToolOutcome> {
  const { goal, usage } = await mapCustomGoal(client, {
    text,
    skillIds: ctx.data.skills.map((s) => s.id),
    templateIds: ctx.data.goals.map((g) => g.id),
  });
  return { result: goal, effects: [], usage };
}

async function regenerate(ctx: ChatContext, trigger: Path["meta"]["trigger"], reason?: string): Promise<ToolOutcome> {
  const profile = await ctx.getProfile();
  if (profile.goals.length === 0) {
    return { result: { error: "The profile has no goal yet; record one with apply_profile_ops first." }, isError: true, effects: [] };
  }
  const previous = await ctx.getLatestPath();
  const { path, working } = generatePath(profile, ctx.data, {
    now: ctx.now().toISOString(),
    trigger: previous ? "replan" : trigger,
  });
  const catalog = new Map(ctx.data.catalog.map((c) => [c.id, c]));
  const skillName = (id: string) => ctx.data.skills.find((s) => s.id === id)?.name ?? id;
  const diff =
    previous && reason
      ? diffPaths(previous.path, path, { eventId: `chat:v${previous.version}`, humanReadable: reason }, {
          added: (item) => `Closes ${item.evidence.gapSkillsCovered.map((g) => skillName(g.skillId)).slice(0, 3).join(", ") || "a requirement"}`,
          removed: () => "No longer needed after the profile changed",
        })
      : null;
  const saved = await ctx.savePath(path, diff);
  const summary = {
    version: saved.version,
    reason: reason ?? null,
    diff: diff && {
      added: diff.added.map((d) => `${catalog.get(d.catalogId)?.title ?? d.catalogId} — ${d.reason}`),
      removed: diff.removed.map((d) => `${catalog.get(d.catalogId)?.title ?? d.catalogId} — ${d.reason}`),
      reordered: diff.reordered,
    },
    budgetHours: working.budgetHours,
    plannedHours: working.usedHours,
    stoppedBecause: working.stoppedBecause,
    stillUncovered: working.uncovered.map((u) => u.skillId),
    phases: path.phases.map((p) => ({
      title: p.title,
      milestone: p.milestone,
      items: p.items.map((it) => {
        const c = catalog.get(it.catalogId);
        return { catalogId: it.catalogId, title: c?.title, kind: c?.kind, provider: c?.provider, hours: c?.durationHours };
      }),
    })),
  };
  return { result: summary, effects: [{ type: "path_updated", version: saved.version, path, diff }] };
}

export function describeEvidence(evidence: Evidence, data: EngineData) {
  const skillName = (id: string) => data.skills.find((s) => s.id === id)?.name ?? id;
  const catalog = new Map(data.catalog.map((c) => [c.id, c]));
  const item = catalog.get(evidence.catalogId);
  return {
    item: item ? { catalogId: item.id, title: item.title, provider: item.provider, kind: item.kind, hours: item.durationHours, difficulty: item.difficulty, url: item.url } : { catalogId: evidence.catalogId },
    closesGapIn: evidence.gapSkillsCovered.map((g) => ({
      skill: skillName(g.skillId),
      why: g.reason === "goal" ? "required by the goal" : `prerequisite of ${skillName(g.reason.replace("prereq-of:", ""))}`,
      graphPath: g.graphPath.map(skillName),
    })),
    sequencedAfter: evidence.sequencedAfter.map((s) => ({
      title: catalog.get(s.catalogId)?.title ?? s.catalogId,
      becauseSkill: skillName(s.becauseSkill),
    })),
    scoreBreakdown: evidence.scoreBreakdown,
    // Learner-sequence numbers travel with the source name and caveat; the prompt allows
    // citing numbers from this block only (§7 rendering 2, §8.2, §15.8).
    ...(evidence.learnerEvidence ? { learnerEvidence: describeLearnerEvidence(evidence.learnerEvidence, skillName) } : {}),
  };
}

const SOURCE_PHRASE = { stackoverflow: "Stack Overflow question order", coursera: "Coursera review order" } as const;

function describeLearnerEvidence(le: NonNullable<Evidence["learnerEvidence"]>, skillName: (id: string) => string) {
  const links = le.edges.map((e) => ({
    link: `${skillName(e.from)} → ${skillName(e.to)}`,
    source: SOURCE_PHRASE[e.source],
    tookInThisOrder: e.support,
    tookTheOtherWay: e.reverse,
    percentInThisOrder: Math.round(e.confidence * 100),
    n: e.n,
    caveat: e.caveat,
  }));
  const b = le.branch;
  const pct = b ? Math.round(b.shareShrunk * 100) : 0;
  return {
    ...(links.length > 0 ? { links } : {}),
    // "Learners like you": a transition share from a skill the learner has into this item's
    // primary skill — what learners did next, never how they felt about it (N-5).
    ...(b
      ? {
          whatLearnersDidNext: {
            fromSkillTheLearnerHas: skillName(b.from),
            source: SOURCE_PHRASE[b.source],
            ofLearnersWhoLearnedIt: b.nTotal,
            wentToThisSkillNext: b.toThis,
            percentWentHereNext: pct === 0 ? "<1" : pct,
            caveat: b.caveat,
          },
        }
      : {}),
  };
}

async function explainItem(ctx: ChatContext, catalogId: string): Promise<ToolOutcome> {
  const latest = await ctx.getLatestPath();
  if (!latest) return { result: { error: "No path has been generated yet." }, isError: true, effects: [] };
  const item = latest.path.phases.flatMap((p) => p.items).find((it) => it.catalogId === catalogId);
  if (!item) return { result: { error: `${catalogId} is not on the current path.` }, isError: true, effects: [] };
  return { result: describeEvidence(item.evidence, ctx.data), effects: [] };
}

export function searchCatalog(data: EngineData, input: z.infer<typeof SearchInput>) {
  const q = input.q?.trim().toLowerCase();
  const domainSkills = input.domain ? new Set(data.skills.filter((s) => s.domain === input.domain).map((s) => s.id)) : null;
  const matches = data.catalog.filter((c) => {
    if (input.kind && c.kind !== input.kind) return false;
    if (input.skill && !c.skillsTaught.some((s) => s.skillId === input.skill)) return false;
    if (domainSkills && !c.skillsTaught.some((s) => domainSkills.has(s.skillId))) return false;
    if (q && !`${c.title} ${c.provider} ${c.description}`.toLowerCase().includes(q)) return false;
    return true;
  });
  return matches
    .sort((a, b) => b.qualityPrior - a.qualityPrior)
    .slice(0, input.limit ?? 8)
    .map((c) => ({
      catalogId: c.id,
      title: c.title,
      provider: c.provider,
      kind: c.kind,
      hours: c.durationHours,
      cost: c.cost,
      difficulty: c.difficulty,
      url: c.url,
      teaches: c.skillsTaught.map((s) => `${s.skillId}@${s.level}`),
    }));
}
