import type { CatalogItem, Dislikes, Preferences, Profile, ScoreBreakdown } from "../schemas";
import { centroid, cosine } from "./similarity";
import type { Candidate, Gap } from "./types";

/** Hybrid score weights (§5.2). Documented in the solution doc; changing them is a tuning decision. */
export const ENGINE_WEIGHTS = {
  coverage: 0.4,
  levelFit: 0.15,
  preferenceFit: 0.15,
  quality: 0.1,
  similarity: 0.2,
} as const;

export type EngineWeights = { [K in keyof typeof ENGINE_WEIGHTS]: number };

/** Levels still to gain for a gap skill. */
export function levelsMissing(gap: Gap): number {
  return Math.max(0, gap.targetLevel - gap.currentLevel);
}

/**
 * gapCoverage = Σ levels of gap skills this item advances / Σ levels missing across the gap.
 * An item teaching level L of a skill with current c and target t contributes clamp(min(L,t) − c, 0).
 */
export function coverageOf(
  item: CatalogItem,
  gap: Gap[],
): { coverage: number; gapSkills: Candidate["gapSkills"] } {
  const gapById = new Map(gap.map((g) => [g.skillId, g]));
  const gapSkills: Candidate["gapSkills"] = [];
  let gained = 0;
  for (const taught of item.skillsTaught) {
    const g = gapById.get(taught.skillId);
    if (!g) continue;
    const levelsGained = Math.max(0, Math.min(taught.level, g.targetLevel) - g.currentLevel);
    if (levelsGained === 0) continue;
    gapSkills.push({ skillId: g.skillId, taughtLevel: taught.level, levelsGained });
    gained += levelsGained;
  }
  const total = gap.reduce((sum, g) => sum + levelsMissing(g), 0);
  return { coverage: total === 0 ? 0 : gained / total, gapSkills };
}

/**
 * levelFit = 1 − |difficulty − ideal| / 4, where ideal difficulty (1–5) rises linearly with
 * the learner's mean current level (0–3) across the gap skills the item teaches.
 */
export function levelFit(item: CatalogItem, gap: Gap[], profile: Profile): number {
  const gapIds = new Set(gap.map((g) => g.skillId));
  const relevant = item.skillsTaught.filter((t) => gapIds.has(t.skillId));
  const levels: number[] = relevant.map((t) => profile.skills[t.skillId]?.level ?? 0);
  const mean = levels.length === 0 ? 0 : levels.reduce((a, b) => a + b, 0) / levels.length;
  const ideal = 1 + (mean / 3) * 4;
  return clamp01(1 - Math.abs(item.difficulty - ideal) / 4);
}

/** Each disliked provider/format memo (§5.5 not_interested) halves the preference fit. */
export const DISLIKE_PENALTY = 0.5;

/**
 * Mean of three sub-fits: format ∈ prefs, cost within budget, duration vs weekly hours;
 * then scaled down for every dislike memo the item matches.
 */
export function preferenceFit(item: CatalogItem, prefs: Preferences, dislikes?: Dislikes): number {
  const formatFit =
    prefs.formats.length === 0 || prefs.formats.includes(item.format) ? 1 : 0.25;
  const costFit =
    prefs.budget === "any" ? 1 : item.cost === "free" ? 1 : item.cost === "freemium" ? 0.5 : 0;
  // Full marks up to two weeks of the learner's hours; linear decay to zero at ten weeks.
  const weeks = item.durationHours / prefs.hoursPerWeek;
  const durationFit = clamp01(1 - Math.max(0, weeks - 2) / 8);
  let fit = (formatFit + costFit + durationFit) / 3;
  if (dislikes?.providers.includes(item.provider)) fit *= DISLIKE_PENALTY;
  if (dislikes?.formats.includes(item.format)) fit *= DISLIKE_PENALTY;
  return fit;
}

/**
 * Score every catalog item that advances at least one gap skill (§5.2). All five
 * components are returned per candidate so the Evidence object can log them verbatim.
 */
export function scoreCandidates(
  gap: Gap[],
  profile: Profile,
  data: { catalog: CatalogItem[]; embeddings: Record<string, number[]> },
  weights: EngineWeights = ENGINE_WEIGHTS,
): Candidate[] {
  if (gap.length === 0) return [];
  const goalCentroid = centroid(
    gap.map((g) => data.embeddings[g.skillId]).filter((v): v is number[] => Array.isArray(v)),
  );

  const candidates: Candidate[] = [];
  const excluded = new Set(profile.dislikes?.catalogIds ?? []);
  for (const item of data.catalog) {
    if (excluded.has(item.id)) continue;
    const { coverage, gapSkills } = coverageOf(item, gap);
    if (gapSkills.length === 0) continue;
    const itemVec = data.embeddings[item.id];
    const similarity =
      goalCentroid && itemVec ? clamp01(cosine(itemVec, goalCentroid)) : 0;
    const breakdown: ScoreBreakdown = {
      coverage,
      levelFit: levelFit(item, gap, profile),
      preferenceFit: preferenceFit(item, profile.preferences, profile.dislikes),
      quality: clamp01(item.qualityPrior),
      similarity,
      total: 0,
    };
    breakdown.total =
      weights.coverage * breakdown.coverage +
      weights.levelFit * breakdown.levelFit +
      weights.preferenceFit * breakdown.preferenceFit +
      weights.quality * breakdown.quality +
      weights.similarity * breakdown.similarity;
    candidates.push({ item, breakdown, gapSkills });
  }

  return candidates.sort(
    (a, b) => b.breakdown.total - a.breakdown.total || a.item.id.localeCompare(b.item.id),
  );
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
