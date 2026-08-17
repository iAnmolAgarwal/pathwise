import { z } from "zod";
import { DomainSchema } from "./skill";
import { FormatSchema } from "./catalog";
import { PreferencesSchema, ProfileSkillLevelSchema } from "./profile";

/**
 * Structured intake card (D-13): what Nova shows when a goal exists but the learner has
 * stated no skills. A presentation of ProfileOps — the engine never sees it.
 */
export const ProfileCardSchema = z.object({
  id: z.string().min(1),
  /** The goal the skills were derived from (template id or the custom goal text). */
  goal: z.object({ label: z.string().min(1), templateId: z.string().min(1).optional() }),
  skills: z
    .array(
      z.object({
        skillId: z.string().min(1),
        name: z.string().min(1),
        domain: DomainSchema,
        /** Level already on the profile, so the card starts from what Nova inferred. */
        current: ProfileSkillLevelSchema,
      }),
    )
    .min(1)
    .max(40),
  preferences: PreferencesSchema,
});

export const ProfileCardAnswerSchema = z.object({
  cardId: z.string().min(1),
  /** Only skills the learner touched; absent = leave as is. Level 0 = "not yet". */
  skills: z.record(z.string(), ProfileSkillLevelSchema),
  hoursPerWeek: PreferencesSchema.shape.hoursPerWeek,
  pace: PreferencesSchema.shape.pace,
  budget: PreferencesSchema.shape.budget,
  formats: z.array(FormatSchema),
});

export type ProfileCard = z.infer<typeof ProfileCardSchema>;
export type ProfileCardAnswer = z.infer<typeof ProfileCardAnswerSchema>;
