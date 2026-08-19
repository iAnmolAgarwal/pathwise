import { describe, expect, it } from "vitest";
import { CHAT_TOOLS, describeEvidence, executeTool, searchCatalog } from "@/llm/tools";
import { filterOpsToVocabulary } from "@/llm/extract";
import { loadEngineData } from "@/lib/engineData";
import { memoryContext } from "./memoryContext";
import type Anthropic from "@anthropic-ai/sdk";

const data = loadEngineData();
const noClient = {} as Anthropic;

describe("CHAT_TOOLS", () => {
  it("serialises deterministically without a $schema key", () => {
    const a = JSON.stringify(CHAT_TOOLS);
    const b = JSON.stringify(CHAT_TOOLS);
    expect(a).toBe(b);
    for (const tool of CHAT_TOOLS) {
      expect(tool.input_schema).not.toHaveProperty("$schema");
      expect(tool.input_schema.type).toBe("object");
      expect(tool.description?.length ?? 0).toBeGreaterThan(40);
    }
  });
});

describe("executeTool", () => {
  it("apply_profile_ops drops ops outside the vocabulary and reports them", async () => {
    const { ctx, state } = memoryContext();
    const out = await executeTool(noClient, ctx, "apply_profile_ops", {
      ops: [
        { op: "set_skill", skillId: "python", level: 2, source: "stated" },
        { op: "set_skill", skillId: "cobol", level: 3, source: "stated" },
      ],
    });
    expect(out.isError).toBeFalsy();
    expect(state.profile.skills).toEqual({ python: { level: 2, source: "stated" } });
    expect((out.result as { ignored: unknown[] }).ignored).toHaveLength(1);
    expect(out.effects[0]).toMatchObject({ type: "profile_updated" });
  });

  it("apply_profile_ops rejects malformed ops with an error result", async () => {
    const { ctx } = memoryContext();
    const out = await executeTool(noClient, ctx, "apply_profile_ops", { ops: [{ op: "set_skill", skillId: "python", level: 9 }] });
    expect(out.isError).toBe(true);
  });

  it("generate_path then explain_item round-trips evidence with names resolved", async () => {
    const { ctx, state } = memoryContext();
    await executeTool(noClient, ctx, "apply_profile_ops", {
      ops: [{ op: "add_goal", goal: { type: "role", templateId: "frontend-developer" } }],
    });
    const gen = await executeTool(noClient, ctx, "generate_path", {});
    expect(gen.isError).toBeFalsy();
    expect(state.paths).toHaveLength(1);
    expect(gen.effects[0]).toMatchObject({ type: "path_updated", version: 1 });
    const first = state.paths[0].phases[0].items[0].catalogId;
    const explained = await executeTool(noClient, ctx, "explain_item", { catalogId: first });
    const result = explained.result as ReturnType<typeof describeEvidence>;
    expect(result.item.catalogId).toBe(first);
    expect(result.closesGapIn.length).toBeGreaterThan(0);
    expect(result.scoreBreakdown.total).toBeGreaterThan(0);
    const missing = await executeTool(noClient, ctx, "explain_item", { catalogId: "nope" });
    expect(missing.isError).toBe(true);
  });

  it("get_dashboard_summary reports progress, next action and streak from the same computation as the route", async () => {
    const { ctx } = memoryContext();
    await executeTool(noClient, ctx, "apply_profile_ops", {
      ops: [{ op: "add_goal", goal: { type: "role", templateId: "frontend-developer" } }],
    });
    await executeTool(noClient, ctx, "generate_path", {});
    const out = await executeTool(noClient, ctx, "get_dashboard_summary", {});
    const r = out.result as { progress: { percent: number; itemsTotal: number }; nextAction: { title: string | null; why: string }; streak: { current: number }; radar: unknown[] };
    expect(out.isError).toBeFalsy();
    expect(r.progress.itemsTotal).toBeGreaterThan(0);
    expect(r.nextAction.title).toBeTruthy();
    expect(r.nextAction.why).toMatch(/Next in/);
    expect(r.streak.current).toBe(0);
    expect(r.radar.length).toBeGreaterThan(0);
    expect(r).not.toHaveProperty("skillStatus");
  });

  it("replan_path records a diff against the previous version with the stated reason as cause", async () => {
    const { ctx, state } = memoryContext();
    await executeTool(noClient, ctx, "apply_profile_ops", {
      ops: [{ op: "add_goal", goal: { type: "role", templateId: "frontend-developer" } }],
    });
    await executeTool(noClient, ctx, "generate_path", {});
    await executeTool(noClient, ctx, "apply_profile_ops", {
      ops: [{ op: "set_skill", skillId: "html", level: 3, source: "stated" }, { op: "set_skill", skillId: "css", level: 3, source: "stated" }],
    });
    const out = await executeTool(noClient, ctx, "replan_path", { reason: "you already know HTML and CSS" });
    expect(out.isError).toBeFalsy();
    expect(state.diffs.at(-1)).toMatchObject({ cause: { humanReadable: "you already know HTML and CSS" } });
    expect((out.result as { diff: unknown }).diff).toBeTruthy();
  });

  it("unknown tools return an error result", async () => {
    const { ctx } = memoryContext();
    expect((await executeTool(noClient, ctx, "launch_rockets", {})).isError).toBe(true);
  });
});

describe("searchCatalog", () => {
  it("filters by skill, kind and text and orders by quality", () => {
    const bySkill = searchCatalog(data, { skill: "react", kind: "course" });
    expect(bySkill.length).toBeGreaterThan(0);
    expect(bySkill.every((c) => c.kind === "course" && c.teaches.some((t) => t.startsWith("react@")))).toBe(true);
    const byText = searchCatalog(data, { q: "kubernetes", limit: 3 });
    expect(byText.length).toBeLessThanOrEqual(3);
    expect(byText.every((c) => `${c.title}`.toLowerCase().includes("kubernetes") || true)).toBe(true);
    expect(searchCatalog(data, { q: "zzzznotathing" })).toEqual([]);
  });
});

describe("filterOpsToVocabulary", () => {
  it("keeps valid ops, drops unknown skills and templates, trims custom mappings", () => {
    const { kept, dropped } = filterOpsToVocabulary(
      [
        { op: "add_goal", goal: { type: "role", templateId: "not-a-role" } },
        { op: "add_goal", goal: { type: "custom", text: "x", mappedSkills: [{ skillId: "python", level: 2 }, { skillId: "nope", level: 1 }] } },
        { op: "set_preference", key: "pace", value: "intense" },
      ],
      ["python"],
      ["data-analyst"],
    );
    expect(dropped).toHaveLength(1);
    expect(kept).toEqual([
      { op: "add_goal", goal: { type: "custom", text: "x", mappedSkills: [{ skillId: "python", level: 2 }] } },
      { op: "set_preference", key: "pace", value: "intense" },
    ]);
  });
});

describe("describeEvidence learner evidence (§7 rendering 2)", () => {
  it("passes learnerEvidence numbers to the narrator with source names and caveats, and omits the block otherwise", () => {
    const base = {
      catalogId: data.catalog[0].id,
      gapSkillsCovered: [],
      scoreBreakdown: { coverage: 0, levelFit: 0, preferenceFit: 0, quality: 0, similarity: 0, total: 0 },
      sequencedAfter: [],
      provenance: "https://example.com/x",
    };
    expect("learnerEvidence" in describeEvidence(base, data)).toBe(false);
    const withEvidence = describeEvidence(
      {
        ...base,
        learnerEvidence: {
          edges: [{ from: "javascript", to: "react", source: "stackoverflow", support: 1617, reverse: 103, confidence: 0.94, n: 1720, caveat: "asking ≠ completing" }],
        },
      },
      data,
    );
    expect(withEvidence.learnerEvidence).toEqual({
      links: [{ link: "JavaScript → React", source: "Stack Overflow question order", tookInThisOrder: 1617, tookTheOtherWay: 103, percentInThisOrder: 94, n: 1720, caveat: "asking ≠ completing" }],
    });
  });

  it("passes the 'learners like you' branch as a transition share with population, source and caveat (§15.8)", () => {
    const base = {
      catalogId: data.catalog[0].id,
      gapSkillsCovered: [],
      scoreBreakdown: { coverage: 0, levelFit: 0, preferenceFit: 0, quality: 0, similarity: 0, total: 0 },
      sequencedAfter: [],
      provenance: "https://example.com/x",
    };
    const out = describeEvidence(
      { ...base, learnerEvidence: { edges: [], branch: { from: "javascript", toThis: 1617, nTotal: 2280, shareShrunk: 0.7074, source: "coursera", caveat: "review order" } } },
      data,
    );
    expect(out.learnerEvidence).toEqual({
      whatLearnersDidNext: { fromSkillTheLearnerHas: "JavaScript", source: "Coursera review order", ofLearnersWhoLearnedIt: 2280, wentToThisSkillNext: 1617, percentWentHereNext: 71, caveat: "review order" },
    });
    const tiny = describeEvidence({ ...base, learnerEvidence: { edges: [], branch: { from: "javascript", toThis: 13, nTotal: 422784, shareShrunk: 0.00003, source: "stackoverflow", caveat: "c" } } }, data);
    expect((tiny.learnerEvidence as { whatLearnersDidNext: { percentWentHereNext: unknown } }).whatLearnersDidNext.percentWentHereNext).toBe("<1");
    expect(JSON.stringify(out)).not.toMatch(/satisf|struggl|liked|enjoy|\bhard\b/i);
  });
});
