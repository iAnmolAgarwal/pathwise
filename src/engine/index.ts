import type { CatalogItem, Path, Profile } from "../schemas";
import { buildEvidence } from "./evidence";
import { computeGap, requiredSkillsForGoals } from "./gap";
import { scoreCandidates } from "./score";
import {
  EXTRAS_BUDGET_SHARE,
  attachPhaseExtras,
  pruneRedundant,
  repairRequirements,
  selectCourses,
  timeBudgetHours,
  type SelectionStop,
} from "./select";
import { namePhase, precedenceEdges, sequenceItems } from "./sequence";
import type { Candidate, EngineData, Gap, SequenceEdge } from "./types";

export const ENGINE_VERSION = "0.1.0";

export type GenerateOptions = {
  /** ISO timestamp stamped into Path.meta; injected so generation is a pure function. */
  now: string;
  trigger: Path["meta"]["trigger"];
  /** Hours already spent on completed items; they came out of the same horizon budget. */
  spentHours?: number;
};

export type Working = {
  gap: Gap[];
  /** Goal gap plus requirement gaps opened during selection; evidence is scored against this. */
  evidenceGap: Gap[];
  candidates: Candidate[];
  budgetHours: number;
  courseBudgetHours: number;
  usedHours: number;
  stoppedBecause: SelectionStop;
  uncovered: { skillId: string; levelsMissing: number }[];
  dropped: string[];
  /** Precedence edges over every path item (courses, projects, assessments). */
  edges: SequenceEdge[];
  /** Edges the course toposort actually honoured (cycle-broken edges removed). */
  courseOrderEdges: SequenceEdge[];
};

/**
 * The full engine (§5): gap → score → select → sequence → evidence. Deterministic for a
 * given (profile, data, options); returns the Path plus every intermediate result.
 */
export function generatePath(
  profile: Profile,
  data: EngineData,
  options: GenerateOptions,
): { path: Path; working: Working } {
  const required = requiredSkillsForGoals(profile.goals, data.goals);
  const gap = computeGap(profile, required, data.skills);
  const candidates = scoreCandidates(gap, profile, data);

  const budgetHours = Math.max(0, timeBudgetHours(profile.preferences) - (options.spentHours ?? 0));
  const courseBudgetHours = Math.round(budgetHours * (1 - EXTRAS_BUDGET_SHARE));
  // Select → repair → prune, repeated: pruning can free hours that admit another course.
  let kept: Candidate[] = [];
  let selection = selectCourses(candidates, gap, courseBudgetHours, profile, data);
  let dropped: Candidate[] = [];
  const prerequisiteGaps: Gap[] = [];
  for (let round = 0; round < 4; round++) {
    const repaired = repairRequirements(selection.selected, profile, data, gap, courseBudgetHours);
    dropped = repaired.dropped;
    prerequisiteGaps.push(...selection.prerequisiteGaps, ...repaired.prerequisiteGaps);
    const pruned = pruneRedundant(repaired.selected, gap, profile);
    const unchanged =
      pruned.length === kept.length && pruned.every((c) => kept.includes(c));
    kept = pruned;
    if (unchanged) break;
    selection = selectCourses(candidates, gap, courseBudgetHours, profile, data, kept);
    if (selection.selected.length === kept.length) break;
  }
  // Evidence is built against the goal gap plus any requirement gaps selection opened.
  const evidenceGap: Gap[] = dedupeGaps([...gap, ...prerequisiteGaps]);

  const byId = new Map(kept.map((c) => [c.item.id, c]));
  const sequenced = sequenceItems(
    kept.map((c) => c.item),
    data.skills,
  );
  const coursePhases = sequenced.phases.map((phase) => phase.map((i) => byId.get(i.id)!));
  const courseHours = kept.reduce((h, c) => h + c.item.durationHours, 0);
  const extras = attachPhaseExtras(coursePhases, candidates, profile, budgetHours - courseHours);

  // Rescore every chosen item against the evidence gap so all breakdowns share one scale
  // (items pulled in as prerequisites were scored against a one-skill gap during selection).
  const rescored = new Map(
    scoreCandidates(evidenceGap, profile, {
      catalog: [...coursePhases.flat(), ...extras.phases.flatMap((e) => [e.project, e.assessment])]
        .filter((c): c is Candidate => c !== undefined)
        .map((c) => c.item),
      embeddings: data.embeddings,
    }).map((c) => [c.item.id, c]),
  );
  const consistent = (c: Candidate | undefined): Candidate[] =>
    c ? [rescored.get(c.item.id) ?? c] : [];
  const phaseCandidates: Candidate[][] = coursePhases.map((courses, i) => [
    ...courses.flatMap(consistent),
    ...consistent(extras.phases[i].project),
    ...consistent(extras.phases[i].assessment),
  ]);
  const allItems: CatalogItem[] = phaseCandidates.flat().map((c) => c.item);
  const edges = precedenceEdges(allItems, data.skills);

  const seen: string[] = [];
  const phases: Path["phases"] = phaseCandidates.map((cands, i) => {
    const { title, milestone } = namePhase(
      i,
      cands.map((c) => c.item),
      data.skills,
    );
    const items = cands.map((c) => {
      const evidence = buildEvidence(c, evidenceGap, edges, seen);
      seen.push(c.item.id);
      return { catalogId: c.item.id, status: "todo" as const, evidence };
    });
    return { title, milestone, items };
  });

  const path: Path = {
    phases,
    meta: { generatedAt: options.now, engineVersion: ENGINE_VERSION, trigger: options.trigger },
  };
  return {
    path,
    working: {
      gap,
      evidenceGap,
      candidates,
      budgetHours,
      courseBudgetHours,
      usedHours: courseHours + extras.usedHours,
      stoppedBecause: selection.stoppedBecause,
      uncovered: [...selection.uncovered].map(([skillId, levelsMissing]) => ({ skillId, levelsMissing })),
      dropped: dropped.map((c) => c.item.id),
      edges,
      courseOrderEdges: sequenced.edges,
    },
  };
}

function dedupeGaps(gaps: Gap[]): Gap[] {
  const seen = new Set<string>();
  return gaps.filter((g) => (seen.has(g.skillId) ? false : (seen.add(g.skillId), true)));
}

export { ENGINE_WEIGHTS } from "./score";
export { computeGap, requiredSkillsForGoals } from "./gap";
export type { Candidate, EngineData, Gap, SequenceEdge } from "./types";
