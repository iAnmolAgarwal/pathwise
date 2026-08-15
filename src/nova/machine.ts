import type { NovaState } from "@/schemas/nova";

/**
 * Nova's presence state machine (§9.2). Pure: fed by `nova_state` SSE events
 * and UI events, independent of whichever visual (Spline scene, orb, static)
 * renders it. The stage component only ever reads `state` and `transitions`.
 *
 *   idle → listening (input focus) → thinking (SSE open / tool round)
 *        → speaking (text streaming) → idle | listening
 *   celebrating (milestone) → back to where it was
 *   resting (judge-mode degraded) — sticky until recovered
 */
export type NovaEvent =
  | { type: "sse"; state: NovaState }
  | { type: "input_focus" }
  | { type: "input_blur" }
  | { type: "stream_close" }
  | { type: "milestone_completed" }
  | { type: "celebration_done" }
  | { type: "degraded" }
  | { type: "recovered" }
  | { type: "reset" };

export interface NovaMachine {
  state: NovaState;
  /** Input has focus — decides whether an ended turn lands on idle or listening. */
  focused: boolean;
  /** Judge mode has degraded the LLM; nothing but recovery moves Nova. */
  degraded: boolean;
  /** Chat state that arrived while celebrating; applied when the celebration ends. */
  held: NovaState | null;
  /** State to return to after celebrating (the pre-celebration state). */
  resumeTo: NovaState;
  /** Milestone celebrations triggered (lets a repeat celebration restart its animation). */
  celebrations: number;
  /** Total state changes, so a visual can retrigger on same-state repeats. */
  transitions: number;
}

export const initialNova: NovaMachine = {
  state: "idle",
  focused: false,
  degraded: false,
  held: null,
  resumeTo: "idle",
  celebrations: 0,
  transitions: 0,
};

const CHAT_STATES = new Set<NovaState>(["thinking", "speaking"]);

function restingOrFocus(m: NovaMachine): NovaState {
  return m.focused ? "listening" : "idle";
}

function to(m: NovaMachine, state: NovaState, patch: Partial<NovaMachine> = {}): NovaMachine {
  const next = { ...m, ...patch };
  if (next.state !== state) {
    next.state = state;
    next.transitions = m.transitions + 1;
  }
  return next;
}

export function novaReducer(m: NovaMachine, e: NovaEvent): NovaMachine {
  switch (e.type) {
    case "reset":
      return initialNova;

    case "degraded":
      return to(m, "resting", { degraded: true, held: null });

    case "recovered":
      if (!m.degraded) return m;
      return to(m, restingOrFocus(m), { degraded: false });

    case "input_focus": {
      if (m.focused) return m;
      const next = { ...m, focused: true };
      if (m.degraded || m.state !== "idle") return next;
      return to(next, "listening");
    }

    case "input_blur": {
      if (!m.focused) return m;
      const next = { ...m, focused: false };
      if (m.state !== "listening") return next;
      return to(next, "idle");
    }

    case "milestone_completed": {
      if (m.degraded) return m;
      if (m.state === "celebrating") {
        return { ...m, celebrations: m.celebrations + 1, transitions: m.transitions + 1 };
      }
      return to(m, "celebrating", { resumeTo: m.state, held: null, celebrations: m.celebrations + 1 });
    }

    case "celebration_done": {
      if (m.state !== "celebrating") return m;
      const target = m.held ?? (m.resumeTo === "celebrating" ? restingOrFocus(m) : m.resumeTo);
      return to(m, target, { held: null });
    }

    case "stream_close":
      return novaReducer(m, { type: "sse", state: "idle" });

    case "sse": {
      if (e.state === "resting") return novaReducer(m, { type: "degraded" });
      if (m.degraded) return m;
      if (e.state === "celebrating") return novaReducer(m, { type: "milestone_completed" });
      // Chat lifecycle events resolve "idle" to listening when the input is focused.
      const target: NovaState = e.state === "idle" ? restingOrFocus(m) : e.state;
      if (m.state === "celebrating") {
        return { ...m, held: target };
      }
      if (e.state === "listening" && CHAT_STATES.has(m.state)) return m;
      return to(m, target);
    }
  }
}
