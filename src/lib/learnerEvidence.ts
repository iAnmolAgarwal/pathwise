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
