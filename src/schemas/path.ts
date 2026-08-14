import { z } from "zod";
import { EvidenceSchema } from "./evidence";

export const PathItemStatusSchema = z.enum([
  "todo",
  "in_progress",
  "done",
  "skipped",
]);

export const PathSchema = z.object({
  phases: z.array(
    z.object({
      title: z.string().min(1),
      milestone: z.string().min(1),
      items: z.array(
        z.object({
          catalogId: z.string().min(1),
          status: PathItemStatusSchema,
          evidence: EvidenceSchema,
        }),
      ),
    }),
  ),
  meta: z.object({
    generatedAt: z.iso.datetime(),
    engineVersion: z.string().min(1),
    trigger: z.enum(["initial", "replan"]),
  }),
});

export const PathDiffSchema = z.object({
  added: z.array(z.object({ catalogId: z.string().min(1), reason: z.string() })),
  removed: z.array(z.object({ catalogId: z.string().min(1), reason: z.string() })),
  reordered: z.boolean(),
  cause: z.object({ eventId: z.string().min(1), humanReadable: z.string() }),
});

export type PathItemStatus = z.infer<typeof PathItemStatusSchema>;
export type Path = z.infer<typeof PathSchema>;
export type PathDiff = z.infer<typeof PathDiffSchema>;
