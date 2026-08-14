import { z } from "zod";
import { SkillLevelSchema } from "./skill";

export const CatalogKindSchema = z.enum(["course", "project", "assessment"]);
export const FormatSchema = z.enum(["video", "interactive", "text", "project"]);
export const CostSchema = z.enum(["free", "freemium", "paid"]);
export const DifficultySchema = z.literal([1, 2, 3, 4, 5]);

export const SkillRefSchema = z.object({
  skillId: z.string().min(1),
  level: SkillLevelSchema,
});

export const CatalogItemSchema = z.object({
  id: z.string().min(1),
  kind: CatalogKindSchema,
  title: z.string().min(1),
  provider: z.string().min(1),
  url: z.url(),
  description: z.string().min(1),
  skillsTaught: z.array(SkillRefSchema),
  skillsRequired: z.array(SkillRefSchema),
  difficulty: DifficultySchema,
  durationHours: z.number().positive(),
  format: FormatSchema,
  cost: CostSchema,
  qualityPrior: z.number().min(0).max(1),
});

export type CatalogKind = z.infer<typeof CatalogKindSchema>;
export type Format = z.infer<typeof FormatSchema>;
export type Cost = z.infer<typeof CostSchema>;
export type CatalogItem = z.infer<typeof CatalogItemSchema>;
