import { z } from "zod";

// Open string until the M1 taxonomy fixes the closed ~10-domain vocabulary.
export const DomainSchema = z.string().min(1);

export const LevelBandSchema = z.literal([1, 2, 3]);
export const SkillLevelSchema = z.literal([1, 2, 3]);

export const SkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: DomainSchema,
  description: z.string().min(1),
  levelBand: LevelBandSchema,
  // Prereq edges must form a DAG; pipeline/validate.py asserts acyclicity.
  prereqs: z.array(z.string().min(1)),
});

export const GoalTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  requiredSkills: z.array(
    z.object({ skillId: z.string().min(1), level: SkillLevelSchema }),
  ),
});

export type Domain = z.infer<typeof DomainSchema>;
export type SkillLevel = z.infer<typeof SkillLevelSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type GoalTemplate = z.infer<typeof GoalTemplateSchema>;
