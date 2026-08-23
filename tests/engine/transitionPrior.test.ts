import { describe, expect, it } from "vitest";
import { buildEvidence } from "@/engine/evidence";
import { ENGINE_WEIGHTS, scoreCandidates, transitionPrior } from "@/engine/score";
import type { Candidate, Gap } from "@/engine/types";
import type { Branch, CatalogItem, Profile } from "@/schemas";

const SO_CAVEAT = "Order of asking, not of mastering.";

/**
 * The learner knows js. Stack Overflow saw 71 % of learners who asked about js ask about
 * react next, well above both floors (nTotal ≥ 50, n ≥ 5); the other three entries are the
 * three ways a branch fails to qualify.
 */
const branches: Branch[] = [
  {
    from: "js", source: "stackoverflow", nTotal: 2280, nNextObserved: 2, minSupportMet: true, caveat: SO_CAVEAT,
    next: [
      { to: "react", n: 1617, shareRaw: 0.7092, shareShrunk: 0.7074, inCatalog: true },
      { to: "css", n: 663, shareRaw: 0.2908, shareShrunk: 0.2926, inCatalog: true },
    ],
  },
  // Below the entry floor: nTotal = 40 and minSupportMet false — contributes nothing.
  {
    from: "html", source: "stackoverflow", nTotal: 40, nNextObserved: 1, minSupportMet: false, caveat: SO_CAVEAT,
    next: [{ to: "react", n: 40, shareRaw: 1, shareShrunk: 1, inCatalog: true }],
  },
  // Above the floors but from a skill the learner does not hold — contributes nothing.
  {
    from: "typescript", source: "stackoverflow", nTotal: 900, nNextObserved: 1, minSupportMet: true, caveat: SO_CAVEAT,
    next: [{ to: "react", n: 900, shareRaw: 1, shareShrunk: 1, inCatalog: true }],
  },
];

/** Above the entry floor, but the successor itself is thin (n = 4 < 5). */
const thinSuccessor: Branch[] = [
  { ...branches[0], next: [{ to: "react", n: 4, shareRaw: 0.1, shareShrunk: 0.1, inCatalog: true }] },
];

/** Above both floors, but nobody was observed going into react from anywhere the learner has been. */
const noSuchTransition: Branch[] = [
  { ...branches[0], next: [{ to: "css", n: 663, shareRaw: 1, shareShrunk: 1, inCatalog: true }] },
];

const gapSkills: Candidate["gapSkills"] = [
  { skillId: "react", taughtLevel: 2, levelsGained: 2 },
  { skillId: "css", taughtLevel: 1, levelsGained: 1 },
];

function profileWith(skills: Profile["skills"]): Profile {
  return {
    goals: [],
    skills,
    preferences: { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" },
  };
}

const knowsJs = profileWith({ js: { level: 2, source: "stated" } });

describe("transitionPrior (§5.2, D-27)", () => {
  it("is 0 when the learner holds no skills", () => {
    expect(transitionPrior(gapSkills, profileWith({}), branches)).toBe(0);
  });

  it("ignores skills recorded at level 0", () => {
    // A level-0 entry is not a skill the learner has — buildEvidence filters on level > 0 and
    // the score must filter identically, or the number scored stops matching the number shown.
    const levelZero = profileWith({ js: { level: 0, source: "inferred" } });
    expect(transitionPrior(gapSkills, levelZero, branches)).toBe(
      transitionPrior(gapSkills, profileWith({}), branches),
    );
    expect(transitionPrior(gapSkills, levelZero, branches)).toBe(0);
  });

  it("is 0 when no source observed the transition", () => {
    expect(transitionPrior(gapSkills, knowsJs, noSuchTransition)).toBe(0);
    expect(transitionPrior(gapSkills, knowsJs, [])).toBe(0);
  });

  it("is 0 below the support floors", () => {
    // The entry floor: html → react at nTotal 40, and the learner does hold html.
    const knowsHtml = profileWith({ html: { level: 3, source: "stated" } });
    expect(transitionPrior(gapSkills, knowsHtml, branches)).toBe(0);
    // The successor floor: js → react observed, but only n = 4 times.
    expect(transitionPrior(gapSkills, knowsJs, thinSuccessor)).toBe(0);
  });

  it("returns the shrunk share when a source observed it above the floors", () => {
    // Scored against react — the primary gap skill, because it gains the most levels.
    expect(transitionPrior(gapSkills, knowsJs, branches)).toBe(0.7074);
  });

  it("matches what the evidence card shows for the same item", () => {
    // The score and the explanation must read the same number, or explainability is a claim
    // rather than a fact. Both go through branchEvidenceFor on the same primary gap skill.
    const item: CatalogItem = {
      id: "react-course", kind: "course", title: "React", provider: "P",
      url: "https://example.com/react", description: "x",
      skillsTaught: [{ skillId: "react", level: 2 }, { skillId: "css", level: 1 }],
      skillsRequired: [], difficulty: 2, durationHours: 10, format: "video", cost: "free",
      qualityPrior: 0.8,
    };
    const gap: Gap[] = [
      { skillId: "react", targetLevel: 3, currentLevel: 0, reason: "goal", graphPath: ["js", "react"] },
      { skillId: "css", targetLevel: 2, currentLevel: 1, reason: "goal", graphPath: ["css"] },
    ];
    const [candidate] = scoreCandidates(gap, knowsJs, {
      catalog: [item],
      embeddings: {},
      branches,
    });
    const evidence = buildEvidence(candidate, gap, [], [], [], knowsJs.skills, branches);
    expect(evidence.learnerEvidence?.branch?.shareShrunk).toBe(0.7074);
    expect(candidate.breakdown.transitionPrior).toBe(evidence.learnerEvidence!.branch!.shareShrunk);
    expect(evidence.scoreBreakdown.transitionPrior).toBe(0.7074);
  });

  it("contributes nothing when the scorer is given no branches", () => {
    // Ten of the eleven scoreCandidates call sites pass a literal with no branch data; they
    // must keep scoring, and must contribute a prior of 0 rather than guessing one.
    const item: CatalogItem = {
      id: "react-course", kind: "course", title: "React", provider: "P",
      url: "https://example.com/react", description: "x",
      skillsTaught: [{ skillId: "react", level: 2 }],
      skillsRequired: [], difficulty: 2, durationHours: 10, format: "video", cost: "free",
      qualityPrior: 0.8,
    };
    const gap: Gap[] = [
      { skillId: "react", targetLevel: 3, currentLevel: 0, reason: "goal", graphPath: ["react"] },
    ];
    const [candidate] = scoreCandidates(gap, knowsJs, { catalog: [item], embeddings: {} });
    expect(candidate.breakdown.transitionPrior).toBe(0);
  });
});

describe("the prior's weight", () => {
  it("is 0.02, funded out of preferenceFit", () => {
    expect(ENGINE_WEIGHTS.transitionPrior).toBe(0.02);
    expect(ENGINE_WEIGHTS.preferenceFit).toBe(0.13);
  });

  it("moves the total by at most the weight", () => {
    // A share of 1.0 — the largest a share can be — moves the total by exactly 0.02.
    const item: CatalogItem = {
      id: "react-course", kind: "course", title: "React", provider: "P",
      url: "https://example.com/react", description: "x",
      skillsTaught: [{ skillId: "react", level: 2 }],
      skillsRequired: [], difficulty: 2, durationHours: 10, format: "video", cost: "free",
      qualityPrior: 0.8,
    };
    const gap: Gap[] = [
      { skillId: "react", targetLevel: 3, currentLevel: 0, reason: "goal", graphPath: ["react"] },
    ];
    const certain: Branch[] = [
      {
        from: "js", source: "stackoverflow", nTotal: 900, nNextObserved: 1, minSupportMet: true, caveat: SO_CAVEAT,
        next: [{ to: "react", n: 900, shareRaw: 1, shareShrunk: 1, inCatalog: true }],
      },
    ];
    const data = { catalog: [item], embeddings: {} };
    const [without] = scoreCandidates(gap, knowsJs, data);
    const [with_] = scoreCandidates(gap, knowsJs, { ...data, branches: certain });
    expect(with_.breakdown.transitionPrior).toBe(1);
    expect(with_.breakdown.total - without.breakdown.total).toBeCloseTo(0.02, 10);
  });
});
