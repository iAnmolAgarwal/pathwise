"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BADGE_ANCHOR_EDGE } from "@/lib/edgeCard";
import type { EvidencePlates as Plates } from "@/lib/evidencePlates";
import { graphQuery } from "@/lib/graphLink";
import { formatCount, formatPct } from "@/lib/learnerEvidence";
import { millionsInWords, type TrustNumbers } from "@/lib/trustFormat";

import styles from "./evidence.module.css";
import { useInView } from "./useInView";

/** The signal each source gives, in plain words (§15.2, §15.3). */
const SIGNAL: Record<string, string> = {
  stackoverflow: "The order people first asked about each skill.",
  coursera: "The order people reviewed each course.",
};

/**
 * Evidence: one real prerequisite edge exactly as the app's click card prints it, with the six
 * fields every mined number carries (support, reverse, confidence, n, source, caveat) and a plate
 * per source. Every figure is read from skill_edges.json and the trust numbers at build time.
 */
export function EvidencePlates({ id, numbers, plates }: { id?: string; numbers: TrustNumbers; plates: Plates }) {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef);
  const learners = millionsInWords(numbers.soUsers + numbers.courseraLearners);
  const graphHref = `/learn${graphQuery(BADGE_ANCHOR_EDGE)}`;
  const population: Record<string, number> = {
    stackoverflow: numbers.soUsers,
    coursera: numbers.courseraLearners,
  };

  return (
    <section ref={sectionRef} id={id} className={`${styles.section} ${inView ? "" : styles.quiet}`} aria-labelledby="evidence-title">
      <header className={styles.header}>
        <Badge variant="eyebrow" dot>
          Evidence
        </Badge>
        <h2 id="evidence-title" className={styles.title}>
          We checked the map against {learners} real learners.
        </h2>
        <p className={styles.lead}>
          The map was checked against how real people learned, on Stack Overflow and Coursera. Every number carries its
          source and its limit.
        </p>
      </header>

      <div className={styles.grid}>
        <article className={`${styles.plate} ${styles.wide}`} aria-labelledby="evidence-card-title">
          <div className={styles.plateText}>
            <h3 id="evidence-card-title" className={styles.plateTitle}>
              {plates.card.order}
            </h3>
            <p className={styles.verdict} data-kind={plates.card.verdictKind}>
              {plates.card.verdict}
            </p>
            {plates.card.count ? <p className={styles.count}>{plates.card.count}</p> : null}
            <div className={styles.action}>
              <Button asChild variant="secondary" size="sm">
                <Link href={graphHref}>
                  Open this link in the graph <ArrowUpRight data-icon="inline-end" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
          <div className={styles.figureWrap}>
            <span className={styles.side} aria-hidden>
              {plates.card.verdictKind === "verified" ? "Confirmed by both sources" : plates.card.verdict}
            </span>
            <div className={styles.paper}>
              <div className={styles.edge} aria-hidden>
                <span className={styles.node}>{plates.from}</span>
                <svg className={styles.arrow} width="48" height="12" focusable="false" aria-hidden>
                  <defs>
                    <marker id="evidence-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
                    </marker>
                  </defs>
                  <line className={styles.arrowPath} x1="0" y1="6" x2="calc(100% - 8px)" y2="6" markerEnd="url(#evidence-arrowhead)" />
                </svg>
                <span className={styles.node}>{plates.to}</span>
              </div>
              <dl className={styles.fields}>
                {plates.sources.map((s) => (
                  <div className={styles.fieldRow} key={s.id}>
                    <dt>{s.name}</dt>
                    <dd>
                      <span>
                        <em>support</em> {formatCount(s.support)}
                      </span>
                      <span>
                        <em>reverse</em> {formatCount(s.reverse)}
                      </span>
                      <span>
                        <em>confidence</em> {formatPct(s.confidence)}
                      </span>
                      <span>
                        <em>n</em> {formatCount(s.n)}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </article>

        {plates.sources.map((s) => (
          <article className={styles.plate} key={s.id} aria-labelledby={`evidence-${s.id}`}>
            <div className={styles.figureWrap}>
              <span className={styles.side} aria-hidden>
                Source
              </span>
              <div className={styles.paper}>
                <p className={styles.figure}>{formatCount(population[s.id] ?? s.n)}</p>
                <p className={styles.figureLabel}>{s.id === "stackoverflow" ? "users" : "learners"}</p>
              </div>
            </div>
            <div className={styles.plateText}>
              <h3 id={`evidence-${s.id}`} className={styles.plateTitle}>
                {s.name}
              </h3>
              <p className={styles.caption}>{SIGNAL[s.id]}</p>
              <p className={styles.caveat}>{s.caveat}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
