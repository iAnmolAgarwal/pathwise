import { z } from "zod";

/** Nova's presence states (§9.2). Emitted over SSE as `nova_state`. */
export const NovaStateSchema = z.enum([
  "idle",
  "listening",
  "thinking",
  "speaking",
  "celebrating",
  "resting",
]);
export type NovaState = z.infer<typeof NovaStateSchema>;
