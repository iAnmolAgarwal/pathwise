import type { GoalTemplate, Profile, ProfileOp, Skill } from "@/schemas";
import type { ProfileCard, ProfileCardAnswer } from "@/schemas/profileCard";

/**
 * Structured intake (D-13), pure on both sides: build the card from the learner's goal,
 * and turn the learner's answer back into ProfileOps for the normal application rules.
 */

/** Skills a goal needs plus everything they build on, sorted by domain then name. */
export function relevantSkillsForGoal(required: { skillId: string }[], skills: Skill[]): Skill[] {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const stack = required.map((r) => r.skillId);
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    stack.push(...byId.get(id)!.prereqs);
  }
  return [...seen]
    .map((id) => byId.get(id)!)
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
}

export function buildProfileCard(
  id: string,
  profile: Profile,
  data: { skills: Skill[]; goals: GoalTemplate[] },
): ProfileCard | { error: string } {
  const goal = profile.goals.at(-1);
  if (!goal) return { error: "The profile has no goal yet; record one with apply_profile_ops first." };
  let label: string;
  let templateId: string | undefined;
  let required: { skillId: string }[];
  if (goal.type === "role") {
    const template = data.goals.find((g) => g.id === goal.templateId);
    if (!template) return { error: `Unknown goal template ${goal.templateId}` };
    label = template.title;
    templateId = template.id;
    required = template.requiredSkills;
  } else {
    label = goal.text;
    required = goal.mappedSkills;
  }
  const skills = relevantSkillsForGoal(required, data.skills);
  if (skills.length === 0) return { error: "The goal maps to no known skills." };
  return {
    id,
    goal: { label, templateId },
    skills: skills.slice(0, 40).map((s) => ({
      skillId: s.id,
      name: s.name,
      domain: s.domain,
      current: profile.skills[s.id]?.level ?? 0,
    })),
    preferences: profile.preferences,
  };
}

/** Only what changed becomes an op, so the profile log stays honest about what the learner said. */
export function profileCardAnswerToOps(answer: ProfileCardAnswer, card: ProfileCard): ProfileOp[] {
  const ops: ProfileOp[] = [];
  const known = new Map(card.skills.map((s) => [s.skillId, s.current]));
  for (const [skillId, level] of Object.entries(answer.skills)) {
    if (!known.has(skillId)) continue;
    if (known.get(skillId) === level) continue;
    ops.push({ op: "set_skill", skillId, level, source: "stated" });
  }
  const p = card.preferences;
  if (answer.hoursPerWeek !== p.hoursPerWeek) ops.push({ op: "set_preference", key: "hoursPerWeek", value: answer.hoursPerWeek });
  if (answer.pace !== p.pace) ops.push({ op: "set_preference", key: "pace", value: answer.pace });
  if (answer.budget !== p.budget) ops.push({ op: "set_preference", key: "budget", value: answer.budget });
  const sameFormats = answer.formats.length === p.formats.length && answer.formats.every((f) => p.formats.includes(f));
  if (!sameFormats) ops.push({ op: "set_preference", key: "formats", value: answer.formats });
  return ops;
}

/** The message the client sends after the card, so Nova generates and narrates (§8.3). */
export function profileCardFollowUp(answer: ProfileCardAnswer, card: ProfileCard, skipped: boolean): string {
  if (skipped) return "Skip the check-in for now — just build my path with what you have.";
  const stated = Object.entries(answer.skills).filter(([, level]) => level > 0);
  const names = stated.map(([id, level]) => `${card.skills.find((s) => s.skillId === id)?.name ?? id} (level ${level})`);
  const known = names.length ? `I already know ${names.join(", ")}.` : "I'm starting from scratch on these.";
  return `I've filled in the check-in. ${known} I can do ${answer.hoursPerWeek} hours a week at a ${answer.pace} pace, ${answer.budget === "free-only" ? "free courses only" : "paid is fine"}. Build my path.`;
}
