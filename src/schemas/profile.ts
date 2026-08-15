import { z } from "zod";
import { SkillLevelSchema } from "./skill";
import { FormatSchema } from "./catalog";

export const ProfileGoalSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("role"), templateId: z.string().min(1) }),
  z.object({
    type: z.literal("custom"),
    text: z.string().min(1),
    mappedSkills: z.array(
      z.object({ skillId: z.string().min(1), level: SkillLevelSchema }),
    ),
  }),
]);

export const ProfileSkillLevelSchema = z.literal([0, 1, 2, 3]);
export const SkillSourceSchema = z.enum(["stated", "inferred", "assessed"]);

export const PreferencesSchema = z.object({
  hoursPerWeek: z.number().positive(),
  formats: z.array(FormatSchema), // empty = no preference
  budget: z.enum(["free-only", "any"]),
  pace: z.enum(["relaxed", "standard", "intense"]),
});

/** Memo of what the learner turned down (§5.5 not_interested): items are excluded, providers/formats penalised. */
export const DislikesSchema = z.object({
  catalogIds: z.array(z.string().min(1)),
  providers: z.array(z.string().min(1)),
  formats: z.array(FormatSchema),
});

export const ProfileSchema = z.object({
  goals: z.array(ProfileGoalSchema),
  skills: z.record(
    z.string(),
    z.object({ level: ProfileSkillLevelSchema, source: SkillSourceSchema }),
  ),
  preferences: PreferencesSchema,
  dislikes: DislikesSchema.optional(),
});

// set_preference is typed per key so the same schema doubles as the LLM's output contract.
const SetPreferenceOpSchema = z.discriminatedUnion("key", [
  z.object({
    op: z.literal("set_preference"),
    key: z.literal("hoursPerWeek"),
    value: PreferencesSchema.shape.hoursPerWeek,
  }),
  z.object({
    op: z.literal("set_preference"),
    key: z.literal("formats"),
    value: PreferencesSchema.shape.formats,
  }),
  z.object({
    op: z.literal("set_preference"),
    key: z.literal("budget"),
    value: PreferencesSchema.shape.budget,
  }),
  z.object({
    op: z.literal("set_preference"),
    key: z.literal("pace"),
    value: PreferencesSchema.shape.pace,
  }),
]);

const AddGoalOpSchema = z.object({ op: z.literal("add_goal"), goal: ProfileGoalSchema });
const RemoveGoalOpSchema = z.object({ op: z.literal("remove_goal"), index: z.number().int().nonnegative() });
const setSkillOp = <S extends z.ZodType>(source: S) =>
  z.object({ op: z.literal("set_skill"), skillId: z.string().min(1), level: ProfileSkillLevelSchema, source });

// The LLM never writes Profile directly: it emits ProfileOp[], applied deterministically.
// This is the LLM's contract: it may state or infer levels but never assess them or veto items.
export const ChatProfileOpSchema = z.discriminatedUnion("op", [
  AddGoalOpSchema,
  RemoveGoalOpSchema,
  setSkillOp(z.enum(["stated", "inferred"])),
  SetPreferenceOpSchema,
]);

// The full op vocabulary: adds what only the feedback rules (§5.5) may produce.
export const ProfileOpSchema = z.discriminatedUnion("op", [
  AddGoalOpSchema,
  RemoveGoalOpSchema,
  setSkillOp(SkillSourceSchema),
  SetPreferenceOpSchema,
  z.object({
    op: z.literal("avoid"),
    catalogId: z.string().min(1),
    provider: z.string().min(1).optional(),
    format: FormatSchema.optional(),
  }),
]);

export type ProfileGoal = z.infer<typeof ProfileGoalSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type Dislikes = z.infer<typeof DislikesSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileOp = z.infer<typeof ProfileOpSchema>;
