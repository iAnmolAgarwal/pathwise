import { describe, expect, it } from "vitest";
import { scoreCandidates } from "@/engine/score";
import {
  EXTRAS_BUDGET_SHARE,
  PACE_HORIZON_WEEKS,
  attachPhaseExtras,
  pruneRedundant,
  repairRequirements,
  selectCourses,
  timeBudgetHours,
} from "@/engine/select";
import type { Gap } from "@/engine/types";
import type { CatalogItem, Profile } from "@/schemas";

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

const profile: Profile = {
  goals: [],
  skills: {},
  preferences: { hoursPerWeek: 10, formats: [], budget: "any", pace: "standard" },
};

const gap: Gap[] = [
  { skillId: "a", targetLevel: 2, currentLevel: 0, reason: "goal", graphPath: ["a"] },
  { skillId: "b", targetLevel: 2, currentLevel: 0, reason: "goal", graphPath: ["b"] },
  { skillId: "c", targetLevel: 1, currentLevel: 0, reason: "goal", graphPath: ["c"] },
];
const embeddings = {}; // similarity falls back to 0; irrelevant here

function score(catalog: CatalogItem[], p: Profile = profile, g: Gap[] = gap) {
  return scoreCandidates(g, p, { catalog, embeddings });
}

describe("timeBudgetHours", () => {
  it("is hoursPerWeek × the pace horizon", () => {
    expect(timeBudgetHours(profile.preferences)).toBe(10 * PACE_HORIZON_WEEKS.standard);
    expect(PACE_HORIZON_WEEKS.intense).toBeLessThan(PACE_HORIZON_WEEKS.relaxed);
  });
});

describe("selectCourses", () => {
  it("prefers the item covering the most uncovered levels per hour", () => {
    const catalog = [
      item({ id: "ab", skillsTaught: [{ skillId: "a", level: 2 }, { skillId: "b", level: 2 }], durationHours: 20 }),
      item({ id: "a-only", skillsTaught: [{ skillId: "a", level: 2 }], durationHours: 20 }),
      item({ id: "c", skillsTaught: [{ skillId: "c", level: 1 }], durationHours: 5 }),
    ];
    const res = selectCourses(score(catalog), gap, 1000);
    expect(res.selected.map((s) => s.item.id).sort()).toEqual(["ab", "c"]);
    expect(res.stoppedBecause).toBe("covered");
    expect(res.usedHours).toBe(25);
  });

  it("does not pick redundant items once a skill is covered", () => {
    const catalog = [
      item({ id: "a1", skillsTaught: [{ skillId: "a", level: 2 }] }),
      item({ id: "a2", skillsTaught: [{ skillId: "a", level: 2 }], qualityPrior: 0.4 }),
    ];
    const res = selectCourses(score(catalog), gap, 1000);
    expect(res.selected).toHaveLength(1);
    expect(res.stoppedBecause).toBe("no-candidates");
  });

  it("stacks levels: a level-1 then a level-2 course both count", () => {
    const catalog = [
      item({ id: "a-intro", skillsTaught: [{ skillId: "a", level: 1 }], durationHours: 2 }),
      item({ id: "a-adv", skillsTaught: [{ skillId: "a", level: 2 }], durationHours: 30 }),
    ];
    const res = selectCourses(score(catalog), gap, 1000);
    expect(res.selected.map((s) => s.item.id)).toEqual(["a-intro", "a-adv"]);
    expect(res.uncovered.get("a")).toBeUndefined();
  });

  it("stops when nothing that adds coverage fits the remaining budget", () => {
    const catalog = [
      item({ id: "a", skillsTaught: [{ skillId: "a", level: 2 }], durationHours: 10 }),
      item({ id: "b", skillsTaught: [{ skillId: "b", level: 2 }], durationHours: 50 }),
    ];
    const res = selectCourses(score(catalog), gap, 30);
    expect(res.selected.map((s) => s.item.id)).toEqual(["a"]);
    expect(res.stoppedBecause).toBe("budget");
    expect(res.uncovered.get("b")).toBe(2);
  });

  it("ignores projects and assessments", () => {
    const catalog = [
      item({ id: "p", kind: "project", skillsTaught: [{ skillId: "a", level: 2 }] }),
      item({ id: "q", kind: "assessment", skillsTaught: [{ skillId: "b", level: 2 }] }),
    ];
    expect(selectCourses(score(catalog), gap, 1000).selected).toEqual([]);
  });
});

describe("repairRequirements", () => {
  it("adds a course for an unmet requirement even when the skill is outside the gap", () => {
    const catalog = [
      item({ id: "adv", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "z", level: 1 }] }),
      item({ id: "z-course", skillsTaught: [{ skillId: "z", level: 1 }], durationHours: 3 }),
    ];
    const cands = score(catalog);
    const picked = cands.filter((c) => c.item.id === "adv");
    const repaired = repairRequirements(picked, profile, { catalog, embeddings }, gap, 1000);
    expect(repaired.selected.map((c) => c.item.id).sort()).toEqual(["adv", "z-course"]);
    expect(repaired.added.map((c) => c.item.id)).toEqual(["z-course"]);
    expect(repaired.prerequisiteGaps).toEqual([
      { skillId: "z", targetLevel: 1, currentLevel: 0, reason: "prereq-of:a", graphPath: ["z", "a"] },
    ]);
  });

  it("drops an item whose requirement no course can satisfy", () => {
    const catalog = [
      item({ id: "adv", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "z", level: 1 }] }),
    ];
    const repaired = repairRequirements(score(catalog), profile, { catalog, embeddings }, gap, 1000);
    expect(repaired.selected).toEqual([]);
    expect(repaired.dropped.map((c) => c.item.id)).toEqual(["adv"]);
  });

  it("treats profile skills as satisfying requirements", () => {
    const catalog = [
      item({ id: "adv", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "z", level: 1 }] }),
    ];
    const knows = { ...profile, skills: { z: { level: 1 as const, source: "stated" as const } } };
    const repaired = repairRequirements(score(catalog, knows), knows, { catalog, embeddings }, gap, 1000);
    expect(repaired.selected.map((c) => c.item.id)).toEqual(["adv"]);
  });
});

describe("attachPhaseExtras", () => {
  const catalog = [
    item({ id: "a-course", skillsTaught: [{ skillId: "a", level: 2 }] }),
    item({ id: "b-course", skillsTaught: [{ skillId: "b", level: 2 }], skillsRequired: [{ skillId: "a", level: 1 }] }),
    item({ id: "a-project", kind: "project", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "a", level: 1 }], durationHours: 4 }),
    item({ id: "b-project", kind: "project", skillsTaught: [{ skillId: "b", level: 2 }], skillsRequired: [{ skillId: "b", level: 2 }], durationHours: 4 }),
    item({ id: "a-quiz", kind: "assessment", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [], durationHours: 1 }),
    item({ id: "far-project", kind: "project", skillsTaught: [{ skillId: "c", level: 1 }], skillsRequired: [{ skillId: "q", level: 3 }], durationHours: 4 }),
  ];
  const cands = score(catalog);
  const byId = Object.fromEntries(cands.map((c) => [c.item.id, c]));
  const phases = [[byId["a-course"]], [byId["b-course"]]];

  it("attaches one project and one assessment per phase whose requirements the phase meets", () => {
    const res = attachPhaseExtras(phases, cands, profile, 100);
    expect(res.phases[0].project?.item.id).toBe("a-project");
    expect(res.phases[0].assessment?.item.id).toBe("a-quiz");
    expect(res.phases[1].project?.item.id).toBe("b-project");
    expect(res.phases[1].assessment).toBeUndefined();
  });

  it("never attaches an extra whose requirements are unmet", () => {
    const res = attachPhaseExtras(phases, cands, profile, 100);
    const ids = res.phases.flatMap((p) => [p.project?.item.id, p.assessment?.item.id]);
    expect(ids).not.toContain("far-project");
  });

  it("respects the remaining budget", () => {
    const res = attachPhaseExtras(phases, cands, profile, 4);
    const count = res.phases.filter((p) => p.project).length + res.phases.filter((p) => p.assessment).length;
    expect(count).toBe(1);
    expect(res.usedHours).toBe(4);
  });

  it("reserves a documented share of the budget for extras", () => {
    expect(EXTRAS_BUDGET_SHARE).toBeGreaterThan(0);
    expect(EXTRAS_BUDGET_SHARE).toBeLessThan(0.5);
  });
});

describe("selectCourses — requirement awareness", () => {
  it("prefers an item whose requirements are met over a blocked one of equal value", () => {
    const catalog = [
      item({ id: "blocked", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "z", level: 1 }], durationHours: 10 }),
      item({ id: "open", skillsTaught: [{ skillId: "a", level: 2 }], durationHours: 10 }),
    ];
    const res = selectCourses(score(catalog), gap, 1000, profile);
    expect(res.selected.map((c) => c.item.id)).toEqual(["open"]);
  });

  it("pulls in a prerequisite course when the only useful item is blocked", () => {
    const catalog = [
      item({ id: "adv", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "z", level: 1 }], durationHours: 10 }),
      item({ id: "z-course", skillsTaught: [{ skillId: "z", level: 1 }], durationHours: 3 }),
    ];
    const res = selectCourses(score(catalog), gap, 1000, profile, { catalog, embeddings });
    expect(res.selected.map((c) => c.item.id)).toEqual(["z-course", "adv"]);
    expect(res.usedHours).toBe(13);
    expect(res.prerequisiteGaps).toEqual([
      { skillId: "z", targetLevel: 1, currentLevel: 0, reason: "prereq-of:a", graphPath: ["z", "a"] },
    ]);
  });

  it("does not pull in a prerequisite when item plus prerequisite exceed the budget", () => {
    const catalog = [
      item({ id: "adv", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "z", level: 1 }], durationHours: 10 }),
      item({ id: "z-course", skillsTaught: [{ skillId: "z", level: 1 }], durationHours: 3 }),
    ];
    const res = selectCourses(score(catalog), gap, 12, profile, { catalog, embeddings });
    expect(res.selected).toEqual([]);
    expect(res.stoppedBecause).toBe("budget");
  });

  it("selects items in an order where every item's requirements are already met", () => {
    const catalog = [
      item({ id: "c3", skillsTaught: [{ skillId: "c", level: 1 }], skillsRequired: [{ skillId: "b", level: 2 }], durationHours: 1 }),
      item({ id: "b2", skillsTaught: [{ skillId: "b", level: 2 }], skillsRequired: [{ skillId: "a", level: 2 }], durationHours: 1 }),
      item({ id: "a2", skillsTaught: [{ skillId: "a", level: 2 }], durationHours: 30 }),
    ];
    const res = selectCourses(score(catalog), gap, 1000, profile, { catalog, embeddings });
    expect(res.selected.map((c) => c.item.id)).toEqual(["a2", "b2", "c3"]);
  });
});

describe("pruneRedundant", () => {
  it("removes an item whose every contribution is provided by other selected items", () => {
    const catalog = [
      item({ id: "git-video", skillsTaught: [{ skillId: "a", level: 1 }], durationHours: 1 }),
      item({ id: "git-deep", skillsTaught: [{ skillId: "a", level: 2 }], durationHours: 4 }),
      item({ id: "b", skillsTaught: [{ skillId: "b", level: 2 }] }),
    ];
    const cands = score(catalog);
    const pruned = pruneRedundant(cands, gap, profile);
    expect(pruned.map((c) => c.item.id).sort()).toEqual(["b", "git-deep"]);
  });

  it("keeps an item that is the only teacher of another item's requirement", () => {
    const catalog = [
      item({ id: "z-course", skillsTaught: [{ skillId: "z", level: 1 }], durationHours: 1 }),
      item({ id: "adv", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "z", level: 1 }] }),
    ];
    // z is not in the gap, so z-course contributes no gap levels — but adv needs it.
    const cands = [
      ...score(catalog),
      ...score(catalog, profile, [{ skillId: "z", targetLevel: 1, currentLevel: 0, reason: "goal", graphPath: ["z"] }]),
    ];
    const pruned = pruneRedundant(cands, gap, profile);
    expect(pruned.map((c) => c.item.id).sort()).toEqual(["adv", "z-course"]);
  });
});

describe("self-requirements", () => {
  const catalog = [
    item({ id: "adv", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "a", level: 1 }] }),
  ];

  it("repairRequirements does not let an item satisfy its own requirement", () => {
    const repaired = repairRequirements(score(catalog), profile, { catalog, embeddings }, gap, 1000);
    expect(repaired.selected).toEqual([]);
    expect(repaired.dropped.map((c) => c.item.id)).toEqual(["adv"]);
  });

  it("selectCourses treats a self-requiring item as blocked until another item teaches the basics", () => {
    const withIntro = [...catalog, item({ id: "intro", skillsTaught: [{ skillId: "a", level: 1 }], durationHours: 2 })];
    const res = selectCourses(score(withIntro), gap, 1000, profile, { catalog: withIntro, embeddings });
    expect(res.selected.map((c) => c.item.id)).toEqual(["intro", "adv"]);
  });

  it("selectCourses resumes from an initial selection, counting its hours and skills", () => {
    const outside = item({ id: "outside", skillsTaught: [{ skillId: "a", level: 1 }], durationHours: 7 });
    const cands = score(catalog);
    const initial = score([outside], profile, [{ skillId: "a", targetLevel: 1, currentLevel: 0, reason: "goal", graphPath: ["a"] }]);
    const res = selectCourses(cands, gap, 1000, profile, { catalog, embeddings }, initial);
    expect(res.selected.map((c) => c.item.id)).toEqual(["outside", "adv"]);
    expect(res.usedHours).toBe(17);
  });
});

describe("repairRequirements convergence", () => {
  it("does not re-add a fix it already dropped, and drops the dependent instead", () => {
    const catalog = [
      item({ id: "needs-u", skillsTaught: [{ skillId: "a", level: 2 }], skillsRequired: [{ skillId: "u", level: 1 }] }),
      // The only teacher of u itself needs a skill nobody teaches.
      item({ id: "u-course", skillsTaught: [{ skillId: "u", level: 1 }], skillsRequired: [{ skillId: "python", level: 1 }], durationHours: 4 }),
    ];
    const cands = score(catalog);
    const repaired = repairRequirements(cands, profile, { catalog, embeddings }, gap, 1000);
    expect(repaired.selected).toEqual([]);
    expect(repaired.dropped.map((c) => c.item.id).sort()).toEqual(["needs-u", "u-course"]);
  });
});
