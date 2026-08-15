import type { CatalogItem, Path, Profile } from "@/schemas";

/**
 * Compact, human-readable renderings of learner state for message turns. These live in
 * the *messages*, never in the system prompt, so the cached prefix stays byte-stable.
 */

const LEVEL = ["none", "basics", "comfortable", "strong"] as const;

export function summarizeProfile(
  profile: Profile,
  skillNames: Record<string, string>,
  templateTitles: Record<string, string>,
): string {
  const goals =
    profile.goals.length === 0
      ? "none yet"
      : profile.goals
          .map((g, i) =>
            g.type === "role"
              ? `[${i}] role: ${templateTitles[g.templateId] ?? g.templateId} (${g.templateId})`
              : `[${i}] custom: "${g.text}" → ${g.mappedSkills.map((s) => `${s.skillId}@${s.level}`).join(", ") || "unmapped"}`,
          )
          .join("; ");
  const skills = Object.entries(profile.skills)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, s]) => `${skillNames[id] ?? id} (${id}) ${LEVEL[s.level]}, ${s.source}`)
    .join("; ");
  const p = profile.preferences;
  return [
    `Goals: ${goals}`,
    `Skills: ${skills || "none recorded"}`,
    `Preferences: ${p.hoursPerWeek} h/week, pace ${p.pace}, budget ${p.budget}, formats ${p.formats.length ? p.formats.join("/") : "any"}`,
  ].join("\n");
}

export function summarizePath(
  path: Path,
  version: number,
  catalog: Map<string, CatalogItem>,
): string {
  const lines = path.phases.map((phase, i) => {
    const items = phase.items
      .map((it) => {
        const c = catalog.get(it.catalogId);
        return c ? `${c.title} [${it.catalogId}, ${c.kind}, ${c.durationHours}h]` : it.catalogId;
      })
      .join("; ");
    return `Phase ${i + 1} "${phase.title}" — milestone: ${phase.milestone}. Items: ${items}`;
  });
  const hours = path.phases.flatMap((p) => p.items).reduce((h, it) => h + (catalog.get(it.catalogId)?.durationHours ?? 0), 0);
  return [`Path version ${version}, ${path.phases.length} phases, ~${Math.round(hours)} hours total.`, ...lines].join("\n");
}
