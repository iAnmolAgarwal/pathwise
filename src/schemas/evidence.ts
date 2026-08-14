import { z } from "zod";

// "goal" = directly required by the goal; "prereq-of:<skillId>" = transitive prerequisite.
export const GapReasonSchema = z.union([
  z.literal("goal"),
  z.string().regex(/^prereq-of:.+$/),
]);

export const ScoreBreakdownSchema = z.object({
  coverage: z.number(),
  levelFit: z.number(),
  preferenceFit: z.number(),
  quality: z.number(),
  similarity: z.number(),
  total: z.number(),
});

export const EvidenceSchema = z.object({
  catalogId: z.string().min(1),
  gapSkillsCovered: z.array(
    z.object({
      skillId: z.string().min(1),
      reason: GapReasonSchema,
      graphPath: z.array(z.string()),
    }),
  ),
  scoreBreakdown: ScoreBreakdownSchema,
  sequencedAfter: z.array(
    z.object({ catalogId: z.string().min(1), becauseSkill: z.string().min(1) }),
  ),
  provenance: z.url(),
});

export type GapReason = z.infer<typeof GapReasonSchema>;
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
