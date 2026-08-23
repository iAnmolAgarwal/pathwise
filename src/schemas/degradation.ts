import { z } from "zod";

/** Judge mode's answer when the model's part of a response is missing (§8.4). */
export const DegradationReasonSchema = z.enum(["rate_limit", "overloaded", "budget", "unavailable"]);

export const DegradationSchema = z.object({
  degraded: z.literal(true),
  reason: DegradationReasonSchema,
  message: z.string(),
});
