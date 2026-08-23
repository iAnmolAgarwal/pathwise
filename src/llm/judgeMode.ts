import Anthropic from "@anthropic-ai/sdk";

/**
 * Judge mode (§8.4) — cost control and resilience. Two seams: classifying an LLM failure
 * into a per-turn degradation, and the daily token budget that parks the model once a user
 * (or the whole deployment) has spent its share. Everything deterministic keeps working
 * either way — the routes answer `{degraded: true}` for the model's part only.
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
 * surface. The SDK has already retried 429/5xx with backoff before we get here. A rejected
 * or missing key is an operations problem, not a request bug: the model is unreachable for
 * every turn, so it degrades the same way an outage does.
 */
export function classifyLlmError(err: unknown): Degradation | null {
  if (err instanceof Anthropic.RateLimitError) return degradation("rate_limit");
  if (err instanceof Anthropic.InternalServerError) {
    return degradation(err.status === 529 ? "overloaded" : "unavailable");
  }
  if (err instanceof Anthropic.APIConnectionError) return degradation("unavailable");
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return degradation("unavailable");
  }
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

/** Every token the response consumed, cached or not — what the budget counts. */
export function billableTokens(usage: UsageTotals): number {
  return usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
}

/** Who a request is metered against: the Google user (per-user cap) and the learner (per-learner row). */
export type BudgetKey = { userId: string; learnerId: string };

/**
 * Daily caps, in tokens per UTC day. A user's learners share one allowance, so an account
 * cannot dodge the cap by making more of them; the global cap bounds the whole deployment's
 * spend on a judging day. Both can be raised or lowered from the environment without a deploy.
 */
export const BUDGET = {
  userDailyTokens: envInt("JUDGE_USER_DAILY_TOKENS", 150_000),
  globalDailyTokens: envInt("JUDGE_GLOBAL_DAILY_TOKENS", 3_000_000),
} as const;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type BudgetStatus = {
  ok: boolean;
  /** Tokens this user has spent today across all their learners. */
  userUsed: number;
  userCap: number;
  globalUsed: number;
  globalCap: number;
};

/** What the gate needs from storage. The route handler supplies the database-backed one. */
export interface UsageStore {
  /** Tokens (input + output) metered for this user today. */
  userUsedToday(userId: string): Promise<number>;
  /** Tokens metered for everyone today. */
  globalUsedToday(): Promise<number>;
  record(key: BudgetKey, inputTokens: number, outputTokens: number): Promise<void>;
}

export interface BudgetGate {
  allow(key: BudgetKey): Promise<{ ok: true; status: BudgetStatus } | { ok: false; degradation: Degradation; status: BudgetStatus }>;
  record(key: BudgetKey, usage: UsageTotals): Promise<void>;
}

export type BudgetCaps = { userDailyTokens: number; globalDailyTokens: number };

/** A gate over any usage store; the caps are injectable so tests do not depend on the environment. */
export function budgetGate(store: UsageStore, caps: BudgetCaps = BUDGET): BudgetGate {
  return {
    async allow(key) {
      const [userUsed, globalUsed] = await Promise.all([store.userUsedToday(key.userId), store.globalUsedToday()]);
      const status: BudgetStatus = {
        ok: userUsed < caps.userDailyTokens && globalUsed < caps.globalDailyTokens,
        userUsed,
        userCap: caps.userDailyTokens,
        globalUsed,
        globalCap: caps.globalDailyTokens,
      };
      return status.ok ? { ok: true, status } : { ok: false, degradation: degradation("budget"), status };
    },
    async record(key, usage) {
      const input = usage.inputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
      if (input + usage.outputTokens === 0) return;
      await store.record(key, input, usage.outputTokens);
    },
  };
}

/** Keeps usage in memory — for tests and for running without a database. */
export function memoryUsageStore(): UsageStore & { totals: Map<string, number>; global: number } {
  const totals = new Map<string, number>();
  const self = {
    totals,
    global: 0,
    async userUsedToday(userId: string) {
      return totals.get(userId) ?? 0;
    },
    async globalUsedToday() {
      return self.global;
    },
    async record(key: BudgetKey, inputTokens: number, outputTokens: number) {
      const n = inputTokens + outputTokens;
      totals.set(key.userId, (totals.get(key.userId) ?? 0) + n);
      self.global += n;
    },
  };
  return self;
}

/** The gate that allows everything — the seam tests and the fake client use. */
export const openGate: BudgetGate = {
  async allow() {
    return { ok: true, status: { ok: true, userUsed: 0, userCap: Infinity, globalUsed: 0, globalCap: Infinity } };
  },
  async record() {},
};
