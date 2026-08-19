import { describe, expect, it } from "vitest";
import { CHAT_SYSTEM_PROMPT, EXPLAIN_SYSTEM_PROMPT } from "@/llm/prompts";

// Narration may cite n and % only from learnerEvidence (§7 rendering 2, §8.2). The prompts are
// frozen strings: this pins the one clause that allows numbers, so a future edit cannot widen it.
describe("frozen prompts: numbers only from learnerEvidence", () => {
  it("the explain prompt allows learnerEvidence numbers and forbids others", () => {
    expect(EXPLAIN_SYSTEM_PROMPT).toMatch(/learnerEvidence block, you may cite its n and percentages — and only those numbers/);
    expect(EXPLAIN_SYSTEM_PROMPT).toMatch(/without that block, cite no numbers/);
    // The branch share is framed as where learners went, never how they felt (N-5).
    expect(EXPLAIN_SYSTEM_PROMPT).toMatch(/whatLearnersDidNext entry as the share of learners who/);
    expect(EXPLAIN_SYSTEM_PROMPT).not.toMatch(/satisf|struggl|liked|enjoy/i);
  });

  it("the chat prompt carries the same rule for explain_item", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Cite counts or percentages only when the evidence carries a learnerEvidence block/);
  });

  it("prompts stay free of anything time- or learner-specific (cache prefix)", () => {
    for (const p of [CHAT_SYSTEM_PROMPT, EXPLAIN_SYSTEM_PROMPT]) {
      expect(p).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(p).not.toMatch(/\$\{/);
    }
  });
});
