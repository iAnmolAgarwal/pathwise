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
};

export type Working = {
  gap: Gap[];
  candidates: Candidate[];
  budgetHours: number;
  courseBudgetHours: number;
  usedHours: number;
  stoppedBecause: SelectionStop;
  uncovered: { skillId: string; levelsMissing: number }[];
  dropped: string[];
  edges: SequenceEdge[];
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

  const budgetHours = timeBudgetHours(profile.preferences);
  const courseBudgetHours = Math.round(budgetHours * (1 - EXTRAS_BUDGET_SHARE));
  const selection = selectCourses(candidates, gap, courseBudgetHours, profile, data);
  const repaired = repairRequirements(selection.selected, profile, data, gap, courseBudgetHours);
  const kept = pruneRedundant(repaired.selected, gap, profile);

  const byId = new Map(kept.map((c) => [c.item.id, c]));
  const sequenced = sequenceItems(
    kept.map((c) => c.item),
    data.skills,
  );
  const coursePhases = sequenced.phases.map((phase) => phase.map((i) => byId.get(i.id)!));
  const courseHours = kept.reduce((h, c) => h + c.item.durationHours, 0);
  const extras = attachPhaseExtras(coursePhases, candidates, profile, budgetHours - courseHours);

  const phaseCandidates: Candidate[][] = coursePhases.map((courses, i) => [
    ...courses,
    ...(extras.phases[i].project ? [extras.phases[i].project] : []),
    ...(extras.phases[i].assessment ? [extras.phases[i].assessment] : []),
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
      const evidence = buildEvidence(c, gap, edges, seen);
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
      candidates,
      budgetHours,
      courseBudgetHours,
      usedHours: courseHours + extras.usedHours,
      stoppedBecause: selection.stoppedBecause,
      uncovered: [...selection.uncovered].map(([skillId, levelsMissing]) => ({ skillId, levelsMissing })),
      dropped: repaired.dropped.map((c) => c.item.id),
      edges,
    },
  };
}

export { ENGINE_WEIGHTS } from "./score";
export { computeGap, requiredSkillsForGoals } from "./gap";
export type { Candidate, EngineData, Gap, SequenceEdge } from "./types";
