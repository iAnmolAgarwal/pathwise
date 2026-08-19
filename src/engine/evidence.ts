import type { Evidence, LearnerEvidenceEdge, SkillEdge } from "../schemas";
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
  skillEdges: readonly SkillEdge[],
): Evidence {
  const gapById = new Map(gap.map((g) => [g.skillId, g]));
  const inPath = new Set(pathItemIds);
  const gapSkillsCovered = candidate.gapSkills.flatMap(({ skillId }) => {
    const g = gapById.get(skillId);
    return g ? [{ skillId, reason: g.reason, graphPath: g.graphPath }] : [];
  });
  const learner = learnerEvidenceFor(gapSkillsCovered, skillEdges);
  return {
    catalogId: candidate.item.id,
    gapSkillsCovered,
    scoreBreakdown: { ...candidate.breakdown },
    sequencedAfter: edges
      .filter((e) => e.to === candidate.item.id && inPath.has(e.from))
      .map((e) => ({ catalogId: e.from, becauseSkill: e.becauseSkill })),
    provenance: candidate.item.url,
    ...(learner.length > 0 ? { learnerEvidence: { edges: learner } } : {}),
  };
}

/**
 * Learner-sequence evidence (§7 rendering 3): for every covered gap skill, the path-driving
 * edges it sits on within its own graphPath (into it and out of it), one entry per source
 * that observed the pair. Nothing is inferred — the numbers are copied from skill_edges.json
 * with the source caveat attached (N-2). Mined candidates are not path-driving and never appear.
 */
export function learnerEvidenceFor(
  covered: { skillId: string; graphPath: string[] }[],
  skillEdges: readonly SkillEdge[],
): LearnerEvidenceEdge[] {
  const byPair = new Map<string, SkillEdge>();
  for (const e of skillEdges) if (e.drivesPath) byPair.set(`${e.from}>${e.to}`, e);
  const out: LearnerEvidenceEdge[] = [];
  const seen = new Set<string>();
  for (const { skillId, graphPath } of covered) {
    for (let i = 1; i < graphPath.length; i++) {
      const from = graphPath[i - 1];
      const to = graphPath[i];
      if (from !== skillId && to !== skillId) continue;
      const edge = byPair.get(`${from}>${to}`);
      if (!edge) continue;
      for (const source of ["stackoverflow", "coursera"] as const) {
        const stat = edge.sources[source];
        const key = `${from}>${to}:${source}`;
        if (!stat || seen.has(key)) continue;
        seen.add(key);
        out.push({ from, to, source, support: stat.support, reverse: stat.reverse, confidence: stat.confidence, n: stat.n, caveat: stat.caveat });
      }
    }
  }
  return out;
}
