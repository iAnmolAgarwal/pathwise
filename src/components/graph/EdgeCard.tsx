"use client";

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import type { GraphEdge, GraphEdgeSource, GraphEvidence } from "@/lib/graphEvidence";
import type { EvidenceSource, SkillEdge } from "@/schemas";
import { edgeCardLines } from "@/lib/edgeCard";
import { cn } from "@/lib/utils";

import styles from "./graph.module.css";

/** Evidence tier of an edge (§9.3). Since the de-clutter pass every arrow is drawn alike; the tier shows only inside the card's details. */
export type EdgeTier = "both" | "one" | "none" | "review" | "promoted" | "candidate";

export const TIER_OF: Record<SkillEdge["status"], EdgeTier> = {
  "confirmed-both": "both",
  "confirmed-one-source": "one",
  "no-data": "none",
  "contradicted-in-review": "review",
  promoted: "promoted",
  candidate: "candidate",
};

export const TIER_STYLE: Record<EdgeTier, { label: string; hint: string; marker: string }> = {
  both: { label: "Confirmed by both sources", hint: "Stack Overflow and Coursera both show learners taking these in this order", marker: "rgba(255,255,255,0.42)" },
  one: { label: "Confirmed by one source", hint: "One source shows this order; the other has no data on the pair or is inconclusive", marker: "rgba(255,255,255,0.30)" },
  none: { label: "No confirming data yet", hint: "Hand-built prerequisite; no source observed the pair above the support floor, or what it saw is inconclusive", marker: "rgba(255,255,255,0.16)" },
  review: { label: "Contradicted, in review", hint: "A source shows the opposite order at high confidence; a human reviews it, the authored link still drives paths", marker: "rgba(242,181,68,0.85)" },
  promoted: { label: "Promoted from learner data", hint: "A mined link a human promoted; it drives paths like an authored one", marker: "rgba(255,255,255,0.42)" },
  candidate: { label: "Mined candidate", hint: "Suggested by learner sequences above the promotion thresholds; display and evidence only, never used to build a path", marker: "rgba(255,255,255,0.30)" },
};

const SOURCE_LABEL: Record<EvidenceSource, { name: string; attribution: string }> = {
  stackoverflow: { name: "Stack Overflow", attribution: "question order · CC BY-SA 4.0" },
  coursera: { name: "Coursera reviews", attribution: "review order · Kaggle corpus 2015–2020" },
};

const fmt = new Intl.NumberFormat("en-US");
const pct = (x: number) => `${Math.round(x * 100)} %`;

function statusLine(edge: GraphEdge, t: GraphEvidence["thresholds"]): string {
  const base = TIER_STYLE[TIER_OF[edge.status]].label;
  if (edge.status === "contradicted-in-review" && edge.resolution) {
    const d = edge.resolution.decision.replace(/-/g, " ");
    return `Contradicted by a source · reviewed: ${d}`;
  }
  if (edge.status === "candidate") return "Mined candidate · not used to build paths";
  if (edge.status === "no-data") {
    return Object.keys(edge.sources).length > 0
      ? `Observed, but below the confirm floor (${Math.round(t.confirmConfidence * 100)} % with n ≥ ${t.confirmN})`
      : "No learner data yet";
  }
  return base;
}

type Props = {
  edge: GraphEdge;
  evidence: GraphEvidence;
  nameOf: (id: string) => string;
  x: number;
  y: number;
  pinned: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
  /** Open with the details expanded (the landing badge lands here). */
  defaultOpen?: boolean;
};

const W = 340;
const PAD = 12;

/**
 * The click card for one prerequisite link (§9.4 de-clutter): three plain lines — what the link
 * claims, how many of the two sources verify it, the larger source's count and share — and a
 * "details" expander that opens the full provenance: each source's support, reverse, confidence
 * and n, the tags or course pairs behind the numbers, the source caveat and any review note (N-2).
 * Every number shown here is copied from skill_edges.json; nothing is computed in the client
 * beyond formatting. Hover previews the three lines; a click pins the card.
 */
export function EdgeCard({ edge, evidence, nameOf, x, y, pinned, canvasWidth, canvasHeight, onMouseEnter, onMouseLeave, onClose, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const tier = TIER_OF[edge.status];
  const lines = edgeCardLines(edge, nameOf, evidence.thresholds);
  // Keep the card inside the canvas: open to the left near the right edge, upward in the lower half,
  // and let a tall card scroll rather than spill out.
  const left = canvasWidth && x + PAD + W > canvasWidth ? Math.max(PAD, x - PAD - W) : x + PAD;
  const below = !canvasHeight || y < canvasHeight * 0.55;
  const vertical = below ? { top: y + PAD } : { bottom: canvasHeight - y + PAD };
  const maxHeight = canvasHeight ? Math.max(160, (below ? canvasHeight - y : y) - 2 * PAD) : undefined;
  const sources = (["stackoverflow", "coursera"] as const).filter((s) => edge.sources[s]);
  const showDetails = pinned && open;

  return (
    <div
      className={cn(styles.popover, pinned && styles.popoverPinned)}
      style={{ left, width: W, maxHeight, ...vertical }}
      role={pinned ? "dialog" : "tooltip"}
      aria-label={`${lines.order}: learner evidence`}
      data-testid="edge-card"
      data-state={showDetails ? "details" : "summary"}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <header className={styles.popoverHead}>
        <p className={styles.cardOrder} data-testid="edge-card-order">
          <strong>{nameOf(edge.from)}</strong> before <strong>{nameOf(edge.to)}</strong>
        </p>
        {pinned && (
          <button type="button" className={styles.popoverClose} onClick={onClose} aria-label="Close">
            <X />
          </button>
        )}
      </header>
      <p className={cn(styles.cardVerdict, styles[`cardVerdict_${lines.verdictKind}`])} data-testid="edge-card-verdict">
        {lines.verdict}
      </p>
      {lines.count && (
        <p className={styles.cardCount} data-testid="edge-card-count">
          {lines.count}
        </p>
      )}

      {pinned ? (
        <button type="button" className={styles.cardDetailsToggle} onClick={() => setOpen((v) => !v)} aria-expanded={showDetails} data-testid="edge-card-details-toggle">
          <ChevronDown aria-hidden className={cn(styles.cardChevron, showDetails && styles.cardChevronOpen)} />
          {showDetails ? "hide details" : "details"}
        </button>
      ) : (
        <p className={styles.popoverHint}>Click the link for details</p>
      )}

      {showDetails && (
        <div className={styles.cardDetails} data-testid="edge-card-details">
          <p className={cn(styles.popoverStatus, styles[`popoverStatus_${tier}`])}>
            <svg className={styles.swatch} width="28" height="8" viewBox="0 0 28 8" aria-hidden>
              <line x1="1" y1="4" x2="27" y2="4" className={cn(styles.swatchLine, styles[`tier_${tier}`])} />
            </svg>
            {statusLine(edge, evidence.thresholds)}
          </p>

          {sources.length === 0 ? (
            <p className={styles.popoverEmpty}>Neither source observed these two skills together above its support floor. The link is a hand-built prerequisite.</p>
          ) : (
            <ul className={styles.popoverSources}>
              {sources.map((s) => (
                <SourceBlock key={s} source={s} stat={edge.sources[s]!} edge={edge} evidence={evidence} nameOf={nameOf} />
              ))}
            </ul>
          )}

          {edge.resolution && (
            <p className={styles.popoverNote}>
              <span className="label-caps">Review note</span> {edge.resolution.note} <span className={styles.popoverDate}>({edge.resolution.date})</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SourceBlock({ source, stat, edge, evidence, nameOf }: { source: EvidenceSource; stat: GraphEdgeSource; edge: GraphEdge; evidence: GraphEvidence; nameOf: (id: string) => string }) {
  const label = SOURCE_LABEL[source];
  return (
    <li className={styles.popoverSource}>
      <p className={styles.popoverSourceHead}>
        <span className={styles.popoverSourceName}>{label.name}</span>
        <span className={styles.popoverAttribution}>{label.attribution}</span>
      </p>
      <dl className={styles.popoverStats}>
        <div>
          <dt>took {nameOf(edge.from)} first</dt>
          <dd>{fmt.format(stat.support)}</dd>
        </div>
        <div>
          <dt>took {nameOf(edge.to)} first</dt>
          <dd>{fmt.format(stat.reverse)}</dd>
        </div>
        <div>
          <dt>in this order</dt>
          <dd>{pct(stat.confidence)}</dd>
        </div>
        <div>
          <dt>n</dt>
          <dd>{fmt.format(stat.n)}</dd>
        </div>
      </dl>
      {source === "stackoverflow" && (
        <p className={styles.popoverDetail}>
          <span className={styles.popoverDetailKey}>tags</span>{" "}
          {[...(evidence.soTags[edge.from] ?? []), ...(evidence.soTags[edge.to] ?? [])].join(", ") || "—"}
        </p>
      )}
      {source === "coursera" && (
        <p className={styles.popoverDetail}>
          <span className={styles.popoverDetailKey}>{stat.nCoursePairs === 1 ? "course pair" : `${stat.nCoursePairs ?? 0} course pairs`}</span>{" "}
          {(stat.coursePairs ?? []).map((p) => `${p.from} → ${p.to} (${fmt.format(p.support)})`).join("; ") || "—"}
        </p>
      )}
      <p className={styles.popoverCaveat}>{evidence.caveats[source]}</p>
    </li>
  );
}
