import type { EngineData } from "@/engine/types";
import type { Profile } from "@/schemas";
import { FIXTURE_LEARNERS } from "./learners";

/**
 * A deterministic sweep: every goal template under several learner shapes, plus the five
 * fixtures. Known-skill sets are derived from the template's own requirements so each
 * profile is a plausible partial learner rather than random noise.
 */
export function sweepProfiles(data: EngineData): { name: string; profile: Profile }[] {
  const out: { name: string; profile: Profile }[] = Object.entries(FIXTURE_LEARNERS).map(
    ([name, profile]) => ({ name, profile }),
  );
  const prefs = (over: Partial<Profile["preferences"]>): Profile["preferences"] => ({
    hoursPerWeek: 6,
    formats: [],
    budget: "any",
    pace: "standard",
    ...over,
  });
  for (const goal of data.goals) {
    const role = { type: "role" as const, templateId: goal.id };
    const req = goal.requiredSkills;
    const half = Object.fromEntries(
      req.filter((_, i) => i % 2 === 0).map((r) => [r.skillId, { level: r.level, source: "stated" as const }]),
    );
    const belowTarget = Object.fromEntries(
      req.map((r) => [r.skillId, { level: Math.max(0, r.level - 1) as 0 | 1 | 2 | 3, source: "inferred" as const }]),
    );
    out.push({ name: `${goal.id}/blank`, profile: { goals: [role], skills: {}, preferences: prefs({}) } });
    out.push({ name: `${goal.id}/half`, profile: { goals: [role], skills: half, preferences: prefs({ hoursPerWeek: 10 }) } });
    out.push({
      name: `${goal.id}/one-below`,
      profile: { goals: [role], skills: belowTarget, preferences: prefs({ pace: "intense", hoursPerWeek: 4 }) },
    });
    out.push({
      name: `${goal.id}/free-text`,
      profile: {
        goals: [role],
        skills: {},
        preferences: prefs({ budget: "free-only", formats: ["text"], pace: "relaxed", hoursPerWeek: 3 }),
      },
    });
  }
  // Two goals at once.
  out.push({
    name: "multi-goal",
    profile: {
      goals: [
        { type: "role", templateId: data.goals[0].id },
        { type: "role", templateId: data.goals[data.goals.length - 1].id },
      ],
      skills: {},
      preferences: prefs({ hoursPerWeek: 12 }),
    },
  });
  return out;
}
