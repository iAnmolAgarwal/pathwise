import type Anthropic from "@anthropic-ai/sdk";
import type { Path, Profile, ProfileOp } from "@/schemas";
import { applyProfileOps } from "@/engine/profile";
import { EFFORT, MAX_TOKENS, MODEL } from "./client";
import { summarizePath, summarizeProfile } from "./context";
import { extractProfileOps } from "./extract";
import { addUsage, classifyLlmError, emptyUsage, type Degradation, type UsageTotals } from "./judgeMode";
import { mapCustomGoal } from "./mapGoal";
import { CHAT_SYSTEM_PROMPT } from "./prompts";
import { CHAT_TOOLS, executeTool, type ChatContext, type ToolSideEffect } from "./tools";

/** Cap on model calls per learner turn (§8.3). */
export const MAX_TOOL_ITERATIONS = 6;

export type NovaState = "idle" | "listening" | "thinking" | "speaking" | "celebrating" | "resting";

/** Events the SSE handler forwards to the client, one JSON object each. */
export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "nova_state"; state: NovaState }
  | { type: "tool_call"; name: string; status: "start" | "done" | "error" }
  | { type: "profile_updated"; profile: Profile; ops: ProfileOp[] }
  | { type: "path_updated"; version: number; path: Path }
  | { type: "usage"; usage: UsageTotals; calls: number }
  | { type: "degraded"; degradation: Degradation }
  | { type: "done"; text: string };

export type ChatTurnResult = {
  text: string;
  usage: UsageTotals;
  calls: number;
  degradation: Degradation | null;
};

/** Cheap gate for the post-turn extraction pass: only messages that smell like profile facts. */
const PROFILE_SIGNAL =
  /\b(i know|i am|i'm|i've|i have|i work|i worked|years?|hours?|week|free|budget|paid|goal|want to|wanna|become|learn|experience|beginner|intermediate|advanced|prefer|videos?|reading|hands-on|project|degree|student|job|pace|fast|slow|relaxed|intense)\b/i;

/**
 * One learner turn: stream the model, run its tools against the engine, repeat until it
 * stops or the iteration cap hits, then reconcile the profile with a structured extraction
 * pass if the model talked but never recorded anything. All persistence goes through ctx.
 */
export async function runChatTurn(
  client: Anthropic,
  ctx: ChatContext,
  input: { history: Anthropic.MessageParam[]; message: string },
  emit: (event: ChatEvent) => void,
): Promise<ChatTurnResult> {
  const skillNames = Object.fromEntries(ctx.data.skills.map((s) => [s.id, s.name]));
  const templateTitles = Object.fromEntries(ctx.data.goals.map((g) => [g.id, g.title]));
  const catalog = new Map(ctx.data.catalog.map((c) => [c.id, c]));

  const profile = await ctx.getProfile();
  const latest = await ctx.getLatestPath();
  const context = [
    "<learner_state>",
    summarizeProfile(profile, skillNames, templateTitles),
    latest ? summarizePath(latest.path, latest.version, catalog) : "Path: none generated yet.",
    "</learner_state>",
  ].join("\n");

  const messages: Anthropic.MessageParam[] = [
    ...input.history,
    { role: "user", content: `${context}\n\n${input.message}` },
  ];
  const effort = latest ? EFFORT.pathContext : EFFORT.chat;

  let usage = emptyUsage();
  let calls = 0;
  let text = "";
  let appliedOps = false;
  let spoke = false;
  const parts: string[] = [];

  emit({ type: "nova_state", state: "thinking" });
  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS.chat,
        output_config: { effort },
        system: [{ type: "text", text: CHAT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: CHAT_TOOLS,
        messages,
      });
      let chunk = "";
      stream.on("text", (delta) => {
        if (!spoke) {
          spoke = true;
          emit({ type: "nova_state", state: "speaking" });
        }
        chunk += delta;
        emit({ type: "text", delta });
      });
      const final = await stream.finalMessage();
      calls += 1;
      usage = addUsage(usage, final.usage);
      if (chunk) parts.push(chunk);
      messages.push({ role: "assistant", content: final.content });

      if (final.stop_reason === "refusal") {
        emit({ type: "text", delta: "I can't help with that one, but I'm happy to keep working on your learning plan." });
        break;
      }
      if (final.stop_reason === "max_tokens") {
        emit({ type: "text", delta: " …" });
        break;
      }
      if (final.stop_reason !== "tool_use") break;

      const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) break;
      if (spoke) emit({ type: "nova_state", state: "thinking" });
      spoke = false;
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        emit({ type: "tool_call", name: use.name, status: "start" });
        const outcome = await executeTool(client, ctx, use.name, use.input);
        if (outcome.usage) usage = addUsage(usage, outcome.usage);
        if (use.name === "apply_profile_ops" && !outcome.isError) appliedOps = true;
        emitEffects(outcome.effects, emit);
        emit({ type: "tool_call", name: use.name, status: outcome.isError ? "error" : "done" });
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify(outcome.result),
          is_error: outcome.isError ?? false,
        });
      }
      messages.push({ role: "user", content: results });
      if (iteration === MAX_TOOL_ITERATIONS - 1) {
        emit({ type: "text", delta: "I've done what I can this turn — ask me to continue if there's more." });
      }
    }
    text = parts.join("\n\n").trim();

    // Safety net: the model answered but recorded nothing, yet the message looks like it
    // carried profile facts. Extract them structurally and apply deterministically.
    if (!appliedOps && input.message.length >= 20 && PROFILE_SIGNAL.test(input.message)) {
      const outcome = await reconcileProfile(client, ctx, input.message, skillNames, templateTitles);
      usage = addUsage(usage, outcome.usage);
      calls += outcome.calls;
      if (outcome.effect) emitEffects([outcome.effect], emit);
    }
    emit({ type: "usage", usage, calls });
    emit({ type: "nova_state", state: "idle" });
    emit({ type: "done", text });
    return { text, usage, calls, degradation: null };
  } catch (err) {
    const degradation = classifyLlmError(err);
    if (!degradation) throw err;
    text = parts.join("\n\n").trim();
    emit({ type: "degraded", degradation });
    emit({ type: "usage", usage, calls });
    emit({ type: "nova_state", state: "resting" });
    emit({ type: "done", text });
    return { text, usage, calls, degradation };
  }
}

function emitEffects(effects: ToolSideEffect[], emit: (event: ChatEvent) => void) {
  for (const effect of effects) {
    if (effect.type === "profile_updated") emit({ type: "profile_updated", profile: effect.profile, ops: effect.ops });
    if (effect.type === "path_updated") {
      emit({ type: "path_updated", version: effect.version, path: effect.path });
      emit({ type: "nova_state", state: "celebrating" });
    }
  }
}

async function reconcileProfile(
  client: Anthropic,
  ctx: ChatContext,
  message: string,
  skillNames: Record<string, string>,
  templateTitles: Record<string, string>,
): Promise<{ effect: ToolSideEffect | null; usage: UsageTotals; calls: number }> {
  const skillIds = ctx.data.skills.map((s) => s.id);
  const templateIds = ctx.data.goals.map((g) => g.id);
  const before = await ctx.getProfile();
  let usage = emptyUsage();
  let calls = 1;
  const extracted = await extractProfileOps(client, { message, profile: before, skillIds, templateIds, skillNames, templateTitles });
  usage = addUsage(usage, extracted.usage);
  const ops: ProfileOp[] = [];
  for (const op of dedupeAgainstProfile(extracted.ops, before)) {
    if (op.op === "add_goal" && op.goal.type === "custom" && op.goal.mappedSkills.length === 0) {
      calls += 1;
      const mapped = await mapCustomGoal(client, { text: op.goal.text, skillIds, templateIds });
      usage = addUsage(usage, mapped.usage);
      ops.push(
        mapped.goal.matchesTemplateId
          ? { op: "add_goal", goal: { type: "role", templateId: mapped.goal.matchesTemplateId } }
          : { op: "add_goal", goal: { type: "custom", text: op.goal.text, mappedSkills: mapped.goal.mappedSkills } },
      );
    } else ops.push(op);
  }
  if (ops.length === 0) return { effect: null, usage, calls };
  const next = applyProfileOps(before, ops);
  await ctx.saveProfile(next);
  return { effect: { type: "profile_updated", profile: next, ops }, usage, calls };
}

/** Pure: drop ops that would not change the profile (same skill level, duplicate goal, same preference). */
export function dedupeAgainstProfile(ops: ProfileOp[], profile: Profile): ProfileOp[] {
  return ops.filter((op) => {
    switch (op.op) {
      case "set_skill": {
        const existing = profile.skills[op.skillId];
        if (op.level === 0) return existing !== undefined;
        return !existing || existing.level !== op.level;
      }
      case "add_goal":
        return !profile.goals.some((g) =>
          op.goal.type === "role"
            ? g.type === "role" && g.templateId === op.goal.templateId
            : g.type === "custom" && g.text.trim().toLowerCase() === op.goal.text.trim().toLowerCase(),
        );
      case "set_preference":
        return JSON.stringify(profile.preferences[op.key]) !== JSON.stringify(op.value);
      case "remove_goal":
        return op.index < profile.goals.length;
    }
  });
}
