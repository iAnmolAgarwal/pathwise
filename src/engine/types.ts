import type {
  CatalogItem,
  GapReason,
  GoalTemplate,
  ScoreBreakdown,
  Skill,
  SkillLevel,
} from "../schemas";

/** Everything the engine needs, passed in explicitly so the engine performs no I/O. */
export type EngineData = {
  skills: Skill[];
  goals: GoalTemplate[];
  catalog: CatalogItem[];
  embeddings: Record<string, number[]>;
};

export type ProfileLevel = 0 | 1 | 2 | 3;

export type Gap = {
  skillId: string;
  targetLevel: SkillLevel;
  currentLevel: ProfileLevel;
  reason: GapReason;
  /** Chain from the nearest known skill through this skill to the goal skill it serves. */
  graphPath: string[];
};

export type Candidate = {
  item: CatalogItem;
  breakdown: ScoreBreakdown;
  /** Gap skills this item advances, with the levels it contributes. */
  gapSkills: { skillId: string; taughtLevel: SkillLevel; levelsGained: number }[];
};

export type SequenceEdge = { from: string; to: string; becauseSkill: string };
