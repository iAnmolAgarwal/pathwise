import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { addUsage, billableTokens, budgetGate, classifyLlmError, emptyUsage, memoryUsageStore } from "@/llm/judgeMode";

const headers = new Headers();

describe("classifyLlmError", () => {
  it("maps rate limits, overloads and outages to per-turn degradations", () => {
    expect(classifyLlmError(new Anthropic.RateLimitError(429, {}, "slow down", headers))?.reason).toBe("rate_limit");
    expect(classifyLlmError(new Anthropic.InternalServerError(529, {}, "overloaded", headers))?.reason).toBe("overloaded");
    expect(classifyLlmError(new Anthropic.InternalServerError(500, {}, "boom", headers))?.reason).toBe("unavailable");
    expect(classifyLlmError(new Anthropic.APIConnectionError({ message: "offline" }))?.reason).toBe("unavailable");
  });

  it("treats a rejected key as the model being unreachable, not as a request bug", () => {
    expect(classifyLlmError(new Anthropic.AuthenticationError(401, {}, "invalid x-api-key", headers))?.reason).toBe("unavailable");
    expect(classifyLlmError(new Anthropic.PermissionDeniedError(403, {}, "no", headers))?.reason).toBe("unavailable");
  });

  it("lets programming errors surface", () => {
    expect(classifyLlmError(new Anthropic.BadRequestError(400, {}, "bad", headers))).toBeNull();
    expect(classifyLlmError(new Error("bug"))).toBeNull();
  });
});

describe("addUsage", () => {
  it("accumulates SDK usage blocks and prior totals alike", () => {
    const a = addUsage(emptyUsage(), { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 } as Anthropic.Usage);
    const b = addUsage(a, { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 1, cacheCreationInputTokens: 1 });
    expect(b).toEqual({ inputTokens: 11, outputTokens: 6, cacheReadInputTokens: 101, cacheCreationInputTokens: 1 });
    expect(billableTokens(b)).toBe(119);
  });
});

describe("budgetGate", () => {
  const caps = { userDailyTokens: 1000, globalDailyTokens: 2500 };
  const alice = { userId: "alice", learnerId: "l1" };
  const aliceToo = { userId: "alice", learnerId: "l2" };
  const bob = { userId: "bob", learnerId: "l3" };
  const usage = (n: number) => ({ inputTokens: n, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 });

  it("allows a fresh user and reports the caps", async () => {
    const gate = budgetGate(memoryUsageStore(), caps);
    const verdict = await gate.allow(alice);
    expect(verdict.ok).toBe(true);
    expect(verdict.status).toEqual({ ok: true, userUsed: 0, userCap: 1000, globalUsed: 0, globalCap: 2500 });
  });

  it("parks a user once their learners together reach the daily cap", async () => {
    const store = memoryUsageStore();
    const gate = budgetGate(store, caps);
    await gate.record(alice, usage(600));
    expect((await gate.allow(aliceToo)).ok).toBe(true);
    await gate.record(aliceToo, usage(400));
    const verdict = await gate.allow(alice);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.degradation.reason).toBe("budget");
      expect(verdict.status.userUsed).toBe(1000);
    }
    // Someone else's allowance is their own.
    expect((await gate.allow(bob)).ok).toBe(true);
  });

  it("parks everyone once the deployment reaches the global cap", async () => {
    const store = memoryUsageStore();
    const gate = budgetGate(store, caps);
    await gate.record(alice, usage(900));
    await gate.record(bob, usage(900));
    await gate.record({ userId: "carol", learnerId: "l4" }, usage(700));
    const verdict = await gate.allow({ userId: "dave", learnerId: "l5" });
    expect(verdict.ok).toBe(false);
    expect(verdict.status.globalUsed).toBe(2500);
  });

  it("counts cached and cache-creation input against the budget and skips empty usage", async () => {
    const store = memoryUsageStore();
    const gate = budgetGate(store, caps);
    await gate.record(alice, { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 100, cacheCreationInputTokens: 20 });
    await gate.record(alice, emptyUsage());
    expect(store.totals.get("alice")).toBe(135);
    expect(store.global).toBe(135);
  });
});
