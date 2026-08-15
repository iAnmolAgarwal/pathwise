import Anthropic from "@anthropic-ai/sdk";

/**
 * Judge mode (§8.4) — cost control and resilience. The full metering/caps land in a later
 * milestone; this module owns the two seams the rest of the app already depends on:
 * classifying an LLM failure into a per-turn degradation, and the budget gate interface.
 */

export type DegradationReason = "rate_limit" | "overloaded" | "budget" | "unavailable";

export type Degradation = {
  degraded: true;
  reason: DegradationReason;
  /** Learner-facing sentence; everything deterministic keeps working. */
  message: string;
};

const MESSAGES: Record<DegradationReason, string> = {
  rate_limit: "Nova is catching its breath — too many requests right now. Your path and profile still work; try again in a moment.",
  overloaded: "Nova's model is briefly overloaded. Your path and profile still work; try again in a moment.",
  budget: "Nova has used today's conversation budget. Your path, feedback and explanations still work.",
  unavailable: "Nova couldn't reach its model just now. Your path and profile still work; try again shortly.",
};

export function degradation(reason: DegradationReason): Degradation {
  return { degraded: true, reason, message: MESSAGES[reason] };
}

/**
 * Map an SDK error to a degradation, or null if it is a programming error that should
 * surface. The SDK has already retried 429/5xx with backoff before we get here.
 */
export function classifyLlmError(err: unknown): Degradation | null {
  if (err instanceof Anthropic.RateLimitError) return degradation("rate_limit");
  if (err instanceof Anthropic.InternalServerError) {
    return degradation(err.status === 529 ? "overloaded" : "unavailable");
  }
  if (err instanceof Anthropic.APIConnectionError) return degradation("unavailable");
  return null;
}

export type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
};

export function emptyUsage(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
}

export function addUsage(total: UsageTotals, usage: Anthropic.Usage | UsageTotals | undefined): UsageTotals {
  if (!usage) return total;
  if ("inputTokens" in usage) {
    return {
      inputTokens: total.inputTokens + usage.inputTokens,
      outputTokens: total.outputTokens + usage.outputTokens,
      cacheReadInputTokens: total.cacheReadInputTokens + usage.cacheReadInputTokens,
      cacheCreationInputTokens: total.cacheCreationInputTokens + usage.cacheCreationInputTokens,
    };
  }
  return {
    inputTokens: total.inputTokens + (usage.input_tokens ?? 0),
    outputTokens: total.outputTokens + (usage.output_tokens ?? 0),
    cacheReadInputTokens: total.cacheReadInputTokens + (usage.cache_read_input_tokens ?? 0),
    cacheCreationInputTokens: total.cacheCreationInputTokens + (usage.cache_creation_input_tokens ?? 0),
  };
}

/** Budget gate. The default allows everything; the metering milestone swaps in real caps. */
export interface BudgetGate {
  allow(learnerId: string): Promise<{ ok: true } | { ok: false; degradation: Degradation }>;
  record(learnerId: string, usage: UsageTotals): Promise<void>;
}

export const openGate: BudgetGate = {
  async allow() {
    return { ok: true };
  },
  async record() {},
};
