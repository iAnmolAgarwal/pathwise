import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { addUsage, classifyLlmError, emptyUsage } from "@/llm/judgeMode";

const headers = new Headers();

describe("classifyLlmError", () => {
  it("maps rate limits, overloads and outages to per-turn degradations", () => {
    expect(classifyLlmError(new Anthropic.RateLimitError(429, {}, "slow down", headers))?.reason).toBe("rate_limit");
    expect(classifyLlmError(new Anthropic.InternalServerError(529, {}, "overloaded", headers))?.reason).toBe("overloaded");
    expect(classifyLlmError(new Anthropic.InternalServerError(500, {}, "boom", headers))?.reason).toBe("unavailable");
    expect(classifyLlmError(new Anthropic.APIConnectionError({ message: "offline" }))?.reason).toBe("unavailable");
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
  });
});
