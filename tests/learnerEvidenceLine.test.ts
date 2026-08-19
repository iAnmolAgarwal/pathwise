import { describe, expect, it } from "vitest";
import skillEdgesJson from "@/data/skill_edges.json";
import { CONFIRM_CONFIDENCE, CONFIRM_N, learnerEvidenceLine } from "@/lib/learnerEvidence";
import type { LearnerEvidenceEdge } from "@/schemas";

const so = (over: Partial<LearnerEvidenceEdge>): LearnerEvidenceEdge => ({
  from: "javascript", to: "react", source: "stackoverflow", support: 1617, reverse: 103, confidence: 0.94, n: 1720, caveat: "asking ≠ completing", ...over,
});

describe("evidence-card provenance line", () => {
  it("mirrors the pipeline's confirm floor", () => {
    const t = (skillEdgesJson as { thresholds: { confirmConfidence: number; confirmN: number } }).thresholds;
    expect(CONFIRM_CONFIDENCE).toBe(t.confirmConfidence);
    expect(CONFIRM_N).toBe(t.confirmN);
  });

  it("is absent without learner evidence", () => {
    expect(learnerEvidenceLine(undefined)).toBeNull();
  });

  it("reads 'Confirmed by <support> learner sequences (<pct> took these in this order)' for a confirming source", () => {
    const line = learnerEvidenceLine({ edges: [so({})] });
    expect(line?.text).toBe("Confirmed by 1,617 learner sequences (94 % took these in this order)");
    expect(line?.confirmed).toBe(true);
  });

  it("never says 'confirmed' below the floor, and reports n instead", () => {
    const line = learnerEvidenceLine({ edges: [so({ support: 754, reverse: 4785, confidence: 0.136, n: 5539 })] });
    expect(line?.confirmed).toBe(false);
    expect(line?.text).toBe("Seen in 5,539 learner sequences (14 % took these in this order)");
    expect(learnerEvidenceLine({ edges: [so({ support: 9, reverse: 1, confidence: 0.9, n: 10 })] })?.confirmed).toBe(false);
  });

  it("leads with the confirming source that saw the most sequences", () => {
    const line = learnerEvidenceLine({ edges: [so({ source: "coursera", support: 80, reverse: 6, confidence: 0.93, n: 86 }), so({})] });
    expect(line?.lead.source).toBe("stackoverflow");
  });

  it("prefers a smaller confirming source over a larger inconclusive one", () => {
    const big = so({ from: "html", to: "css", support: 55372, reverse: 32623, confidence: 0.63, n: 87995 });
    const small = so({ from: "css", to: "responsive-design", support: 7799, reverse: 625, confidence: 0.93, n: 8424 });
    const line = learnerEvidenceLine({ edges: [big, small] });
    expect(line?.lead).toBe(small);
    expect(line?.text).toBe("Confirmed by 7,799 learner sequences (93 % took these in this order)");
  });
});
