import type { Branch, Evidence, LearnerEvidenceBranch, LearnerEvidenceEdge, Profile, SkillEdge } from "../schemas";
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
  profileSkills: Profile["skills"] = {},
  branches: readonly Branch[] = [],
): Evidence {
  const gapById = new Map(gap.map((g) => [g.skillId, g]));
  const inPath = new Set(pathItemIds);
  const gapSkillsCovered = candidate.gapSkills.flatMap(({ skillId }) => {
    const g = gapById.get(skillId);
    return g ? [{ skillId, reason: g.reason, graphPath: g.graphPath }] : [];
  });
  const learner = learnerEvidenceFor(gapSkillsCovered, skillEdges);
  const known = Object.entries(profileSkills).filter(([, v]) => v.level > 0).map(([id]) => id);
  const primary = primaryGapSkill(candidate);
  const branch = primary ? branchEvidenceFor(primary, known, branches) : undefined;
  const learnerEvidence =
    learner.length > 0 || branch ? { learnerEvidence: { edges: learner, ...(branch ? { branch } : {}) } } : {};
  return {
    catalogId: candidate.item.id,
    gapSkillsCovered,
    scoreBreakdown: { ...candidate.breakdown },
    sequencedAfter: edges
      .filter((e) => e.to === candidate.item.id && inPath.has(e.from))
      .map((e) => ({ catalogId: e.from, becauseSkill: e.becauseSkill })),
    provenance: candidate.item.url,
    ...learnerEvidence,
  };
}

/** The gap skill an item is mainly on the path for: the covered skill it advances the most levels, first on ties. */
export function primaryGapSkill(candidate: Pick<Candidate, "gapSkills">): string | undefined {
  let best: Candidate["gapSkills"][number] | undefined;
  for (const g of candidate.gapSkills) if (!best || g.levelsGained > best.levelsGained) best = g;
  return best?.skillId;
}

/**
 * "Learners like you" (§15.8, D-18): among the skills the learner already has, the branch entry
 * (per source) that lists `skillId` as a next step — above the floors only (entry minSupportMet,
 * successor n ≥ 5) — choosing the largest shrunk share, then the larger count, then the source
 * order. The share is a transition share copied from branches.json with its caveat (N-2, N-5);
 * nothing here affects selection or sequencing (§15.9).
 */
export function branchEvidenceFor(
  skillId: string,
  knownSkills: readonly string[],
  branches: readonly Branch[],
): LearnerEvidenceBranch | undefined {
  const known = new Set(knownSkills);
  let best: LearnerEvidenceBranch | undefined;
  for (const b of branches) {
    if (!b.minSupportMet || b.nTotal < 50 || !known.has(b.from)) continue;
    const step = b.next.find((x) => x.to === skillId);
    if (!step || step.n < 5) continue;
    const better =
      !best ||
      step.shareShrunk > best.shareShrunk ||
      (step.shareShrunk === best.shareShrunk && step.n > best.toThis);
    if (better) best = { from: b.from, toThis: step.n, nTotal: b.nTotal, shareShrunk: step.shareShrunk, source: b.source, caveat: b.caveat };
  }
  return best;
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
