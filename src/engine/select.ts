import type { CatalogItem, Preferences, Profile } from "../schemas";
import { scoreCandidates } from "./score";
import type { Candidate, Gap } from "./types";

/** Planning horizon in weeks by pace; time budget = hoursPerWeek × horizon (§5.3). */
export const PACE_HORIZON_WEEKS = { relaxed: 36, standard: 24, intense: 12 } as const;

/** Share of the time budget held back from courses for projects and assessments. */
export const EXTRAS_BUDGET_SHARE = 0.25;

export function timeBudgetHours(prefs: Preferences): number {
  return prefs.hoursPerWeek * PACE_HORIZON_WEEKS[prefs.pace];
}

export type SelectionStop = "covered" | "budget" | "no-candidates";

export type CourseSelection = {
  selected: Candidate[];
  usedHours: number;
  /** skillId → levels still missing after selection */
  uncovered: Map<string, number>;
  stoppedBecause: SelectionStop;
};

/** Levels of a skill the learner will hold after the given items, starting from the profile. */
export function achievedLevels(profile: Profile, items: CatalogItem[]): Map<string, number> {
  const levels = new Map<string, number>();
  for (const [skillId, s] of Object.entries(profile.skills)) levels.set(skillId, s.level);
  for (const item of items) {
    for (const t of item.skillsTaught) {
      levels.set(t.skillId, Math.max(levels.get(t.skillId) ?? 0, t.level));
    }
  }
  return levels;
}

function levelsGainedAgainst(candidate: Candidate, gap: Gap[], achieved: Map<string, number>): number {
  const targets = new Map(gap.map((g) => [g.skillId, g.targetLevel]));
  let gain = 0;
  for (const t of candidate.item.skillsTaught) {
    const target = targets.get(t.skillId);
    if (target === undefined) continue;
    gain += Math.max(0, Math.min(t.level, target) - (achieved.get(t.skillId) ?? 0));
  }
  return gain;
}

/**
 * Greedy weighted set-cover (§5.3): repeatedly take the course maximising
 * (uncovered gap levels it teaches) × score / durationHours until the gap is covered,
 * the budget is exhausted, or nothing left adds coverage. Greedy is within a ln(n)
 * factor of the optimal cover; for a ~20-skill gap that bound is loose but the
 * practical result is a small, non-redundant course set.
 */
export function selectCourses(
  candidates: Candidate[],
  gap: Gap[],
  budgetHours: number,
  profile?: Profile,
): CourseSelection {
  const achieved = new Map<string, number>(gap.map((g) => [g.skillId, g.currentLevel]));
  if (profile) {
    for (const [skillId, s] of Object.entries(profile.skills)) {
      if (!achieved.has(skillId)) achieved.set(skillId, s.level);
    }
  }
  const pool = candidates.filter((c) => c.item.kind === "course");
  const selected: Candidate[] = [];
  let usedHours = 0;
  let stoppedBecause: SelectionStop = "covered";

  for (;;) {
    if (uncoveredLevels(gap, achieved).size === 0) {
      stoppedBecause = "covered";
      break;
    }
    let best: { c: Candidate; priority: number } | null = null;
    let anyUseful = false;
    for (const c of pool) {
      if (selected.includes(c)) continue;
      const gain = levelsGainedAgainst(c, gap, achieved);
      if (gain === 0) continue;
      anyUseful = true;
      if (usedHours + c.item.durationHours > budgetHours) continue;
      const priority = (gain * c.breakdown.total) / c.item.durationHours;
      if (
        !best ||
        priority > best.priority ||
        (priority === best.priority && c.breakdown.total > best.c.breakdown.total)
      ) {
        best = { c, priority };
      }
    }
    if (!best) {
      stoppedBecause = anyUseful ? "budget" : "no-candidates";
      break;
    }
    selected.push(best.c);
    usedHours += best.c.item.durationHours;
    for (const t of best.c.item.skillsTaught) {
      achieved.set(t.skillId, Math.max(achieved.get(t.skillId) ?? 0, t.level));
    }
  }

  return { selected, usedHours, uncovered: uncoveredLevels(gap, achieved), stoppedBecause };
}

export function uncoveredLevels(gap: Gap[], achieved: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const g of gap) {
    const missing = g.targetLevel - (achieved.get(g.skillId) ?? g.currentLevel);
    if (missing > 0) out.set(g.skillId, missing);
  }
  return out;
}

export function unmetRequirements(
  item: CatalogItem,
  levels: Map<string, number>,
): { skillId: string; level: number }[] {
  return item.skillsRequired.filter((r) => (levels.get(r.skillId) ?? 0) < r.level);
}

/**
 * Hard sequencing constraint (§5.2): every selected item's skillsRequired must be met by
 * the profile plus other planned items. Missing requirements are repaired by pulling in
 * the best course that teaches the missing skill (even if that skill is not in the gap);
 * if none exists or fits the budget, the item is dropped instead.
 */
export function repairRequirements(
  selected: Candidate[],
  profile: Profile,
  data: { catalog: CatalogItem[]; embeddings: Record<string, number[]> },
  gap: Gap[],
  budgetHours: number,
): { selected: Candidate[]; added: Candidate[]; dropped: Candidate[] } {
  const current = [...selected];
  const added: Candidate[] = [];
  const dropped: Candidate[] = [];
  let usedHours = current.reduce((h, c) => h + c.item.durationHours, 0);

  for (let guard = 0; guard < 100; guard++) {
    const levels = achievedLevels(profile, current.map((c) => c.item));
    const offender = current.find((c) => unmetRequirements(c.item, levels).length > 0);
    if (!offender) break;
    const missing = unmetRequirements(offender.item, levels)[0];
    const fix = bestCourseTeaching(missing, current, data, profile, gap);
    if (fix && usedHours + fix.item.durationHours <= budgetHours) {
      current.push(fix);
      added.push(fix);
      usedHours += fix.item.durationHours;
    } else {
      current.splice(current.indexOf(offender), 1);
      dropped.push(offender);
      usedHours -= offender.item.durationHours;
      const idx = added.indexOf(offender);
      if (idx >= 0) added.splice(idx, 1);
    }
  }
  return { selected: current, added, dropped };
}

function bestCourseTeaching(
  need: { skillId: string; level: number },
  already: Candidate[],
  data: { catalog: CatalogItem[]; embeddings: Record<string, number[]> },
  profile: Profile,
  gap: Gap[],
): Candidate | null {
  const usedIds = new Set(already.map((c) => c.item.id));
  const teaching = data.catalog.filter(
    (i) =>
      i.kind === "course" &&
      !usedIds.has(i.id) &&
      i.skillsTaught.some((t) => t.skillId === need.skillId && t.level >= need.level),
  );
  if (teaching.length === 0) return null;
  // Score against a one-skill gap so the breakdown is meaningful in the evidence.
  const pseudoGap: Gap[] = [
    {
      skillId: need.skillId,
      targetLevel: need.level as Gap["targetLevel"],
      currentLevel: (profile.skills[need.skillId]?.level ?? 0) as Gap["currentLevel"],
      reason: "goal",
      graphPath: [need.skillId],
    },
  ];
  const gapIds = new Set(gap.map((g) => g.skillId));
  const scored = scoreCandidates(pseudoGap, profile, { catalog: teaching, embeddings: data.embeddings });
  // Prefer courses that also touch the real gap, then shortest.
  scored.sort(
    (a, b) =>
      Number(b.item.skillsTaught.some((t) => gapIds.has(t.skillId))) -
        Number(a.item.skillsTaught.some((t) => gapIds.has(t.skillId))) ||
      b.breakdown.total / b.item.durationHours - a.breakdown.total / a.item.durationHours,
  );
  return scored[0] ?? null;
}

export type PhaseExtras = { project?: Candidate; assessment?: Candidate };

/**
 * Projects are selected after courses: one per phase whose skillsRequired are met by the
 * profile plus everything taught up to and including that phase, and which touches a
 * skill that phase teaches. Assessments attach at the phase boundary under the same rule,
 * additionally requiring every assessed skill to be known by then.
 */
export function attachPhaseExtras(
  phases: Candidate[][],
  candidates: Candidate[],
  profile: Profile,
  budgetHours: number,
): { phases: PhaseExtras[]; usedHours: number } {
  const used = new Set<string>();
  let usedHours = 0;
  const out: PhaseExtras[] = [];
  const known = achievedLevels(profile, []);

  for (const phase of phases) {
    const phaseSkills = new Set(phase.flatMap((c) => c.item.skillsTaught.map((t) => t.skillId)));
    for (const c of phase) {
      for (const t of c.item.skillsTaught) {
        known.set(t.skillId, Math.max(known.get(t.skillId) ?? 0, t.level));
      }
    }
    const touchesPhase = (item: CatalogItem) =>
      [...item.skillsRequired, ...item.skillsTaught].some((s) => phaseSkills.has(s.skillId));
    const pick = (kind: CatalogItem["kind"], extra: (item: CatalogItem) => boolean) => {
      const found = candidates.find(
        (c) =>
          c.item.kind === kind &&
          !used.has(c.item.id) &&
          usedHours + c.item.durationHours <= budgetHours &&
          unmetRequirements(c.item, known).length === 0 &&
          touchesPhase(c.item) &&
          extra(c.item),
      );
      if (found) {
        used.add(found.item.id);
        usedHours += found.item.durationHours;
      }
      return found;
    };
    const project = pick("project", () => true);
    if (project) {
      for (const t of project.item.skillsTaught) {
        known.set(t.skillId, Math.max(known.get(t.skillId) ?? 0, t.level));
      }
    }
    const assessment = pick("assessment", (item) =>
      item.skillsTaught.every((t) => (known.get(t.skillId) ?? 0) >= 1),
    );
    out.push({ project, assessment });
  }
  return { phases: out, usedHours };
}
