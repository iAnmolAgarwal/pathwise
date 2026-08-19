import { describe, expect, it } from "vitest";
import { buildEvidence, learnerEvidenceFor } from "@/engine/evidence";
import type { Candidate, Gap, SequenceEdge } from "@/engine/types";
import { EvidenceSchema, type CatalogItem, type SkillEdge } from "@/schemas";

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
  breakdown: { coverage: 0.5, levelFit: 0.9, preferenceFit: 1, quality: 0.8, similarity: 0.7, total: 0.72 },
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

