import { describe, expect, it } from "vitest";
import {
  ENGINE_WEIGHTS,
  coverageOf,
  levelFit,
  preferenceFit,
  scoreCandidates,
} from "@/engine/score";
import type { Gap } from "@/engine/types";
import type { CatalogItem, Profile } from "@/schemas";

const gap: Gap[] = [
  { skillId: "js", targetLevel: 2, currentLevel: 0, reason: "goal", graphPath: ["js"] },
  { skillId: "react", targetLevel: 3, currentLevel: 1, reason: "goal", graphPath: ["react"] },
];
// total gap levels: js 2 + react 2 = 4

function item(over: Partial<CatalogItem>): CatalogItem {
  return {
    id: "x",
    kind: "course",
    title: "X",
    provider: "P",
    url: "https://example.com/x",
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
  skills: { react: { level: 1, source: "stated" } },
  preferences: { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" },
};

describe("ENGINE_WEIGHTS", () => {
  it("sum to 1", () => {
    const sum = Object.values(ENGINE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe("coverageOf", () => {
  it("is 1 when the item closes the whole gap", () => {
    const { coverage } = coverageOf(item({ skillsTaught: [{ skillId: "js", level: 2 }, { skillId: "react", level: 3 }] }), gap);
    expect(coverage).toBe(1);
  });

  it("is proportional to levels gained", () => {
    const { coverage, gapSkills } = coverageOf(item({ skillsTaught: [{ skillId: "js", level: 1 }] }), gap);
    expect(coverage).toBe(0.25);
    expect(gapSkills).toEqual([{ skillId: "js", taughtLevel: 1, levelsGained: 1 }]);
  });

  it("caps at the target level and ignores already-known levels", () => {
    const { coverage } = coverageOf(item({ skillsTaught: [{ skillId: "react", level: 3 }] }), gap);
    expect(coverage).toBe(0.5); // levels 2 and 3 of react; level 1 already known
  });

  it("gives 0 for an item teaching below the current level", () => {
    const { coverage, gapSkills } = coverageOf(item({ skillsTaught: [{ skillId: "react", level: 1 }] }), gap);
    expect(coverage).toBe(0);
    expect(gapSkills).toEqual([]);
  });

  it("ignores skills outside the gap", () => {
    expect(coverageOf(item({ skillsTaught: [{ skillId: "css", level: 3 }] }), gap).coverage).toBe(0);
  });
});

describe("levelFit", () => {
  it("is 1 for the easiest item when the learner starts from zero", () => {
    expect(levelFit(item({ difficulty: 1, skillsTaught: [{ skillId: "js", level: 2 }] }), gap, profile)).toBe(1);
  });

  it("is 0 for the hardest item when the learner starts from zero", () => {
    expect(levelFit(item({ difficulty: 5, skillsTaught: [{ skillId: "js", level: 2 }] }), gap, profile)).toBe(0);
  });

  it("prefers harder items for a learner who already knows some of it", () => {
    const easy = levelFit(item({ difficulty: 1, skillsTaught: [{ skillId: "react", level: 3 }] }), gap, profile);
    const mid = levelFit(item({ difficulty: 2, skillsTaught: [{ skillId: "react", level: 3 }] }), gap, profile);
    expect(mid).toBeGreaterThan(easy);
  });
});

describe("preferenceFit", () => {
  const prefs = profile.preferences;

  it("is 1 for a short free item with no format preference", () => {
    expect(preferenceFit(item({ durationHours: 5 }), prefs)).toBe(1);
  });

  it("penalises a format outside the stated preferences", () => {
    const withPref = { ...prefs, formats: ["interactive" as const] };
    expect(preferenceFit(item({ format: "video" }), withPref)).toBeLessThan(
      preferenceFit(item({ format: "interactive" }), withPref),
    );
  });

  it("penalises paid items under a free-only budget, freemium less so", () => {
    const freeOnly = { ...prefs, budget: "free-only" as const };
    const free = preferenceFit(item({ cost: "free" }), freeOnly);
    const freemium = preferenceFit(item({ cost: "freemium" }), freeOnly);
    const paid = preferenceFit(item({ cost: "paid" }), freeOnly);
    expect(free).toBeGreaterThan(freemium);
    expect(freemium).toBeGreaterThan(paid);
  });

  it("does not penalise paid items when budget is any", () => {
    expect(preferenceFit(item({ cost: "paid" }), prefs)).toBe(1);
  });

  it("penalises items far longer than the weekly hours allow", () => {
    expect(preferenceFit(item({ durationHours: 120 }), prefs)).toBeLessThan(
      preferenceFit(item({ durationHours: 6 }), prefs),
    );
  });
});

describe("scoreCandidates", () => {
  const embeddings = { js: [1, 0], react: [1, 0], a: [1, 0], b: [0, 1], c: [-1, 0] };
  const catalog = [
    item({ id: "a", skillsTaught: [{ skillId: "js", level: 2 }] }),
    item({ id: "b", skillsTaught: [{ skillId: "js", level: 1 }], qualityPrior: 0.9 }),
    item({ id: "c", skillsTaught: [{ skillId: "react", level: 2 }] }),
    item({ id: "d", skillsTaught: [{ skillId: "css", level: 2 }] }),
  ];

  it("only returns items that advance at least one gap skill", () => {
    const ids = scoreCandidates(gap, profile, { catalog, embeddings }).map((c) => c.item.id);
    expect(ids).not.toContain("d");
    expect(ids).toHaveLength(3);
  });

  it("logs every component and a total that is their weighted sum", () => {
    const [top] = scoreCandidates(gap, profile, { catalog, embeddings });
    const b = top.breakdown;
    const expected =
      ENGINE_WEIGHTS.coverage * b.coverage +
      ENGINE_WEIGHTS.levelFit * b.levelFit +
      ENGINE_WEIGHTS.preferenceFit * b.preferenceFit +
      ENGINE_WEIGHTS.quality * b.quality +
      ENGINE_WEIGHTS.similarity * b.similarity;
    expect(b.total).toBeCloseTo(expected);
    for (const v of Object.values(b)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("uses cosine to the goal centroid as similarity, clamped at 0", () => {
    const byId = Object.fromEntries(scoreCandidates(gap, profile, { catalog, embeddings }).map((c) => [c.item.id, c]));
    expect(byId.a.breakdown.similarity).toBeCloseTo(1);
    expect(byId.b.breakdown.similarity).toBeCloseTo(0);
    expect(byId.c.breakdown.similarity).toBe(0);
  });

  it("returns candidates sorted by total, descending", () => {
    const totals = scoreCandidates(gap, profile, { catalog, embeddings }).map((c) => c.breakdown.total);
    expect(totals).toEqual([...totals].sort((x, y) => y - x));
  });

  it("returns nothing for an empty gap", () => {
    expect(scoreCandidates([], profile, { catalog, embeddings })).toEqual([]);
  });
});
