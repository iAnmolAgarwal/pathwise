import { describe, expect, it } from "vitest";
import { FeedbackEventSchema, ProfileOpSchema, ProfileSchema } from "@/schemas";

describe("FeedbackEventSchema (§5.5 event types)", () => {
  it("accepts the four item events and quiz_result", () => {
    for (const type of ["completed", "too_hard", "too_easy", "not_interested"] as const) {
      expect(FeedbackEventSchema.safeParse({ type, catalogId: "mdn-learn" }).success).toBe(true);
    }
    expect(FeedbackEventSchema.safeParse({ type: "quiz_result", skillId: "javascript", score: 72 }).success).toBe(true);
  });

  it("rejects unknown types, missing ids and out-of-range scores", () => {
    expect(FeedbackEventSchema.safeParse({ type: "loved_it", catalogId: "x" }).success).toBe(false);
    expect(FeedbackEventSchema.safeParse({ type: "completed" }).success).toBe(false);
    expect(FeedbackEventSchema.safeParse({ type: "quiz_result", skillId: "javascript", score: 101 }).success).toBe(false);
  });
});

describe("profile additions for adaptation", () => {
  it("set_skill may carry source assessed", () => {
    expect(ProfileOpSchema.safeParse({ op: "set_skill", skillId: "sql", level: 2, source: "assessed" }).success).toBe(true);
  });

  it("avoid op records an item plus optional provider/format memo", () => {
    expect(ProfileOpSchema.safeParse({ op: "avoid", catalogId: "x", provider: "Udemy", format: "video" }).success).toBe(true);
    expect(ProfileOpSchema.safeParse({ op: "avoid", catalogId: "x" }).success).toBe(true);
    expect(ProfileOpSchema.safeParse({ op: "avoid" }).success).toBe(false);
  });

  it("profile dislikes memo is optional so stored profiles still parse", () => {
    const base = { goals: [], skills: {}, preferences: { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" } };
    expect(ProfileSchema.safeParse(base).success).toBe(true);
    expect(ProfileSchema.safeParse({ ...base, dislikes: { catalogIds: ["x"], providers: ["Udemy"], formats: ["video"] } }).success).toBe(true);
    expect(ProfileSchema.safeParse({ ...base, dislikes: { catalogIds: ["x"], providers: [], formats: ["podcast"] } }).success).toBe(false);
  });
});

describe("ChatProfileOpSchema (LLM-facing subset)", () => {
  it("rejects assessed levels and avoid ops, which only feedback rules may produce", async () => {
    const { ChatProfileOpSchema } = await import("@/schemas");
    expect(ChatProfileOpSchema.safeParse({ op: "set_skill", skillId: "sql", level: 2, source: "assessed" }).success).toBe(false);
    expect(ChatProfileOpSchema.safeParse({ op: "set_skill", skillId: "sql", level: 2, source: "inferred" }).success).toBe(true);
    expect(ChatProfileOpSchema.safeParse({ op: "avoid", catalogId: "x" }).success).toBe(false);
  });
});
