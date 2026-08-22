import type { AchievementId } from "@/engine/dashboard";
import { cn } from "@/lib/utils";

import styles from "./dashboard.module.css";

/**
 * Hexagonal medals, one glyph per achievement. Earned medals carry the violet plate; locked
 * medals keep the same glyph on a flat plate so the shape being chased stays recognisable.
 */
const PLATE = "M24 2 43 13v22L24 46 5 35V13Z";

function Glyph({ id }: { id: AchievementId }) {
  switch (id) {
    case "first-path":
      return (
        <>
          <path d="M15 32c6 0 3-8 9-8s3-8 9-8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="15" cy="32" r="3" fill="currentColor" />
          <circle cx="33" cy="16" r="3" fill="currentColor" />
        </>
      );
    case "first-done":
      return <path d="M15 25.5 21.5 32 34 18" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />;
    case "phase-1":
      return <path d="M17 14h14l-5 10h6L19 36l3-9h-6Z" fill="currentColor" />;
    case "streak-7":
    case "streak-30":
      return <path d="M24 12c5 6 8 8 8 14a8 8 0 0 1-16 0c0-3 1.5-5 3-7 .5 2 1.5 3 3 3.5-.5-4 .5-8 2-10.5Z" fill="currentColor" />;
    case "foundations":
      return (
        <g fill="currentColor">
          <rect x="13" y="29" width="22" height="5" rx="1.5" />
          <rect x="16" y="21" width="16" height="5" rx="1.5" />
          <rect x="19" y="13" width="10" height="5" rx="1.5" />
        </g>
      );
    case "explorer":
      return (
        <>
          <circle cx="24" cy="24" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="m28.5 19.5-2.5 7-7 2.5 2.5-7Z" fill="currentColor" />
        </>
      );
    case "hard-mode":
      return <path d="m24 13 3.4 7.2 7.6 1-5.6 5.4 1.4 7.7L24 30.6l-6.8 3.7 1.4-7.7-5.6-5.4 7.6-1Z" fill="currentColor" />;
    case "depth":
      return (
        <g fill="currentColor">
          <rect x="14" y="27" width="5" height="8" rx="1.5" />
          <rect x="21.5" y="21" width="5" height="14" rx="1.5" />
          <rect x="29" y="14" width="5" height="21" rx="1.5" />
        </g>
      );
    case "goal-complete":
      return (
        <>
          <circle cx="24" cy="24" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="24" cy="24" r="3.6" fill="currentColor" />
        </>
      );
  }
}

export function BadgeMedal({ id, earned, title, size = 44 }: { id: AchievementId; earned: boolean; title: string; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={cn(styles.medal, earned ? styles.medalEarned : styles.medalLocked)} role="img" aria-label={`${title}${earned ? "" : " (locked)"}`}>
      <path d={PLATE} className={styles.medalPlate} />
      <g className={styles.medalGlyph}>
        <Glyph id={id} />
      </g>
    </svg>
  );
}
