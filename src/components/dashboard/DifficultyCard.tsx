"use client";

import { motion, useReducedMotion } from "motion/react";

import type { DifficultyBand, ProfileStats } from "@/engine/profileStats";
import { cn } from "@/lib/utils";

import styles from "./stats.module.css";

// Three tokens that already exist in globals.css, escalating easy → hard.
const BAND_COLOR: Record<DifficultyBand, string> = {
  easy: "var(--color-viz)",
  medium: "var(--color-evidence-review)",
  hard: "var(--color-coral)",
};

const R = 57;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Skills completed by difficulty band, LeetCode-style: one ring, three bars. */
export function DifficultyCard({ stats }: { stats: ProfileStats | null }) {
  const reduce = useReducedMotion() ?? false;

  if (!stats) return null;
  const { difficulty, totals } = stats;
  const pct = totals.required === 0 ? 0 : totals.attained / totals.required;

  return (
    <motion.section
      className={styles.card}
      data-testid="difficulty-split"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.head}>
        <div>
          <p className={styles.label}>Skills by difficulty</p>
          <p className={styles.hint}>Bands come from each skill&rsquo;s depth tier, counted against what your goal requires.</p>
        </div>
      </div>

      {totals.required === 0 ? (
        <p className={styles.empty}>Add a goal to see which skills it needs.</p>
      ) : (
        <div className={styles.split}>
          <div className={styles.ring}>
            <svg width={132} height={132} viewBox="0 0 132 132" aria-hidden>
              <circle cx={66} cy={66} r={R} fill="none" stroke="var(--color-viz-track)" strokeWidth={9} />
              <motion.circle
                cx={66}
                cy={66}
                r={R}
                fill="none"
                stroke="var(--color-viz)"
                strokeWidth={9}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                initial={reduce ? false : { strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - pct) }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              />
            </svg>
            <div className={styles.ringText}>
              <p className={styles.ringValue} data-testid="difficulty-total">
                {totals.attained}
              </p>
              <p className={styles.ringOf}>/ {totals.required}</p>
              <p className={styles.ringCaption}>Skills</p>
            </div>
          </div>

          <div className={styles.bands}>
            {difficulty.map((row) => (
              <div key={row.band} className={cn(styles.band, row.required === 0 && styles.bandEmpty)}>
                <p className={styles.bandName} style={{ color: row.required === 0 ? undefined : BAND_COLOR[row.band] }}>
                  {row.band}
                </p>
                <p className={styles.bandFigure}>
                  {row.required === 0 ? "—" : `${row.attained} / ${row.required}`}
                </p>
                <div
                  className={styles.track}
                  role="progressbar"
                  aria-label={`${row.band} skills`}
                  aria-valuenow={row.attained}
                  aria-valuemin={0}
                  aria-valuemax={row.required}
                >
                  <span
                    style={{
                      width: `${row.required ? (row.attained / row.required) * 100 : 0}%`,
                      background: BAND_COLOR[row.band],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
