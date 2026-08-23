/** Client-safe half of the trust numbers: the type the landing components receive and the count format. */
export type TrustNumbers = {
  authoredEdges: number;
  observable: number;
  /** observable / authoredEdges, rounded to a whole percent. */
  observablePct: number;
  confirmedAny: number;
  confirmedPct: number;
  confirmedBoth: number;
  contradicted: number;
  resolved: number;
  promoted: number;
  skills: number;
  /** Goal templates in goals.json — the roles a learner can pick. */
  goalTemplates: number;
  catalogItems: number;
  /** Distinct providers in catalog.json. */
  providers: number;
  /** Stack Overflow users eligible after the cohort filter. */
  soUsers: number;
  /** Coursera pseudo-learners with at least one ordered course pair. */
  courseraLearners: number;
  anchor: { from: string; to: string };
};

/** "2.1 M", "72,774" — the landing's compact count format; never rounds up past the data. */
export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(Math.floor(n / 100_000) / 10).toFixed(1)} M`;
  return new Intl.NumberFormat("en-US").format(n);
}
