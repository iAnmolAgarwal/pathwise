import type { Skill, SkillEdge } from "@/schemas";

/**
 * Test convenience only: the path-driving edge set a hand-written skill list implies
 * (one authored, no-data edge per prereq). Production data comes from skill_edges.json.
 */
export function authoredEdges(skills: Pick<Skill, "id" | "prereqs">[]): SkillEdge[] {
  return skills.flatMap((s) =>
    s.prereqs.map((p) => ({ from: p, to: s.id, origin: "authored" as const, status: "no-data" as const, drivesPath: true, sources: {} })),
  );
}
