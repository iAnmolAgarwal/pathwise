import type { BadgeId } from "@/engine/profileStats";

/**
 * Hexagonal medals, one glyph per badge. Earned medals are filled with the plate gradient
 * of their family (violet for activity, white for milestones); locked medals reuse the same
 * glyph on a flat plate so the shape you are working towards is recognisable.
 */

const PLATE = "M24 2 43 13v22L24 46 5 35V13Z";

type Family = "violet" | "white";
const FAMILY: Record<BadgeId, Family> = {
  "first-path": "violet",
  "streak-7": "violet",
  "streak-30": "violet",
  explorer: "violet",
  foundations: "white",
  "hard-mode": "white",
  depth: "white",
  "goal-complete": "white",
};

/** Drawn on top of the plate; dark ink when earned so the glyph reads against the fill. */
function Glyph({ id }: { id: BadgeId }) {
  switch (id) {
    case "first-path":
      return (
        <>
          <path d="M15 32c6 0 3-8 9-8s3-8 9-8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="15" cy="32" r="3" fill="currentColor" />
          <circle cx="33" cy="16" r="3" fill="currentColor" />
        </>
      );
    case "streak-7":
    case "streak-30":
      return <path d="M24 12c5 6 8 8 8 14a8 8 0 0 1-16 0c0-3 1.5-5 3-7 .5 2 1.5 3 3 3.5-.5-4 .5-8 2-10.5Z" fill="currentColor" />;
    case "foundations":
      return <path d="M15 25.5 21.5 32 34 18" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />;
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

export function BadgeMedal({ id, earned, title }: { id: BadgeId; earned: boolean; title: string }) {
  // Gradient ids must be unique per medal: the same badge renders twice (grid + "next up").
  const gid = `medal-${id}-${earned ? "on" : "off"}`;
  const stops = !earned
    ? ["#33333c", "#1c1c22"]
    : FAMILY[id] === "violet"
      ? ["#a495ff", "#6b5cf0"]
      : ["#ffffff", "#b9b9c4"];

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label={earned ? `${title}, earned` : `${title}, locked`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="1" stopColor={stops[1]} />
        </linearGradient>
      </defs>
      <path d={PLATE} fill={`url(#${gid})`} />
      <path d={PLATE} fill="none" stroke="#fff" strokeOpacity={earned ? 0.35 : 0.2} strokeDasharray={earned ? undefined : "3 3"} />
      <g color={earned ? "#141419" : "#6a6a76"}>
        <Glyph id={id} />
      </g>
    </svg>
  );
}
