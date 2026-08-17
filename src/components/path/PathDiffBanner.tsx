"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { PathDiff } from "@/schemas";

import type { CatalogLite } from "./PathBuilder";
import styles from "./diff.module.css";

type Props = {
  diff: PathDiff;
  version: number;
  catalog: Record<string, CatalogLite>;
  onDismiss: () => void;
};

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const list = (titles: string[]) =>
  titles.length <= 1 ? titles.join("") : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;

/** One sentence a learner can read: "Swapped X for Y because you found Z too hard." */
export function diffHeadline(diff: PathDiff, title: (id: string) => string): string {
  const because = `because ${lowerFirst(diff.cause.humanReadable)}`;
  const added = diff.added.map((d) => title(d.catalogId));
  const removed = diff.removed.map((d) => title(d.catalogId));
  if (added.length === 1 && removed.length === 1) return `Swapped ${removed[0]} for ${added[0]} ${because}.`;
  const parts: string[] = [];
  if (added.length) parts.push(`added ${list(added)}`);
  if (removed.length) parts.push(`removed ${list(removed)}`);
  if (!parts.length && diff.reordered) return `Reordered your path ${because}.`;
  if (!parts.length) return `Nothing on the path needed to change — ${lowerFirst(diff.cause.humanReadable)}, so your skill levels were updated.`;
  const sentence = parts.join(" and ");
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}${diff.reordered ? ", and reordered the rest," : ""} ${because}.`;
}

/** The path diff is a first-class UI object (§5.5): the loudest thing on the screen, never buried. */
export function PathDiffBanner({ diff, version, catalog, onDismiss }: Props) {
  const reduce = useReducedMotion() ?? false;
  const title = (id: string) => catalog[id]?.title ?? id;
  const changed = diff.added.length + diff.removed.length;

  return (
    <motion.section
      className={styles.banner}
      role="status"
      aria-live="polite"
      data-testid="path-diff"
      initial={reduce ? false : { opacity: 0, y: -14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.985, transition: { duration: 0.25 } }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.beam} aria-hidden />
      <div className={styles.head}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden />
          Path updated
          <span className={styles.version}>v{version}</span>
          {changed > 0 && (
            <span className={styles.count}>
              {changed} {changed === 1 ? "change" : "changes"}
            </span>
          )}
        </p>
        <button type="button" onClick={onDismiss} className={styles.dismiss} aria-label="Dismiss path update">
          <X />
        </button>
      </div>
      <p className={styles.headline}>{diffHeadline(diff, title)}</p>

      {(diff.added.length > 0 || diff.removed.length > 0) && (
        <div className={styles.changes}>
          <ChangeList heading="Added" kind="added" items={diff.added} title={title} />
          <ChangeList heading="Removed" kind="removed" items={diff.removed} title={title} />
        </div>
      )}
      {diff.reordered && <p className={styles.footnote}>Some remaining items were reordered to respect prerequisites.</p>}
    </motion.section>
  );
}

function ChangeList({ heading, kind, items, title }: { heading: string; kind: "added" | "removed"; items: PathDiff["added"]; title: (id: string) => string }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.changeCol}>
      <p className={styles.changeHeading}>{heading}</p>
      <ul className={styles.changeList}>
        {items.map((d) => (
          <li key={d.catalogId} className={styles.change} data-kind={kind}>
            <span className={styles.sign} aria-hidden>
              {kind === "added" ? "+" : "−"}
            </span>
            <span className={styles.changeTitle}>{title(d.catalogId)}</span>
            <span className={styles.changeReason}>{d.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
