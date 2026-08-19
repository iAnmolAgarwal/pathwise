import type { Evidence, LearnerEvidenceEdge } from "@/schemas";

/**
 * The confirm floor from merge_edges.py (§15.5): a source confirms a direction at confidence ≥ 0.70
 * with n ≥ 20. Mirrored here only to choose the verb on the evidence card; tests pin it to the
 * thresholds recorded in skill_edges.json.
 */
export const CONFIRM_CONFIDENCE = 0.7;
export const CONFIRM_N = 20;

export const SOURCE_NAME: Record<LearnerEvidenceEdge["source"], string> = {
  stackoverflow: "Stack Overflow",
  coursera: "Coursera reviews",
};

const fmt = new Intl.NumberFormat("en-US");
export const formatPct = (x: number) => `${Math.round(x * 100)} %`;
export const formatCount = (n: number) => fmt.format(n);

export type LearnerEvidenceLine = {
  /** The entry the headline is built from: the largest-n source across the cited edges. */
  lead: LearnerEvidenceEdge;
  confirmed: boolean;
  text: string;
};

/**
 * The one-line provenance claim on an evidence card (§7 rendering 3). The lead entry is the
 * confirming source with the most sequences (or, when nothing confirms, the largest source);
 * the verb follows the pipeline's confirm floor so a card never says "confirmed" for a
 * direction the data does not support.
 */
export function learnerEvidenceLine(learner: Evidence["learnerEvidence"]): LearnerEvidenceLine | null {
  const edges = learner?.edges ?? [];
  if (edges.length === 0) return null;
  const confirms = (e: LearnerEvidenceEdge) => e.confidence >= CONFIRM_CONFIDENCE && e.n >= CONFIRM_N;
  const largest = (list: LearnerEvidenceEdge[]) => list.reduce((best, e) => (e.n > best.n ? e : best), list[0]);
  const confirming = edges.filter(confirms);
  const lead = confirming.length > 0 ? largest(confirming) : largest(edges);
  const confirmed = confirms(lead);
  const pct = formatPct(lead.confidence);
  const text = confirmed
    ? `Confirmed by ${formatCount(lead.support)} learner sequences (${pct} took these in this order)`
    : `Seen in ${formatCount(lead.n)} learner sequences (${pct} took these in this order)`;
  return { lead, confirmed, text };
}

/** What one unit of nTotal is, per source: Stack Overflow counts askers, Coursera counts pseudo-learners. */
export const POPULATION_NOUN: Record<LearnerEvidenceEdge["source"], string> = {
  stackoverflow: "Stack Overflow users",
  coursera: "Coursera learners",
};

/** Share formatting for the card and the overlay: a share that rounds to 0 % is shown as "< 1 %", never as 0 %. */
export const formatShare = (x: number) => (x > 0 && x < 0.005 ? "< 1 %" : formatPct(x));

export type BranchLine = {
  text: string;
  /** Population and counts behind the share, spelled out for the tooltip. */
  detail: string;
  source: string;
  caveat: string;
};

/**
 * "Learners like you" (§15.8): the transition share into this item's primary gap skill from a
 * skill the learner already has, with n. The engine attached it only above the floors
 * (nTotal ≥ 50, n ≥ 5); the card always shows the source and its caveat next to the share (N-2, N-5).
 */
export function branchLine(learner: Evidence["learnerEvidence"], skillName: (id: string) => string): BranchLine | null {
  const b = learner?.branch;
  if (!b) return null;
  return {
    text: `Learners like you: ${formatShare(b.shareShrunk)} took this next (n = ${formatCount(b.toThis)})`,
    detail: `Of ${formatCount(b.nTotal)} ${POPULATION_NOUN[b.source]} who learned ${skillName(b.from)}, ${formatCount(b.toThis)} went to this skill next. Transition share, shrunk toward the observed next-skills.`,
    source: SOURCE_NAME[b.source],
    caveat: b.caveat,
  };
}
