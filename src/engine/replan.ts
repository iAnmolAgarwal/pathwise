import type {
  CatalogItem,
  FeedbackEvent,
  Path,
  PathDiff,
  PathItemStatus,
  Profile,
  ProfileOp,
} from "../schemas";
import { computeGap, requiredSkillsForGoals } from "./gap";
import { generatePath, type Working } from "./index";
import { applyProfileOps } from "./profile";
import type { EngineData } from "./types";

type Level = 0 | 1 | 2 | 3;

/** When regeneration runs after a rule fires (§5.5, last column of the event table). */
export type ReplanPolicy = "always" | "if-shortcut" | "if-gap-changed";

export type RuleOutcome = {
  ops: ProfileOp[];
  statusUpdates: { catalogId: string; status: PathItemStatus }[];
  policy: ReplanPolicy;
  /** "You found X too hard" — the sentence the diff UI leads with. */
  cause: string;
};

export type ReplanContext = {
  profile: Profile;
  path: Path;
  data: EngineData;
  now: string;
  eventId: string;
};

export type ReplanResult = {
  ops: ProfileOp[];
  profile: Profile;
  path: Path;
  replanned: boolean;
  diff: PathDiff | null;
  cause: string;
  working: Working | null;
};

/** Quiz score (0–100) → level, in fixed bands so the mapping is inspectable. */
export function levelFromScore(score: number): Level {
  if (score >= 85) return 3;
  if (score >= 60) return 2;
  if (score >= 35) return 1;
  return 0;
}

const pathItems = (path: Path) => path.phases.flatMap((p) => p.items);

function itemOnPath(catalogId: string, path: Path, data: EngineData): CatalogItem {
  if (!pathItems(path).some((i) => i.catalogId === catalogId)) {
    throw new Error(`${catalogId} is not on the current path`);
  }
  const item = data.catalog.find((c) => c.id === catalogId);
  if (!item) throw new Error(`${catalogId} is not in the catalog`);
  return item;
}

const skillName = (id: string, data: EngineData) => data.skills.find((s) => s.id === id)?.name ?? id;
const level = (profile: Profile, skillId: string): Level => profile.skills[skillId]?.level ?? 0;

/**
 * The §5.5 event table, one branch per row. Pure: returns the ProfileOps to apply, the
 * item status changes, and whether regeneration should follow.
 */
export function feedbackRule(event: FeedbackEvent, profile: Profile, path: Path, data: EngineData): RuleOutcome {
  switch (event.type) {
    case "completed": {
      const item = itemOnPath(event.catalogId, path, data);
      const ops: ProfileOp[] = item.skillsTaught
        .filter((t) => t.level > level(profile, t.skillId))
        .map((t) => ({ op: "set_skill", skillId: t.skillId, level: t.level, source: "inferred" }));
      return {
        ops,
        statusUpdates: [{ catalogId: item.id, status: "done" }],
        policy: "if-shortcut",
        cause: `You completed ${item.title}`,
      };
    }
    case "too_hard": {
      const item = itemOnPath(event.catalogId, path, data);
      const ops: ProfileOp[] = item.skillsRequired
        .filter((r) => level(profile, r.skillId) > 0)
        .map((r) => ({
          op: "set_skill",
          skillId: r.skillId,
          level: (level(profile, r.skillId) - 1) as Level,
          source: "inferred",
        }));
      return { ops, statusUpdates: [], policy: "always", cause: `You found ${item.title} too hard` };
    }
    case "too_easy": {
      const item = itemOnPath(event.catalogId, path, data);
      const ops: ProfileOp[] = item.skillsTaught
        .filter((t) => level(profile, t.skillId) < 3)
        .map((t) => ({
          op: "set_skill",
          skillId: t.skillId,
          level: Math.min(3, Math.max(level(profile, t.skillId), t.level) + 1) as Level,
          source: "inferred",
        }));
      return {
        ops,
        statusUpdates: [{ catalogId: item.id, status: "skipped" }],
        policy: "always",
        cause: `You found ${item.title} too easy`,
      };
    }
    case "not_interested": {
      const item = itemOnPath(event.catalogId, path, data);
      return {
        ops: [{ op: "avoid", catalogId: item.id, provider: item.provider, format: item.format }],
        statusUpdates: [],
        policy: "always",
        cause: `You're not interested in ${item.title}`,
      };
    }
    case "quiz_result": {
      const skill = data.skills.find((s) => s.id === event.skillId);
      if (!skill) throw new Error(`${event.skillId} is not a known skill`);
      return {
        ops: [{ op: "set_skill", skillId: skill.id, level: levelFromScore(event.score), source: "assessed" }],
        statusUpdates: [],
        policy: "if-gap-changed",
        cause: `You scored ${Math.round(event.score)}% on the ${skill.name} check`,
      };
    }
  }
}

function withStatuses(path: Path, updates: RuleOutcome["statusUpdates"]): Path {
  const next = structuredClone(path);
  const byId = new Map(updates.map((u) => [u.catalogId, u.status]));
  for (const item of pathItems(next)) {
    const status = byId.get(item.catalogId);
    if (status) item.status = status;
  }
  return next;
}

const SETTLED: PathItemStatus[] = ["done", "skipped"];

/**
 * Regenerated paths only cover what is still open, so items the learner already finished
 * or skipped are carried over (with their evidence) into the same phase index they held.
 * Statuses of items present in both versions are preserved.
 */
function carryOver(previous: Path, next: Path): Path {
  const merged = structuredClone(next);
  const inNext = new Set(pathItems(merged).map((i) => i.catalogId));
  const previousStatus = new Map(pathItems(previous).map((i) => [i.catalogId, i.status]));
  for (const item of pathItems(merged)) {
    const status = previousStatus.get(item.catalogId);
    if (status && status !== "todo") item.status = status;
  }
  previous.phases.forEach((phase, index) => {
    const settled = phase.items.filter((i) => SETTLED.includes(i.status) && !inNext.has(i.catalogId));
    if (settled.length === 0) return;
    const target = merged.phases[Math.min(index, merged.phases.length - 1)];
    if (target) target.items.unshift(...structuredClone(settled));
    else merged.phases.push({ ...structuredClone(phase), items: structuredClone(settled) });
  });
  return merged;
}

export type DiffReasons = {
  added: (item: Path["phases"][number]["items"][number]) => string;
  removed: (catalogId: string) => string;
};

/** PathDiff (§4.2) over the open items of two path versions; done/skipped items are ignored. */
export function diffPaths(before: Path, after: Path, cause: PathDiff["cause"], reasons: DiffReasons): PathDiff {
  const open = (path: Path) => pathItems(path).filter((i) => !SETTLED.includes(i.status));
  const beforeIds = open(before).map((i) => i.catalogId);
  const afterItems = open(after);
  const afterIds = afterItems.map((i) => i.catalogId);
  // Membership counts every item whatever its status: finishing an item is not "removing" it.
  const beforeSet = new Set(pathItems(before).map((i) => i.catalogId));
  const afterSet = new Set(pathItems(after).map((i) => i.catalogId));
  const added = afterItems.filter((i) => !beforeSet.has(i.catalogId)).map((i) => ({ catalogId: i.catalogId, reason: reasons.added(i) }));
  const removed = beforeIds.filter((id) => !afterSet.has(id)).map((catalogId) => ({ catalogId, reason: reasons.removed(catalogId) }));
  const openAfter = new Set(afterIds);
  const openBefore = new Set(beforeIds);
  const commonBefore = beforeIds.filter((id) => openAfter.has(id));
  const commonAfter = afterIds.filter((id) => openBefore.has(id));
  const reordered = commonBefore.some((id, i) => id !== commonAfter[i]);
  return { added, removed, reordered, cause };
}

function gapSignature(profile: Profile, data: EngineData): string {
  const required = requiredSkillsForGoals(profile.goals, data.goals);
  return computeGap(profile, required, data.skillEdges)
    .map((g) => `${g.skillId}:${g.currentLevel}->${g.targetLevel}`)
    .sort()
    .join("|");
}

/**
 * Apply one feedback event (§5.5): rule → ops → mutated profile → regenerate when the
 * policy says so → PathDiff with a human-readable cause. Pure: inputs are not mutated.
 */
export function applyFeedback(event: FeedbackEvent, ctx: ReplanContext): ReplanResult {
  const rule = feedbackRule(event, ctx.profile, ctx.path, ctx.data);
  const profile = applyProfileOps(ctx.profile, rule.ops);
  const current = withStatuses(ctx.path, rule.statusUpdates);
  const cause = { eventId: ctx.eventId, humanReadable: rule.cause };
  const unchanged: ReplanResult = { ops: rule.ops, profile, path: current, replanned: false, diff: null, cause: rule.cause, working: null };

  if (rule.policy === "if-gap-changed" && gapSignature(ctx.profile, ctx.data) === gapSignature(profile, ctx.data)) {
    return unchanged;
  }
  if (profile.goals.length === 0) return unchanged;

  const spentHours = pathItems(current)
    .filter((i) => i.status === "done")
    .reduce((h, i) => h + (ctx.data.catalog.find((c) => c.id === i.catalogId)?.durationHours ?? 0), 0);
  const { path: regenerated, working } = generatePath(profile, ctx.data, { now: ctx.now, trigger: "replan", spentHours });
  const next = carryOver(current, regenerated);
  const diff = diffPaths(current, next, cause, diffReasons(event, rule, ctx.data));
  // A shortcut means something the learner still had to do is no longer needed; a mere
  // reshuffle or a refill of freed hours is not worth disturbing the plan they are following.
  const shortcut = diff.removed.length > 0;
  if (rule.policy === "if-shortcut" && !shortcut) return unchanged;
  return { ops: rule.ops, profile, path: next, replanned: true, diff, cause: rule.cause, working };
}

function diffReasons(event: FeedbackEvent, rule: RuleOutcome, data: EngineData): DiffReasons {
  const subject = "catalogId" in event ? (data.catalog.find((c) => c.id === event.catalogId)?.title ?? event.catalogId) : null;
  const removedWhy: Record<FeedbackEvent["type"], string> = {
    completed: `Not needed after what ${subject} taught you`,
    too_hard: "Made room for remediation first",
    too_easy: `Already covered — you found ${subject} easy`,
    not_interested: `No longer needed once ${subject} was replaced`,
    quiz_result: "Your check result already covers it",
  };
  const addedWhy: Record<FeedbackEvent["type"], string> = {
    completed: "Fits the plan now",
    too_hard: `Rebuilds what ${subject} assumed you knew`,
    too_easy: "Picks up where you are now",
    not_interested: `Replaces ${subject}`,
    quiz_result: "Matches your assessed level",
  };
  return {
    added: (item) => {
      const skills = item.evidence.gapSkillsCovered.map((g) => skillName(g.skillId, data));
      const closes = skills.length ? `closes ${skills.slice(0, 3).join(", ")}${skills.length > 3 ? "…" : ""}` : "";
      return [addedWhy[event.type], closes].filter(Boolean).join(" — ");
    },
    removed: (catalogId) =>
      event.type === "not_interested" && catalogId === event.catalogId ? rule.cause : removedWhy[event.type],
  };
}
