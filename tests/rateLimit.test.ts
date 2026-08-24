import { describe, expect, it } from "vitest";
import { fixedWindowLimit } from "@/lib/rateLimit";

describe("fixedWindowLimit", () => {
  it("allows up to the limit in a window, then refuses with a retry hint", () => {
    const limit = fixedWindowLimit(3, 60_000);
    const t0 = 1_000_000;
    expect(limit.take("a", t0)).toEqual({ ok: true, remaining: 2 });
    expect(limit.take("a", t0 + 1000)).toEqual({ ok: true, remaining: 1 });
    expect(limit.take("a", t0 + 2000)).toEqual({ ok: true, remaining: 0 });
    expect(limit.take("a", t0 + 3000)).toEqual({ ok: false, retryAfterSeconds: 57 });
  });

  it("keeps learners apart and opens a new window after it elapses", () => {
    const limit = fixedWindowLimit(1, 60_000);
    const t0 = 5_000_000;
    expect(limit.take("a", t0).ok).toBe(true);
    expect(limit.take("b", t0).ok).toBe(true);
    expect(limit.take("a", t0 + 59_999).ok).toBe(false);
    expect(limit.take("a", t0 + 60_000).ok).toBe(true);
  });
});
