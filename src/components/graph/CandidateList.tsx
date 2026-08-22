"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { edgeCardLines } from "@/lib/edgeCard";
import type { GraphEdge, GraphEvidence } from "@/lib/graphEvidence";
import { SOURCE_NAME, formatCount, formatPct } from "@/lib/learnerEvidence";
import { cn } from "@/lib/utils";

import styles from "./graph.module.css";

type Props = { candidates: GraphEdge[]; skillId: string; evidence: GraphEvidence; nameOf: (id: string) => string };

/**
 * Mined candidate links around the selected skill (§15.6): never drawn on the canvas, never
 * used to build a path; listed here, collapsed, with each source's share, n and caveat (N-2)
 * so the promotion queue pipeline/sources/promotions.md is visible in the product.
 */
export function CandidateList({ candidates, skillId, evidence, nameOf }: Props) {
  const [open, setOpen] = useState(false);
  if (candidates.length === 0) return null;
  return (
    <div className={styles.candidates} data-testid="graph-candidates" data-state={open ? "open" : "closed"}>
      <button type="button" className={styles.candidatesToggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ChevronDown aria-hidden className={cn(styles.cardChevron, open && styles.cardChevronOpen)} />
        {candidates.length} mined candidate link{candidates.length === 1 ? "" : "s"} · not drawn, not used to build paths
      </button>
      {open && (
        <ul className={styles.candidateList}>
          {candidates.map((e) => {
            const lines = edgeCardLines(e, nameOf, evidence.thresholds);
            const other = e.from === skillId ? `→ ${nameOf(e.to)}` : `${nameOf(e.from)} →`;
            return (
              <li key={`${e.from}->${e.to}`} className={styles.candidate}>
                <span className={styles.candidateName}>{e.from === skillId ? `${nameOf(skillId)} ${other}` : `${other} ${nameOf(skillId)}`}</span>
                <span className={styles.candidateVerdict}>{lines.verdict}</span>
                {(["stackoverflow", "coursera"] as const).map((s) => {
                  const stat = e.sources[s];
                  if (!stat) return null;
                  return (
                    <span key={s} className={styles.candidateStat}>
                      {SOURCE_NAME[s]}: {formatCount(stat.support)} this way, {formatCount(stat.reverse)} the other ({formatPct(stat.confidence)}, n {formatCount(stat.n)}) · <em>{evidence.caveats[s]}</em>
                    </span>
                  );
                })}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
