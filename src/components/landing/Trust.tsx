import { ArrowRight, Bot, Calculator, Map as MapIcon, RefreshCw, ShieldCheck, Sprout } from "lucide-react";
import Link from "next/link";

import { graphQuery } from "@/lib/graphLink";
import { compactCount, type TrustNumbers } from "@/lib/trustFormat";

import styles from "./trust.module.css";

/**
 * The three landing sections of the UI story pass (§9.4): how it works in three plain sentences,
 * the trust badge with the agreement report's numbers, and the keep-fresh cards (§17). All copy
 * signed off 2026-08-22; every number arrives through TrustNumbers, never typed here.
 */

const HOW = [
  { icon: Bot, label: "The talker", text: "Nova asks what you want and what you already know, then explains every pick in plain words." },
  { icon: Calculator, label: "The matcher", text: "A scoring formula picks the courses and puts them in order. You can read every number behind every pick — there is no black box." },
  { icon: MapIcon, label: "The map", text: "A hand-built map of which skill comes before which, checked against real learners' order on Stack Overflow and Coursera. Click any arrow to see who agreed." },
];

export function HowItWorks({ id }: { id?: string }) {
  return (
    <section id={id} className={styles.section} aria-labelledby="how-heading">
      <p className={styles.label}>How it works</p>
      <h2 id="how-heading" className={styles.heading}>
        Three parts. One of them is a person.
      </h2>
      <ul className={styles.how}>
        {HOW.map((h) => (
          <li key={h.label} className={styles.howCard}>
            <span className={styles.howIcon} aria-hidden>
              <h.icon />
            </span>
            <p className={styles.howLabel}>{h.label}</p>
            <p className={styles.howText}>{h.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TrustBadge({ id, numbers, appHref = "/learn" }: { id?: string; numbers: TrustNumbers; appHref?: string }) {
  const n = numbers;
  const href = `${appHref}${graphQuery(n.anchor)}`;
  return (
    <section id={id} className={`${styles.section} ${styles.trustSection}`} aria-labelledby="trust-heading">
      <p className={styles.label}>Why you can trust the map</p>
      <h2 id="trust-heading" className={styles.heading}>
        Checked against real learners.
      </h2>
      <div className={styles.badge} data-testid="trust-badge">
        <p className={styles.badgeLead}>
          <strong>{n.observable}</strong> of <strong>{n.authoredEdges}</strong> prerequisite links checked against real learners
        </p>
        <ul className={styles.badgeRow}>
          <li>
            <strong>{n.confirmedAny}</strong> confirmed by at least one source <span className={styles.badgePct}>({n.confirmedPct} %)</span>
          </li>
          <li>
            <strong>{n.confirmedBoth}</strong> by both
          </li>
          <li>
            <strong>{n.contradicted}</strong> disputed, <strong>{n.resolved}</strong> reviewed by hand
          </li>
        </ul>
        <Link href={href} className={styles.badgeLink} data-testid="trust-badge-link">
          Every link shows its count <ArrowRight aria-hidden />
        </Link>
        <p className={styles.badgeFoot}>
          Stack Overflow: {compactCount(n.soUsers)} askers&apos; question order. Coursera: {compactCount(n.courseraLearners)} reviewers&apos; review order. Asking and reviewing are not completing — every number on the map says so.
        </p>
      </div>
    </section>
  );
}

export function KeepFresh({ id, numbers }: { id?: string; numbers: TrustNumbers }) {
  const cards = [
    { icon: RefreshCw, label: "Freshness", text: `Every Monday a check visits all ${numbers.catalogItems} course links. A host that blocks robots is reported "unverifiable", never "dead".` },
    { icon: ShieldCheck, label: "Quality gate", text: "Every change to the data runs through validate.py: the skill map must stay a tree without cycles, every course must map to real skills, every number must match its source file. Tests fail if anything drifts." },
    { icon: Sprout, label: "Growth", text: "Designed, gated, deferred: machines may propose new courses, only a person can approve one. Nothing on the map is written by a model." },
  ];
  return (
    <section id={id} className={styles.section} aria-labelledby="fresh-heading">
      <p className={styles.label}>Kept fresh by machines, kept true by people</p>
      <h2 id="fresh-heading" className={styles.heading}>
        Nothing here maintains itself.
      </h2>
      <ul className={styles.how}>
        {cards.map((c) => (
          <li key={c.label} className={styles.howCard}>
            <span className={styles.howIcon} aria-hidden>
              <c.icon />
            </span>
            <p className={styles.howLabel}>{c.label}</p>
            <p className={styles.howText}>{c.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
