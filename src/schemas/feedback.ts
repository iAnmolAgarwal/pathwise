import { z } from "zod";

const ItemEvent = (type: string) =>
  z.object({ type: z.literal(type), catalogId: z.string().min(1) });

/** Learner feedback (§5.5). Item events name a path item; quiz_result names a skill. */
export const FeedbackEventSchema = z.discriminatedUnion("type", [
  ItemEvent("completed"),
  ItemEvent("too_hard"),
  ItemEvent("too_easy"),
  ItemEvent("not_interested"),
  z.object({
    type: z.literal("quiz_result"),
    skillId: z.string().min(1),
    score: z.number().min(0).max(100),
  }),
]);

export type FeedbackEvent = z.infer<typeof FeedbackEventSchema>;
export type FeedbackEventType = FeedbackEvent["type"];
