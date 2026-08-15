import { describe, expect, it } from "vitest";
import { buildEvidence } from "@/engine/evidence";
import type { Candidate, Gap, SequenceEdge } from "@/engine/types";
import { EvidenceSchema, type CatalogItem } from "@/schemas";

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

describe("buildEvidence", () => {
  const evidence = buildEvidence(candidate, gap, edges, ["js-course", "react-course", "next-course"]);

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
