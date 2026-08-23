import { z } from "zod";
import { DomainSchema } from "./skill";

/** What `/api/dashboard/[learnerId]` returns (§6, §9.3): the engine's summary, validated at the boundary. */

export const SkillStatusSchema = z.enum(["acquired", "in-progress", "gap", "unrelated"]);

export const NextActionSchema = z.object({
  catalogId: z.string().nullable(),
  title: z.string().nullable(),
  kind: z.string().nullable(),
  hours: z.number().nullable(),
  phase: z.string().nullable(),
  why: z.string(),
});

export const StreakSchema = z.object({
  current: z.number().int().min(0),
  longest: z.number().int().min(0),
  activeDays: z.array(z.string()),
});

const DoneTotal = z.object({ done: z.number().int().min(0), total: z.number().int().min(0) });

export const DifficultySplitSchema = z.object({ easy: DoneTotal, medium: DoneTotal, hard: DoneTotal });

export const ActivityCalendarSchema = z.object({
  weeks: z.array(z.array(z.object({ day: z.string(), active: z.boolean() }))),
  months: z.array(z.object({ label: z.string(), week: z.number().int().min(0) })),
  activeDays: z.number().int().min(0),
});

export const AchievementIdSchema = z.enum([
  "first-path",
  "first-done",
  "streak-7",
  "streak-30",
  "foundations",
  "explorer",
  "hard-mode",
  "depth",
  "phase-1",
  "goal-complete",
]);

export const AchievementSchema = z.object({
  id: AchievementIdSchema,
  name: z.string(),
  hint: z.string(),
  earned: z.boolean(),
});

export const DashboardSummarySchema = z.object({
  progress: z.object({
    percent: z.number().min(0).max(100),
    attainedLevels: z.number().min(0),
    requiredLevels: z.number().min(0),
    itemsDone: z.number().int().min(0),
    itemsTotal: z.number().int().min(0),
  }),
  radar: z.array(z.object({ domain: DomainSchema, label: z.string(), known: z.number(), required: z.number() })),
  timeline: z.array(
    z.object({
      title: z.string(),
      milestone: z.string(),
      itemsDone: z.number().int().min(0),
      itemsTotal: z.number().int().min(0),
      complete: z.boolean(),
      active: z.boolean(),
    }),
  ),
  nextAction: NextActionSchema,
  streak: StreakSchema,
  difficulty: DifficultySplitSchema,
  activity: ActivityCalendarSchema,
  achievements: z.array(AchievementSchema),
  gap: z.array(
    z.object({
      skillId: z.string(),
      targetLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      currentLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
      reason: z.string(),
    }),
  ),
  skillStatus: z.record(z.string(), SkillStatusSchema),
  today: z.string(),
});

export type DashboardSummaryOut = z.infer<typeof DashboardSummarySchema>;
