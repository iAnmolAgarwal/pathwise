"use client";

import { useMemo } from "react";

import type { ProfileStats } from "@/engine/profileStats";

import styles from "./stats.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * `listFeedbackDays` returns distinct days today, so every active day lands on level 1.
 * The ramp is kept because it becomes meaningful the moment that query returns per-event
 * rows, with no change here.
 */
const level = (count: number) => (count === 0 ? 0 : count >= 6 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : 1);

/** Activity calendar: one cell per day, weeks running left to right, weekdays top to bottom. */
export function ActivityHeatmap({ stats }: { stats: ProfileStats | null }) {
  const days = stats?.activity.days;

  // A month label sits above the first column that month occupies.
  const months = useMemo(() => {
    if (!days) return [];
    const out: { key: string; label: string; span: number }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const month = days[i].day.slice(0, 7);
      const last = out.at(-1);
      if (last && last.key === month) last.span++;
      else out.push({ key: month, label: MONTHS[Number(days[i].day.slice(5, 7)) - 1], span: 1 });
    }
    // Absorb a stray leading column so the first label is not clipped.
    if (out.length > 1 && out[0].span === 1) {
      out[1].span += out.shift()!.span;
    }
    return out;
  }, [days]);

  if (!stats || !days) return null;

  return (
    <section className={styles.card} data-testid="activity-calendar">
      <div className={styles.head}>
        <div>
          <p className={styles.label}>Activity</p>
          <p className={styles.hint}>
            {stats.activity.activeDays} active {stats.activity.activeDays === 1 ? "day" : "days"} since {stats.activity.from}
          </p>
        </div>
      </div>

      <div className={styles.calendar}>
        <div className={styles.months} aria-hidden>
          {months.map((m) => (
            <span key={m.key} style={{ width: `${m.span * 14 - 3}px` }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className={styles.grid} role="img" aria-label={`Activity calendar: ${stats.activity.activeDays} active days since ${stats.activity.from}`}>
          {days.map((d) => (
            <span key={d.day} className={styles.day} data-level={level(d.count)} title={`${d.day} — ${d.count === 0 ? "no activity" : `${d.count} event${d.count === 1 ? "" : "s"}`}`} />
          ))}
        </div>
      </div>

      <div className={styles.foot}>
        <span>Days you gave feedback on an item</span>
        <span className={styles.scale}>
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={styles.day} data-level={l} />
          ))}
          More
        </span>
      </div>
    </section>
  );
}
