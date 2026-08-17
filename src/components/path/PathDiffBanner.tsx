"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { PathDiff } from "@/schemas";

import type { CatalogLite } from "./types";
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

      {(diff.added.length > 0 || diff.removed.length > 0) && <ChangeGrid added={diff.added} removed={diff.removed} title={title} />}
      {diff.reordered && <p className={styles.footnote}>Some remaining items were reordered to respect prerequisites.</p>}
    </motion.section>
  );
}

/** Added and removed side by side, row-aligned so the two columns always match. */
function ChangeGrid({ added, removed, title }: { added: PathDiff["added"]; removed: PathDiff["removed"]; title: (id: string) => string }) {
  const rows = Math.max(added.length, removed.length);
  return (
    <div className={styles.changes} role="table" aria-label="Changes to your path">
      <p className={styles.changeHeading} role="columnheader">
        Added <span className={styles.changeCount}>{added.length}</span>
      </p>
      <p className={styles.changeHeading} role="columnheader">
        Removed <span className={styles.changeCount}>{removed.length}</span>
      </p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.changeRow} role="row">
          <ChangeCell kind="added" item={added[i]} title={title} />
          <ChangeCell kind="removed" item={removed[i]} title={title} />
        </div>
      ))}
    </div>
  );
}

function ChangeCell({ kind, item, title }: { kind: "added" | "removed"; item?: PathDiff["added"][number]; title: (id: string) => string }) {
  if (!item) return <div className={styles.changeEmpty} role="cell" aria-hidden />;
  return (
    <div className={styles.change} data-kind={kind} role="cell">
      <span className={styles.sign} aria-hidden>
        {kind === "added" ? "+" : "−"}
      </span>
      <span className={styles.changeTitle}>{title(item.catalogId)}</span>
      <span className={styles.changeReason}>{item.reason}</span>
    </div>
  );
}
