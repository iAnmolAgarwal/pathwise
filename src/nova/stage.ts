import type { NovaState } from "@/schemas/nova";

/**
 * What every Nova renderer receives, whichever visual ships (Spline scene,
 * orb, static render). Renderers must not know about SSE or the chat.
 */
export interface NovaStageProps {
  state: NovaState;
  /** Increments on every state change; lets a renderer retrigger the same state. */
  transitions: number;
  /** Where Nova is placed — the renderer picks framing and detail level. */
  placement: "hero" | "dock";
  /** Honour prefers-reduced-motion: no idle loops, instant state changes. */
  reducedMotion?: boolean;
  className?: string;
}

/** Human-readable presence label, shown next to the docked stage. */
export const NOVA_LABEL: Record<NovaState, string> = {
  idle: "Nova is here",
  listening: "Nova is listening",
  thinking: "Nova is thinking",
  speaking: "Nova is speaking",
  celebrating: "Milestone reached",
  resting: "Nova is resting",
};

/** thinking-orbs verb for each state — the shared loading/thinking language. */
export const NOVA_ORB: Record<
  NovaState,
  "working" | "searching" | "solving" | "listening" | "connecting" | "weaving" | "composing" | "breathing" | "shaping"
> = {
  idle: "breathing",
  listening: "listening",
  thinking: "searching",
  speaking: "composing",
  celebrating: "shaping",
  resting: "breathing",
};
