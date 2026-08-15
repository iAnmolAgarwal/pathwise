import type { Evidence } from "../schemas";
import type { Candidate, Gap, SequenceEdge } from "./types";

/**
 * Assemble the Evidence object (§7) for one selected item at generation time. Everything
 * here is copied from the engine's own working — no field is invented after the fact.
 */
export function buildEvidence(
  candidate: Candidate,
  gap: Gap[],
  edges: SequenceEdge[],
  pathItemIds: string[],
): Evidence {
  const gapById = new Map(gap.map((g) => [g.skillId, g]));
  const inPath = new Set(pathItemIds);
  return {
    catalogId: candidate.item.id,
    gapSkillsCovered: candidate.gapSkills.flatMap(({ skillId }) => {
      const g = gapById.get(skillId);
      return g ? [{ skillId, reason: g.reason, graphPath: g.graphPath }] : [];
    }),
    scoreBreakdown: { ...candidate.breakdown },
    sequencedAfter: edges
      .filter((e) => e.to === candidate.item.id && inPath.has(e.from))
      .map((e) => ({ catalogId: e.from, becauseSkill: e.becauseSkill })),
    provenance: candidate.item.url,
  };
}
