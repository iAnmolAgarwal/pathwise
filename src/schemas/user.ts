import { z } from "zod";

/** The signed-in Google user as the app sees it (§19): what Auth.js puts on the session. */
export const SessionUserSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;
