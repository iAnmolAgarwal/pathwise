import { addTokenUsage, sumTokenUsageForUser, sumTokenUsageGlobal } from "@/db/queries";
import { budgetGate, type BudgetGate, type UsageStore } from "@/llm/judgeMode";

/** The usage store over `token_usage`; the LLM layer never touches the database itself (§3). */
export const dbUsageStore: UsageStore = {
  userUsedToday: (userId) => sumTokenUsageForUser(userId),
  globalUsedToday: () => sumTokenUsageGlobal(),
  record: (key, inputTokens, outputTokens) => addTokenUsage(key.learnerId, key.userId, inputTokens, outputTokens),
};

/** The judge-mode gate every LLM route consults (§8.4). */
export const judgeGate: BudgetGate = budgetGate(dbUsageStore);
