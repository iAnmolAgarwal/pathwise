import type { GraphEdge, GraphEdgeSource } from "@/lib/graphEvidence";
import { SOURCE_NAME, formatCount, formatPct } from "@/lib/learnerEvidence";
import type { EvidenceSource } from "@/schemas";

/** The two sources the pipeline mines; the card always says "of 2" so a stranger knows the denominator. */
export const SOURCE_TOTAL = 2;
const SOURCES: readonly EvidenceSource[] = ["stackoverflow", "coursera"];

export type EdgeCardLines = {
  /** "JavaScript before React" */
  order: string;
  /** "Verified by 1 of 2 sources" · "No confirming data yet" · "Under review" · "Mined candidate · not used to build paths" */
  verdict: string;
  verdictKind: "verified" | "none" | "review" | "candidate";
  /** Confirming sources, by the pipeline's own floor. */
  confirmedBy: EvidenceSource[];
  /** "64,595 learners, 78 % in this order · Stack Overflow" from the largest source; absent when no source has data. */
  count: string | null;
  /** The source the count line quotes. */
  lead: EvidenceSource | null;
};

/**
 * The arrow the landing trust badge opens the graph on: the authored, path-driving link with
 * the most Stack Overflow sequences among those both sources confirm (python → python-data-analysis,
 * 0.951 / n 54,067 and 0.864 / n 568 at build time). javascript → react, the obvious pick, is a
 * mined candidate in this data and is not drawn by default, so it cannot anchor.
 */
export const BADGE_ANCHOR_EDGE = { from: "python", to: "python-data-analysis" } as const;

export type ConfirmFloor = { confirmConfidence: number; confirmN: number };

/** A source confirms the authored direction at the merge_edges.py floor (§15.5). */
export function sourceConfirms(stat: GraphEdgeSource | undefined, floor: ConfirmFloor): boolean {
  return !!stat && stat.confidence >= floor.confirmConfidence && stat.n >= floor.confirmN;
}

/** The source with the most sequences behind the pair. */
export function leadSource(edge: GraphEdge): EvidenceSource | null {
  let best: EvidenceSource | null = null;
  for (const s of SOURCES) {
    const stat = edge.sources[s];
    if (stat && (best === null || stat.n > edge.sources[best]!.n)) best = s;
  }
  return best;
}

/**
 * The three lines of the click card (§9.4 de-clutter): what the link claims, how many of the
 * two sources confirm it, and the largest source's count and share. Every number is copied
 * from skill_edges.json; the verdict follows the edge status the pipeline wrote, never a
 * client-side re-judgement. Shares are order shares, not ratings (N-5).
 */
export function edgeCardLines(edge: GraphEdge, nameOf: (id: string) => string, floor: ConfirmFloor): EdgeCardLines {
  const confirmedBy = SOURCES.filter((s) => sourceConfirms(edge.sources[s], floor));
  const lead = leadSource(edge);
  const stat = lead ? edge.sources[lead]! : null;
  const count = lead && stat ? `${formatCount(stat.n)} learners, ${formatPct(stat.confidence)} in this order · ${SOURCE_NAME[lead]}` : null;
  const order = `${nameOf(edge.from)} before ${nameOf(edge.to)}`;
  if (edge.status === "contradicted-in-review") return { order, verdict: "Under review", verdictKind: "review", confirmedBy, count, lead };
  if (edge.status === "candidate") return { order, verdict: "Mined candidate · not used to build paths", verdictKind: "candidate", confirmedBy, count, lead };
  if (confirmedBy.length === 0) return { order, verdict: "No confirming data yet", verdictKind: "none", confirmedBy, count, lead };
  return { order, verdict: `Verified by ${confirmedBy.length} of ${SOURCE_TOTAL} sources`, verdictKind: "verified", confirmedBy, count, lead };
}
