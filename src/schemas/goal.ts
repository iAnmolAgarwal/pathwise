import { z } from "zod";
import { SkillLevelSchema } from "./skill";

/**
 * A free-text goal mapped onto the closed skill vocabulary (D-05). Built per call so the
 * skillId enum is exactly the taxonomy shipped with the app; the LLM cannot invent skills.
 */
export function mappedGoalSchema(skillIds: readonly string[]) {
  const ids = [...skillIds];
  const SkillIdSchema = z.enum(ids as [string, ...string[]]);
  return z.object({
    /** Short restatement of the goal in the learner's words. */
    text: z.string().min(1),
    /** Whether the goal is essentially one of the role templates (by id) or truly custom. */
    matchesTemplateId: z.string().nullable(),
    mappedSkills: z.array(z.object({ skillId: SkillIdSchema, level: SkillLevelSchema })),
    /** One or two sentences a learner could read: why these skills. */
    rationale: z.string(),
  });
}

export type MappedGoal = z.infer<ReturnType<typeof mappedGoalSchema>>;
