"use client";

import { ThinkingOrb, type OrbSize, type OrbState } from "thinking-orbs";

import { cn } from "@/lib/utils";

/**
 * The one loading / thinking indicator for the whole app: a monochrome dotted
 * orb (thinking-orbs). Pinned to the dark palette. Two tuned sizes only —
 * 64 for avatar-scale moments, 20 for inline text and busy buttons.
 */
function Orb({
  state = "working",
  size = 64,
  speed,
  paused,
  label,
  className,
}: {
  state?: OrbState;
  size?: OrbSize;
  speed?: number;
  paused?: boolean;
  /** Accessible name; defaults to the state verb. */
  label?: string;
  className?: string;
}) {
  return (
    <ThinkingOrb
      state={state}
      size={size}
      speed={speed}
      paused={paused}
      theme="dark"
      role="img"
      aria-label={label ?? state}
      className={cn("shrink-0", className)}
    />
  );
}

export { Orb };
export type { OrbSize, OrbState };
