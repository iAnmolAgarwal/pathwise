import type { Path, Profile } from "@/schemas";

const OPEN = new Set(["todo", "in_progress"]);

/**
 * What a learner at this stage is most likely to type next — shown as the composer's rotating
 * placeholder instead of the role carousel once a goal exists. Built from the real profile and
 * path (item titles, budget, hours), so every suggestion is something Nova can act on.
 * Returns null before a goal is recorded, when the role carousel is the right prompt.
 */
export function nextPrompts(profile: Profile, path: Path | null, titleOf: (catalogId: string) => string): string[] | null {
  if (profile.goals.length === 0) return null;
  if (!path || path.phases.length === 0) {
    return ["I already know some of this — let me tell you what", `I can do ${profile.preferences.hoursPerWeek} hours a week`, "Free courses only", "Build my path"];
  }
  const items = path.phases.flatMap((p) => p.items.map((i) => ({ ...i, phase: p.title })));
  const open = items.filter((i) => OPEN.has(i.status));
  if (open.length === 0) return ["I want a new goal", "What should I learn after this?", "Show me what I completed"];
  const [first, second] = open;
  const out = [`I finished ${titleOf(first.catalogId)}`, `Why is ${titleOf(first.catalogId)} on my path?`];
  if (second) out.push(`${titleOf(second.catalogId)} looks too hard for me`);
  out.push("What should I do next?");
  if (profile.preferences.budget !== "free-only") out.push("Swap anything paid for free courses");
  out.push(`Make it shorter — ${profile.preferences.hoursPerWeek} hours a week is all I have`);
  return out;
}
