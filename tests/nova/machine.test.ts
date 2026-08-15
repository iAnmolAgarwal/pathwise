import { describe, expect, it } from "vitest";

import { initialNova, novaReducer, type NovaEvent, type NovaMachine } from "@/nova/machine";

function run(events: NovaEvent[], from: NovaMachine = initialNova): NovaMachine {
  return events.reduce(novaReducer, from);
}

describe("nova reducer — chat lifecycle", () => {
  it("starts idle", () => {
    expect(initialNova.state).toBe("idle");
  });

  it("listens on input focus and returns to idle on blur", () => {
    expect(run([{ type: "input_focus" }]).state).toBe("listening");
    expect(run([{ type: "input_focus" }, { type: "input_blur" }]).state).toBe("idle");
  });

  it("follows the SSE lifecycle: thinking → speaking → idle", () => {
    const m1 = run([{ type: "sse", state: "thinking" }]);
    expect(m1.state).toBe("thinking");
    const m2 = run([{ type: "sse", state: "speaking" }], m1);
    expect(m2.state).toBe("speaking");
    const m3 = run([{ type: "sse", state: "idle" }], m2);
    expect(m3.state).toBe("idle");
  });

  it("goes back to thinking between tool rounds", () => {
    const m = run([
      { type: "sse", state: "thinking" },
      { type: "sse", state: "speaking" },
      { type: "sse", state: "thinking" },
    ]);
    expect(m.state).toBe("thinking");
  });

  it("returns to listening, not idle, when the stream ends while the input is focused", () => {
    const m = run([
      { type: "input_focus" },
      { type: "sse", state: "thinking" },
      { type: "sse", state: "speaking" },
      { type: "sse", state: "idle" },
    ]);
    expect(m.state).toBe("listening");
  });

  it("stream_close acts like an SSE idle (network drop safety net)", () => {
    expect(run([{ type: "sse", state: "thinking" }, { type: "stream_close" }]).state).toBe("idle");
  });

  it("does not let a stale focus interrupt thinking or speaking", () => {
    expect(run([{ type: "sse", state: "thinking" }, { type: "input_focus" }]).state).toBe("thinking");
    expect(run([{ type: "sse", state: "speaking" }, { type: "input_blur" }]).state).toBe("speaking");
  });
});

describe("nova reducer — celebrating", () => {
  it("celebrates on a milestone and returns to where it was", () => {
    const m1 = run([{ type: "input_focus" }, { type: "milestone_completed" }]);
    expect(m1.state).toBe("celebrating");
    expect(run([{ type: "celebration_done" }], m1).state).toBe("listening");
  });

  it("holds SSE updates while celebrating and applies the latest afterwards", () => {
    const m1 = run([{ type: "milestone_completed" }, { type: "sse", state: "thinking" }, { type: "sse", state: "speaking" }]);
    expect(m1.state).toBe("celebrating");
    expect(run([{ type: "celebration_done" }], m1).state).toBe("speaking");
  });

  it("re-triggering a milestone while celebrating restarts the celebration count", () => {
    const m = run([{ type: "milestone_completed" }, { type: "milestone_completed" }]);
    expect(m.state).toBe("celebrating");
    expect(m.celebrations).toBe(2);
  });

  it("does not celebrate while resting", () => {
    expect(run([{ type: "degraded" }, { type: "milestone_completed" }]).state).toBe("resting");
  });
});

describe("nova reducer — resting (judge mode)", () => {
  it("rests when degraded and ignores chat events until recovered", () => {
    const m1 = run([{ type: "sse", state: "speaking" }, { type: "degraded" }]);
    expect(m1.state).toBe("resting");
    expect(run([{ type: "sse", state: "thinking" }, { type: "input_focus" }], m1).state).toBe("resting");
    expect(run([{ type: "recovered" }], m1).state).toBe("idle");
  });

  it("an SSE 'resting' event is the same as degraded", () => {
    expect(run([{ type: "sse", state: "resting" }]).state).toBe("resting");
    expect(run([{ type: "sse", state: "resting" }]).degraded).toBe(true);
  });

  it("reset returns to the initial machine", () => {
    expect(run([{ type: "degraded" }, { type: "reset" }])).toEqual(initialNova);
  });
});

describe("nova reducer — bookkeeping", () => {
  it("returns the same object when nothing changes (cheap re-renders)", () => {
    const m = run([{ type: "input_blur" }]);
    expect(m).toBe(initialNova);
  });

  it("counts transitions so visuals can retrigger on the same state", () => {
    const m = run([{ type: "sse", state: "thinking" }, { type: "sse", state: "speaking" }, { type: "sse", state: "thinking" }]);
    expect(m.transitions).toBe(3);
  });
});
