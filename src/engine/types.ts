import type {
  Branch,
  CatalogItem,
  GapReason,
  GoalTemplate,
  ScoreBreakdown,
  Skill,
  SkillEdge,
  SkillLevel,
} from "../schemas";

/** Everything the engine needs, passed in explicitly so the engine performs no I/O. */
export type EngineData = {
  skills: Skill[];
  goals: GoalTemplate[];
  catalog: CatalogItem[];
  embeddings: Record<string, number[]>;
  /** The merged, tiered edge set (skill_edges.json); the engine walks only the path-driving edges. */
  skillEdges: SkillEdge[];
  /** "What learners did next" per skill and source (branches.json); evidence only, never control. */
  branches: Branch[];
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

/** hard: `to` lists the skill in skillsRequired; soft: it is a prerequisite of a skill `to` teaches. */
export type SequenceEdge = { from: string; to: string; becauseSkill: string; hard: boolean };
