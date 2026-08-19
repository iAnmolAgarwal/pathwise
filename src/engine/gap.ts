import type { Profile, SkillLevel } from "../schemas";
import { prereqMap, type PathEdge } from "./edges";
import type { Gap, ProfileLevel } from "./types";

type SkillRef = { skillId: string; level: SkillLevel };
type GoalTemplateLike = { id: string; requiredSkills: SkillRef[] };

/** Level-aware union of every goal's required skills (max level wins, first-seen order). */
export function requiredSkillsForGoals(
  goals: Profile["goals"],
  templates: GoalTemplateLike[],
): SkillRef[] {
  const byId = new Map<string, GoalTemplateLike>(templates.map((t) => [t.id, t]));
  const required = new Map<string, SkillLevel>();
  for (const goal of goals) {
    const refs =
      goal.type === "role" ? (byId.get(goal.templateId)?.requiredSkills ?? []) : goal.mappedSkills;
    for (const { skillId, level } of refs) {
      const prev = required.get(skillId) ?? 0;
      if (level > prev) required.set(skillId, level);
    }
  }
  return [...required].map(([skillId, level]) => ({ skillId, level }));
}

export function currentLevel(profile: Profile, skillId: string): ProfileLevel {
  return profile.skills[skillId]?.level ?? 0;
}

/**
 * A prerequisite is needed one level below the skill that depends on it (floor 1):
 * React at 3 needs JavaScript at 2, which needs Programming Basics at 1.
 */
export function prereqLevelFor(dependentTarget: SkillLevel): SkillLevel {
  return Math.max(1, dependentTarget - 1) as SkillLevel;
}

/**
 * Skill-gap analysis (§5.1): direct goal gaps first, then transitive prerequisites
 * discovered by BFS over the path-driving edges of the skill DAG. Each gap carries a
 * graphPath from the nearest known skill through itself to the goal skill it serves.
 */
export function computeGap(profile: Profile, required: SkillRef[], edges: readonly PathEdge[]): Gap[] {
  const prereqsOf = prereqMap(edges);
  const gaps = new Map<string, Gap>();

  const direct = required.filter(({ skillId, level }) => currentLevel(profile, skillId) < level);
  for (const { skillId, level } of direct) {
    gaps.set(skillId, {
      skillId,
      targetLevel: level,
      currentLevel: currentLevel(profile, skillId),
      reason: "goal",
      graphPath: [skillId],
    });
  }

  // BFS outward from the direct gaps; chainToGoal is [self, ..., goalSkill].
  const queue: { skillId: string; chainToGoal: string[]; targetLevel: SkillLevel }[] = direct.map(
    (d) => ({ skillId: d.skillId, chainToGoal: [d.skillId], targetLevel: d.level }),
  );
  while (queue.length > 0) {
    const { skillId, chainToGoal, targetLevel } = queue.shift()!;
    const needed = prereqLevelFor(targetLevel);
    for (const prereqId of prereqsOf.get(skillId) ?? []) {
      const have = currentLevel(profile, prereqId);
      if (have >= needed) continue;
      const existing = gaps.get(prereqId);
      if (existing) {
        if (needed > existing.targetLevel) existing.targetLevel = needed;
        continue;
      }
      const chain = [prereqId, ...chainToGoal];
      gaps.set(prereqId, {
        skillId: prereqId,
        targetLevel: needed,
        currentLevel: have,
        reason: `prereq-of:${skillId}`,
        graphPath: chain,
      });
      queue.push({ skillId: prereqId, chainToGoal: chain, targetLevel: needed });
    }
  }

  // Prepend the nearest known prerequisite so the UI can say "you know X → this unlocks Y".
  for (const gap of gaps.values()) {
    const known = (prereqsOf.get(gap.skillId) ?? []).find(
      (p) => currentLevel(profile, p) >= 1,
    );
    if (known) gap.graphPath = [known, ...gap.graphPath];
  }

  return [...gaps.values()];
}
