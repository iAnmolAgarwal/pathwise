"use client";

import { CalendarDays, GraduationCap, Globe2 } from "lucide-react";

import type { ProfileStats } from "@/engine/profileStats";
import { cn } from "@/lib/utils";

import { BadgeMedal } from "./BadgeMedal";
import styles from "./rail.module.css";

type Props = {
  displayName: string;
  stats: ProfileStats | null;
};

/**
 * Identity rail. Country, education and the handle have no column on `learners` yet, so
 * they render as "Not set" rather than being invented; rank has no scoring rule agreed, so
 * it shows as unranked. Both become live without touching this layout.
 */
export function ProfileRail({ displayName, stats }: Props) {
  const badges = stats?.badges ?? [];
  const earned = badges.filter((b) => b.earned);
  const nextUp = badges.find((b) => !b.earned);

  return (
    <>
      <section className={styles.card} data-testid="profile-identity">
        <div className={styles.head}>
          <span className={styles.avatar} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <circle cx="12" cy="8.5" r="3.8" />
              <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
            </svg>
          </span>
          <div className={styles.who}>
            <p className={styles.name} title={displayName}>
              {displayName}
            </p>
            <p className={styles.handle}>@—</p>
          </div>
        </div>

        <div className={styles.rank}>
          <div>
            <p className={styles.label}>Rank</p>
          </div>
          <p className={styles.rankValue}>Unranked</p>
        </div>

        <dl className={styles.details}>
          <div className={styles.row}>
            <Globe2 aria-hidden />
            <dt className={styles.term}>Country</dt>
            <dd className={cn(styles.value, styles.blank)}>Not set</dd>
          </div>
          <div className={styles.row}>
            <GraduationCap aria-hidden />
            <dt className={styles.term}>Education</dt>
            <dd className={cn(styles.value, styles.blank)}>Not set</dd>
          </div>
          <div className={styles.row}>
            <CalendarDays aria-hidden />
            <dt className={styles.term}>Active days</dt>
            <dd className={styles.value}>{stats ? stats.activity.activeDays : "—"}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.card} data-testid="profile-badges">
        <div className={styles.badgeHead}>
          <p className={styles.label}>Badges</p>
          <p className={styles.badgeCount}>
            {earned.length} / {badges.length || 8}
          </p>
        </div>

        {nextUp && (
          <div className={styles.nextUp}>
            <BadgeMedal id={nextUp.id} earned={false} title={nextUp.name} />
            <div className={styles.nextUpText}>
              <p className={styles.nextUpName}>{nextUp.name}</p>
              <p className={styles.nextUpHint}>Next up · {nextUp.hint.toLowerCase()}</p>
            </div>
          </div>
        )}

        <ul className={styles.badges}>
          {badges.map((b) => (
            <li key={b.id} className={cn(styles.badge, !b.earned && styles.locked)} title={b.hint}>
              <BadgeMedal id={b.id} earned={b.earned} title={b.name} />
              <p className={styles.badgeName}>{b.name}</p>
            </li>
          ))}
        </ul>
        <p className={styles.hint}>Locked badges stay visible, so the next thing to chase is always on screen.</p>
      </section>
    </>
  );
}
