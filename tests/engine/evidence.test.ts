import { describe, expect, it } from "vitest";
import { branchEvidenceFor, buildEvidence, learnerEvidenceFor, primaryGapSkill } from "@/engine/evidence";
import type { Candidate, Gap, SequenceEdge } from "@/engine/types";
import { EvidenceSchema, type Branch, type CatalogItem, type SkillEdge } from "@/schemas";

const item: CatalogItem = {
  id: "react-course",
  kind: "course",
  title: "React",
  provider: "P",
  url: "https://example.com/react",
  description: "x",
  skillsTaught: [{ skillId: "react", level: 2 }, { skillId: "css", level: 1 }],
  skillsRequired: [{ skillId: "js", level: 1 }],
  difficulty: 2,
  durationHours: 10,
  format: "video",
  cost: "free",
  qualityPrior: 0.8,
};

const candidate: Candidate = {
  item,
  breakdown: { coverage: 0.5, levelFit: 0.9, preferenceFit: 1, quality: 0.8, similarity: 0.7, transitionPrior: 0, total: 0.72 },
  gapSkills: [{ skillId: "react", taughtLevel: 2, levelsGained: 2 }],
};

const gap: Gap[] = [
  { skillId: "react", targetLevel: 3, currentLevel: 0, reason: "goal", graphPath: ["js", "react"] },
  { skillId: "js", targetLevel: 2, currentLevel: 1, reason: "prereq-of:react", graphPath: ["js", "react"] },
];

const edges: SequenceEdge[] = [
  { from: "js-course", to: "react-course", becauseSkill: "js", hard: true },
  { from: "react-course", to: "next-course", becauseSkill: "react", hard: true },
  { from: "ghost", to: "react-course", becauseSkill: "js", hard: true },
];

const SO_CAVEAT = "Stack Overflow question order (first question per tag), users who started after both technologies existed; asking ≠ completing";
const CR_CAVEAT = "Coursera learners 2015–2020; sequences reconstructed from review order; pseudo-users by reviewer name";

const skillEdges: SkillEdge[] = [
  {
    from: "js", to: "react", origin: "authored", status: "confirmed-both", drivesPath: true,
    sources: {
      stackoverflow: { support: 1617, reverse: 103, confidence: 0.94, n: 1720, caveat: SO_CAVEAT },
      coursera: { support: 80, reverse: 6, confidence: 0.93, n: 86, caveat: CR_CAVEAT },
    },
  },
  { from: "css", to: "react", origin: "authored", status: "no-data", drivesPath: true, sources: {} },
  // A mined candidate on the same pair direction as nothing authored: never path-driving, never cited.
  {
    from: "react", to: "next", origin: "mined", status: "candidate", drivesPath: false,
    sources: { stackoverflow: { support: 900, reverse: 10, confidence: 0.99, n: 910, caveat: SO_CAVEAT } },
  },
];

describe("buildEvidence", () => {
  const evidence = buildEvidence(candidate, gap, edges, ["js-course", "react-course", "next-course"], skillEdges);

  it("validates against EvidenceSchema", () => {
    expect(EvidenceSchema.safeParse(evidence).success).toBe(true);
  });

  it("lists only the gap skills the item advances, with reason and graphPath from the gap", () => {
    expect(evidence.gapSkillsCovered).toEqual([
      { skillId: "react", reason: "goal", graphPath: ["js", "react"] },
    ]);
  });

  it("copies the score breakdown verbatim", () => {
    expect(evidence.scoreBreakdown).toEqual(candidate.breakdown);
  });

  it("records only incoming edges from items that are actually in the path", () => {
    expect(evidence.sequencedAfter).toEqual([{ catalogId: "js-course", becauseSkill: "js" }]);
  });

  it("uses the item URL as provenance", () => {
    expect(evidence.provenance).toBe(item.url);
  });
});

describe("learnerEvidence (§7 rendering 3)", () => {
  it("attaches one entry per source for each path-driving edge the covered skill sits on, with n and caveat", () => {
    const evidence = buildEvidence(candidate, gap, edges, [], skillEdges);
    expect(evidence.learnerEvidence?.edges).toEqual([
      { from: "js", to: "react", source: "stackoverflow", support: 1617, reverse: 103, confidence: 0.94, n: 1720, caveat: SO_CAVEAT },
      { from: "js", to: "react", source: "coursera", support: 80, reverse: 6, confidence: 0.93, n: 86, caveat: CR_CAVEAT },
    ]);
    expect(EvidenceSchema.safeParse(evidence).success).toBe(true);
  });

  it("is omitted entirely when no edge on the covered skill has source data", () => {
    const noData = skillEdges.map((e) => ({ ...e, sources: {} }));
    const evidence = buildEvidence(candidate, gap, edges, [], noData);
    expect(evidence.learnerEvidence).toBeUndefined();
    expect("learnerEvidence" in evidence).toBe(false);
  });

  it("only cites edges that touch the covered skill, in its own graphPath, and never a mined candidate", () => {
    // graphPath js → react → next: the react→next pair is only a mined candidate; nothing authored drives it.
    const out = learnerEvidenceFor([{ skillId: "react", graphPath: ["js", "react", "next"] }], skillEdges);
    expect(out.map((e) => `${e.from}>${e.to}:${e.source}`)).toEqual(["js>react:stackoverflow", "js>react:coursera"]);
    // A covered skill further along the chain does not pull in edges it does not sit on.
    const far = learnerEvidenceFor([{ skillId: "next", graphPath: ["js", "react", "next"] }], skillEdges);
    expect(far).toEqual([]);
  });

  it("dedupes an edge shared by two covered skills", () => {
    const out = learnerEvidenceFor(
      [{ skillId: "js", graphPath: ["js", "react"] }, { skillId: "react", graphPath: ["js", "react"] }],
      skillEdges,
    );
    expect(out).toHaveLength(2);
  });
});


describe("learnerEvidence.branch (§15.8)", () => {
  const branches: Branch[] = [
    // The learner knows js; 71 % of learners who learned js went to react next (well above both floors).
    {
      from: "js", source: "stackoverflow", nTotal: 2280, nNextObserved: 2, minSupportMet: true, caveat: SO_CAVEAT,
      next: [
        { to: "react", n: 1617, shareRaw: 0.7092, shareShrunk: 0.7074, inCatalog: true },
        { to: "css", n: 663, shareRaw: 0.2908, shareShrunk: 0.2926, inCatalog: true },
      ],
    },
    // Coursera saw the same step with a smaller share: the larger share wins the card line.
    {
      from: "js", source: "coursera", nTotal: 120, nNextObserved: 2, minSupportMet: true, caveat: CR_CAVEAT,
      next: [
        { to: "react", n: 40, shareRaw: 0.3333, shareShrunk: 0.3333, inCatalog: true },
        { to: "css", n: 80, shareRaw: 0.6667, shareShrunk: 0.6667, inCatalog: true },
      ],
    },
    // Below the floor: nTotal < 50 — never cited even though the share is higher.
    {
      from: "html", source: "stackoverflow", nTotal: 40, nNextObserved: 1, minSupportMet: false, caveat: SO_CAVEAT,
      next: [{ to: "react", n: 40, shareRaw: 1, shareShrunk: 1, inCatalog: true }],
    },
    // From a skill the learner does not have: never cited.
    {
      from: "typescript", source: "stackoverflow", nTotal: 900, nNextObserved: 1, minSupportMet: true, caveat: SO_CAVEAT,
      next: [{ to: "react", n: 900, shareRaw: 1, shareShrunk: 1, inCatalog: true }],
    },
  ];
  const known = ["js", "html"];

  it("cites the largest share into the primary gap skill from a skill the learner has, above the floors", () => {
    expect(branchEvidenceFor("react", known, branches)).toEqual({
      from: "js", toThis: 1617, nTotal: 2280, shareShrunk: 0.7074, source: "stackoverflow", caveat: SO_CAVEAT,
    });
  });

  it("never cites a branch below the support floor or from a skill the learner lacks", () => {
    // Only html (below floor) and typescript (unknown) point at react once js is taken away.
    expect(branchEvidenceFor("react", ["html"], branches)).toBeUndefined();
    expect(branchEvidenceFor("react", [], branches)).toBeUndefined();
    // A listed successor with n < 5 is never shown even when the entry is above the floor.
    const thin: Branch[] = [{ ...branches[0], next: [{ to: "react", n: 4, shareRaw: 0.1, shareShrunk: 0.1, inCatalog: true }] }];
    expect(branchEvidenceFor("react", known, thin)).toBeUndefined();
  });

  it("is attached to the evidence for the primary gap skill, and learnerEvidence may carry the branch alone", () => {
    const noEdgeData = skillEdges.map((e) => ({ ...e, sources: {} }));
    const profileSkills = { js: { level: 2 as const, source: "stated" as const }, html: { level: 1 as const, source: "stated" as const } };
    const evidence = buildEvidence(candidate, gap, edges, [], noEdgeData, profileSkills, branches);
    expect(evidence.learnerEvidence).toEqual({
      edges: [],
      branch: { from: "js", toThis: 1617, nTotal: 2280, shareShrunk: 0.7074, source: "stackoverflow", caveat: SO_CAVEAT },
    });
    expect(EvidenceSchema.safeParse(evidence).success).toBe(true);
    // A level-0 entry is not a skill the learner has.
    const zero = buildEvidence(candidate, gap, edges, [], noEdgeData, { js: { level: 0, source: "stated" } }, branches);
    expect(zero.learnerEvidence).toBeUndefined();
  });

  it("picks the primary gap skill as the covered skill with the most levels gained, first on ties", () => {
    const two: Candidate = { ...candidate, gapSkills: [{ skillId: "css", taughtLevel: 1, levelsGained: 1 }, { skillId: "react", taughtLevel: 2, levelsGained: 2 }] };
    const gapWithCss: Gap[] = [...gap, { skillId: "css", targetLevel: 1, currentLevel: 0, reason: "goal", graphPath: ["css"] }];
    const profileSkills = { js: { level: 2 as const, source: "stated" as const } };
    expect(primaryGapSkill(two)).toBe("react");
    expect(buildEvidence(two, gapWithCss, edges, [], [], profileSkills, branches).learnerEvidence?.branch?.toThis).toBe(1617);
    const tie: Candidate = { ...candidate, gapSkills: [{ skillId: "css", taughtLevel: 1, levelsGained: 1 }, { skillId: "react", taughtLevel: 1, levelsGained: 1 }] };
    expect(primaryGapSkill(tie)).toBe("css");
  });
});
