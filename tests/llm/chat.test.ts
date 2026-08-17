import { describe, expect, it } from "vitest";
import { MAX_TOOL_ITERATIONS, dedupeAgainstProfile, runChatTurn, type ChatEvent } from "@/llm/chat";
import { CHAT_SYSTEM_PROMPT } from "@/llm/prompts";
import { defaultProfile } from "@/engine/profile";
import { fakeClient, text, toolUse } from "./fakeClient";
import { memoryContext } from "./memoryContext";

async function run(script: Parameters<typeof fakeClient>[0], message = "I want to become a frontend developer") {
  const { client, requests } = fakeClient(script);
  const { ctx, state } = memoryContext();
  const events: ChatEvent[] = [];
  const result = await runChatTurn(client, ctx, { history: [], message }, (e) => events.push(e));
  return { events, result, state, requests };
}

describe("runChatTurn", () => {
  it("streams text, runs tools against the engine, and reports side effects as events", async () => {
    const { events, result, state, requests } = await run([
      {
        stop_reason: "tool_use",
        content: [
          text("Great goal."),
          toolUse("t1", "apply_profile_ops", {
            ops: [{ op: "add_goal", goal: { type: "role", templateId: "frontend-developer" } }],
          }),
          toolUse("t2", "generate_path", {}),
        ],
      },
      { stop_reason: "end_turn", content: [text("Here is your plan.")] },
    ]);
    expect(requests).toHaveLength(2);
    expect(result.text).toBe("Great goal.\n\nHere is your plan.");
    expect(result.calls).toBe(2);
    expect(state.profile.goals).toEqual([{ type: "role", templateId: "frontend-developer" }]);
    expect(state.paths).toHaveLength(1);

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("nova_state");
    expect(types).toContain("profile_updated");
    expect(types).toContain("path_updated");
    expect(types.at(-1)).toBe("done");
    const states = events.filter((e) => e.type === "nova_state").map((e) => e.state);
    expect(states).toEqual(["thinking", "speaking", "thinking", "celebrating", "speaking", "idle"]);
    expect(events.find((e) => e.type === "usage")).toMatchObject({ usage: { cacheReadInputTokens: 2000 } });

    // The second request carries the tool results for both calls in one user turn.
    const second = requests[1].messages.at(-1)!;
    expect(second.role).toBe("user");
    expect(Array.isArray(second.content) && second.content.length).toBe(2);
  });

  it("shows the intake card as a ui_card event and refuses it without a goal", async () => {
    const { events, state } = await run([
      {
        stop_reason: "tool_use",
        content: [
          toolUse("t1", "apply_profile_ops", { ops: [{ op: "add_goal", goal: { type: "role", templateId: "frontend-developer" } }] }),
          toolUse("t2", "propose_profile_card", {}),
        ],
      },
      { stop_reason: "end_turn", content: [text("Tick what you already know and I'll build from there.")] },
    ]);
    const card = events.find((e) => e.type === "ui_card");
    expect(card).toBeDefined();
    if (card?.type !== "ui_card") return;
    expect(card.card.goal).toEqual({ label: "Frontend Developer", templateId: "frontend-developer" });
    expect(card.card.skills.some((s) => s.skillId === "html")).toBe(true);
    expect(state.paths).toHaveLength(0);

    const { events: bare, requests } = await run([
      { stop_reason: "tool_use", content: [toolUse("t1", "propose_profile_card", {})] },
      { stop_reason: "end_turn", content: [text("ok")] },
    ]);
    expect(bare.some((e) => e.type === "ui_card")).toBe(false);
    const toolResult = requests[1].messages.at(-1)!.content as { is_error?: boolean }[];
    expect(toolResult[0].is_error).toBe(true);
  });

  it("uses the frozen system prompt with a cache breakpoint and a stable tool list", async () => {
    const { requests } = await run([{ stop_reason: "end_turn", content: [text("hi")] }], "hello");
    const system = requests[0].system as { text: string; cache_control?: unknown }[];
    expect(system[0].text).toBe(CHAT_SYSTEM_PROMPT);
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(requests[0].tools!.map((t) => t.name)).toEqual([
      "get_profile",
      "apply_profile_ops",
      "map_custom_goal",
      "generate_path",
      "replan_path",
      "explain_item",
      "search_catalog",
      "get_dashboard_summary",
      "propose_profile_card",
    ]);
    // Dynamic learner state lives in the message turn, not the system prompt.
    const user = requests[0].messages[0].content as string;
    expect(user).toContain("<learner_state>");
    expect(user.endsWith("hello")).toBe(true);
    expect(CHAT_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("returns tool errors to the model instead of throwing, then reconciles the profile structurally", async () => {
    const { requests, state, events } = await run([
      { stop_reason: "tool_use", content: [toolUse("t1", "generate_path", {})] },
      { stop_reason: "end_turn", content: [text("You need a goal first.")] },
    ]);
    const results = requests[1].messages.at(-1)!.content as { is_error: boolean; content: string }[];
    expect(results[0].is_error).toBe(true);
    expect(results[0].content).toContain("no goal");
    expect(state.paths).toHaveLength(0);
    // No apply_profile_ops happened and the message carried a goal, so extraction ran (empty here).
    expect(events.find((e) => e.type === "usage")).toMatchObject({ calls: 3 });
  });

  it("applies extracted ops when the model records nothing itself", async () => {
    const { client } = fakeClient([{ stop_reason: "end_turn", content: [text("Nice!")] }], {
      ops: [
        { op: "add_goal", goal: { type: "role", templateId: "data-analyst" } },
        { op: "set_skill", skillId: "python", level: 1, source: "stated" },
      ],
    });
    const { ctx, state } = memoryContext();
    const events: ChatEvent[] = [];
    await runChatTurn(client, ctx, { history: [], message: "I want to become a data analyst, I know a little python" }, (e) => events.push(e));
    expect(state.profile.goals).toEqual([{ type: "role", templateId: "data-analyst" }]);
    expect(state.profile.skills.python).toEqual({ level: 1, source: "stated" });
    expect(events.filter((e) => e.type === "profile_updated")).toHaveLength(1);
  });

  it("caps tool iterations per turn", async () => {
    const { requests, events } = await run(
      [{ stop_reason: "tool_use", content: [toolUse("t", "get_profile", {})] }],
      "keep looping",
    );
    expect(requests).toHaveLength(MAX_TOOL_ITERATIONS);
    expect(events.filter((e) => e.type === "text").at(-1)?.delta).toContain("ask me to continue");
  });
});

describe("dedupeAgainstProfile", () => {
  it("drops ops that would not change the profile", () => {
    const profile = {
      ...defaultProfile(),
      goals: [{ type: "role" as const, templateId: "data-analyst" }],
      skills: { python: { level: 2 as const, source: "stated" as const } },
    };
    const kept = dedupeAgainstProfile(
      [
        { op: "add_goal", goal: { type: "role", templateId: "data-analyst" } },
        { op: "add_goal", goal: { type: "role", templateId: "data-engineer" } },
        { op: "set_skill", skillId: "python", level: 2, source: "inferred" },
        { op: "set_skill", skillId: "python", level: 3, source: "stated" },
        { op: "set_skill", skillId: "sql", level: 0, source: "stated" },
        { op: "set_preference", key: "pace", value: "standard" },
        { op: "set_preference", key: "hoursPerWeek", value: 10 },
        { op: "remove_goal", index: 3 },
      ],
      profile,
    );
    expect(kept).toEqual([
      { op: "add_goal", goal: { type: "role", templateId: "data-engineer" } },
      { op: "set_skill", skillId: "python", level: 3, source: "stated" },
      { op: "set_preference", key: "hoursPerWeek", value: 10 },
    ]);
  });
});
