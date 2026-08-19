import { describe, expect, it } from "vitest";
import { MAX_PHASE_ITEMS, namePhase, sequenceItems } from "@/engine/sequence";
import type { CatalogItem, Skill } from "@/schemas";
import { authoredEdges } from "./helpers";

const skills: Skill[] = [
  { id: "js", name: "JavaScript", domain: "web-frontend", description: "x", levelBand: 1, prereqs: [] },
  { id: "react", name: "React", domain: "web-frontend", description: "x", levelBand: 2, prereqs: ["js"] },
  { id: "sql", name: "SQL", domain: "data-analysis", description: "x", levelBand: 1, prereqs: [] },
  { id: "a", name: "A", domain: "foundations", description: "x", levelBand: 1, prereqs: [] },
  { id: "b", name: "B", domain: "foundations", description: "x", levelBand: 1, prereqs: [] },
];
const edges = authoredEdges(skills);

function item(over: Partial<CatalogItem> & { id: string }): CatalogItem {
  return {
    kind: "course",
    title: over.id,
    provider: "P",
    url: `https://example.com/${over.id}`,
    description: "x",
    skillsTaught: [],
    skillsRequired: [],
    difficulty: 1,
    durationHours: 10,
    format: "video",
    cost: "free",
    qualityPrior: 0.5,
    ...over,
  };
}

describe("sequenceItems", () => {
  it("orders a teacher before the item that requires its skill and records the edge", () => {
    const b = item({ id: "react-course", skillsTaught: [{ skillId: "react", level: 2 }], skillsRequired: [{ skillId: "js", level: 1 }], difficulty: 1 });
    const a = item({ id: "js-course", skillsTaught: [{ skillId: "js", level: 2 }], difficulty: 3 });
    const res = sequenceItems([b, a], edges);
    expect(res.ordered.map((i) => i.id)).toEqual(["js-course", "react-course"]);
    expect(res.edges).toEqual([{ from: "js-course", to: "react-course", becauseSkill: "js", hard: true }]);
  });

  it("also orders by the skill DAG when requirements are not listed explicitly", () => {
    const react = item({ id: "react-course", skillsTaught: [{ skillId: "react", level: 2 }] });
    const js = item({ id: "js-course", skillsTaught: [{ skillId: "js", level: 2 }], difficulty: 5 });
    const res = sequenceItems([react, js], edges);
    expect(res.ordered.map((i) => i.id)).toEqual(["js-course", "react-course"]);
    expect(res.edges[0]).toMatchObject({ from: "js-course", to: "react-course", becauseSkill: "js" });
  });

  it("breaks ties by difficulty ascending, then duration ascending", () => {
    const items = [
      item({ id: "hard-short", difficulty: 3, durationHours: 2 }),
      item({ id: "easy-long", difficulty: 1, durationHours: 20 }),
      item({ id: "easy-short", difficulty: 1, durationHours: 5 }),
    ];
    expect(sequenceItems(items, edges).ordered.map((i) => i.id)).toEqual(["easy-short", "easy-long", "hard-short"]);
  });

  it("cuts phases at antichains of the induced order", () => {
    const items = [
      item({ id: "a", skillsTaught: [{ skillId: "a", level: 1 }] }),
      item({ id: "b", skillsTaught: [{ skillId: "b", level: 1 }] }),
      item({ id: "c", skillsRequired: [{ skillId: "a", level: 1 }] }),
      item({ id: "d", skillsRequired: [{ skillId: "a", level: 1 }, { skillId: "b", level: 1 }], skillsTaught: [{ skillId: "sql", level: 1 }] }),
      item({ id: "e", skillsRequired: [{ skillId: "sql", level: 1 }] }),
    ];
    const res = sequenceItems(items, edges);
    expect(res.phases.map((p) => p.map((i) => i.id))).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  it("splits an oversized antichain into consecutive phases", () => {
    const items = Array.from({ length: MAX_PHASE_ITEMS + 1 }, (_, i) => item({ id: `i${i}` }));
    const res = sequenceItems(items, edges);
    expect(res.phases).toHaveLength(2);
    expect(res.phases[0]).toHaveLength(MAX_PHASE_ITEMS);
  });

  it("does not order an item after one it also teaches the same skill to", () => {
    // Both teach js at different levels; the higher level should not create a back-edge.
    const intro = item({ id: "intro", skillsTaught: [{ skillId: "js", level: 1 }] });
    const adv = item({ id: "adv", skillsTaught: [{ skillId: "js", level: 2 }], skillsRequired: [{ skillId: "js", level: 1 }] });
    const res = sequenceItems([adv, intro], edges);
    expect(res.ordered.map((i) => i.id)).toEqual(["intro", "adv"]);
  });

  it("survives a requirement cycle and still returns every item once", () => {
    const x = item({ id: "x", skillsTaught: [{ skillId: "a", level: 1 }], skillsRequired: [{ skillId: "b", level: 1 }] });
    const y = item({ id: "y", skillsTaught: [{ skillId: "b", level: 1 }], skillsRequired: [{ skillId: "a", level: 1 }] });
    const res = sequenceItems([x, y], edges);
    expect(res.ordered.map((i) => i.id).sort()).toEqual(["x", "y"]);
  });

  it("breaks a cycle at a soft prerequisite edge before a hard requirement edge", () => {
    // stats teaches b, whose prereq a is taught by infer (soft edge infer→stats);
    // infer requires b (hard edge stats→infer); z requires b, so it must follow stats.
    const cycleSkills: Skill[] = [
      ...skills,
      { id: "c", name: "C", domain: "foundations", description: "x", levelBand: 2, prereqs: ["a"] },
    ];
    const stats = item({ id: "stats", skillsTaught: [{ skillId: "c", level: 2 }, { skillId: "b", level: 2 }], difficulty: 3 });
    const infer = item({ id: "infer", skillsTaught: [{ skillId: "a", level: 3 }], skillsRequired: [{ skillId: "b", level: 2 }], difficulty: 3 });
    const z = item({ id: "z", skillsRequired: [{ skillId: "b", level: 1 }], difficulty: 1 });
    const order = sequenceItems([z, infer, stats], authoredEdges(cycleSkills)).ordered.map((i) => i.id);
    expect(order.indexOf("stats")).toBeLessThan(order.indexOf("z"));
    expect(order.indexOf("stats")).toBeLessThan(order.indexOf("infer"));
  });

  it("is deterministic regardless of input order", () => {
    const items = [
      item({ id: "p", skillsTaught: [{ skillId: "js", level: 1 }] }),
      item({ id: "q", skillsTaught: [{ skillId: "sql", level: 1 }] }),
      item({ id: "r", skillsRequired: [{ skillId: "js", level: 1 }] }),
    ];
    const a = sequenceItems(items, edges).ordered.map((i) => i.id);
    const b = sequenceItems([...items].reverse(), edges).ordered.map((i) => i.id);
    expect(a).toEqual(b);
  });
});

describe("namePhase", () => {
  it("names the phase after its dominant domain with a numbered title and a milestone", () => {
    const items = [
      item({ id: "1", skillsTaught: [{ skillId: "js", level: 1 }, { skillId: "react", level: 1 }] }),
      item({ id: "2", skillsTaught: [{ skillId: "sql", level: 1 }] }),
    ];
    const { title, milestone } = namePhase(1, items, skills);
    expect(title).toMatch(/^Phase 2 — /);
    expect(title).toContain("Frontend");
    expect(milestone.length).toBeGreaterThan(10);
  });

  it("varies the title tier with the level being taught", () => {
    const low = namePhase(0, [item({ id: "1", skillsTaught: [{ skillId: "js", level: 1 }] })], skills).title;
    const high = namePhase(0, [item({ id: "1", skillsTaught: [{ skillId: "react", level: 3 }] })], skills).title;
    expect(low).not.toEqual(high);
  });
});

describe("assessments in sequencing", () => {
  it("never treats an assessment as the teacher of a skill", () => {
    const quiz = item({ id: "quiz", kind: "assessment", skillsTaught: [{ skillId: "js", level: 1 }] });
    const react = item({ id: "react", skillsTaught: [{ skillId: "react", level: 2 }], skillsRequired: [{ skillId: "js", level: 1 }] });
    const res = sequenceItems([quiz, react], edges);
    expect(res.edges).toEqual([]);
  });
});

describe("phase merging", () => {
  it("merges a one-item layer into the following layer when the result stays small", () => {
    // Chain a → b → c → d: four one-item antichains would read as four phases.
    const items = [
      item({ id: "a", skillsTaught: [{ skillId: "a", level: 1 }] }),
      item({ id: "b", skillsRequired: [{ skillId: "a", level: 1 }], skillsTaught: [{ skillId: "b", level: 1 }] }),
      item({ id: "c", skillsRequired: [{ skillId: "b", level: 1 }], skillsTaught: [{ skillId: "sql", level: 1 }] }),
      item({ id: "d", skillsRequired: [{ skillId: "sql", level: 1 }] }),
    ];
    const res = sequenceItems(items, edges);
    expect(res.ordered.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    expect(res.phases.length).toBeLessThan(4);
    for (const p of res.phases) expect(p.length).toBeLessThanOrEqual(MAX_PHASE_ITEMS);
  });

  it("keeps a full antichain as its own phase", () => {
    const items = [
      item({ id: "a", skillsTaught: [{ skillId: "a", level: 1 }] }),
      item({ id: "b", skillsTaught: [{ skillId: "b", level: 1 }] }),
      item({ id: "c", skillsRequired: [{ skillId: "a", level: 1 }] }),
      item({ id: "d", skillsRequired: [{ skillId: "b", level: 1 }] }),
    ];
    expect(sequenceItems(items, edges).phases.map((p) => p.map((i) => i.id))).toEqual([["a", "b"], ["c", "d"]]);
  });
});
