import { describe, expect, it } from "vitest";
import { computeGap, requiredSkillsForGoals } from "@/engine/gap";
import type { Profile, Skill } from "@/schemas";
import { authoredEdges } from "./helpers";

const skills: Skill[] = [
  { id: "basics", name: "Basics", domain: "foundations", description: "x", levelBand: 1, prereqs: [] },
  { id: "js", name: "JavaScript", domain: "web-frontend", description: "x", levelBand: 1, prereqs: ["basics"] },
  { id: "ts", name: "TypeScript", domain: "web-frontend", description: "x", levelBand: 2, prereqs: ["js"] },
  { id: "react", name: "React", domain: "web-frontend", description: "x", levelBand: 2, prereqs: ["js"] },
  { id: "next", name: "Next.js", domain: "web-frontend", description: "x", levelBand: 3, prereqs: ["react", "ts"] },
];
const edges = authoredEdges(skills);

const goals = [
  {
    id: "fe",
    title: "Frontend",
    description: "x",
    requiredSkills: [
      { skillId: "react", level: 3 as const },
      { skillId: "ts", level: 2 as const },
    ],
  },
  {
    id: "next-dev",
    title: "Next dev",
    description: "x",
    requiredSkills: [{ skillId: "next", level: 2 as const }, { skillId: "react", level: 2 as const }],
  },
];

function profileWith(known: Record<string, 0 | 1 | 2 | 3>, goalIds: string[] = ["fe"]): Profile {
  return {
    goals: goalIds.map((templateId) => ({ type: "role", templateId })),
    skills: Object.fromEntries(
      Object.entries(known).map(([k, level]) => [k, { level, source: "stated" as const }]),
    ),
    preferences: { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" },
  };
}

describe("requiredSkillsForGoals", () => {
  it("unions template skills level-aware, keeping the max level", () => {
    const req = requiredSkillsForGoals(profileWith({}, ["fe", "next-dev"]).goals, goals);
    expect(req).toEqual([
      { skillId: "react", level: 3 },
      { skillId: "ts", level: 2 },
      { skillId: "next", level: 2 },
    ]);
  });

  it("includes custom goals' mapped skills", () => {
    const req = requiredSkillsForGoals(
      [{ type: "custom", text: "learn ts", mappedSkills: [{ skillId: "ts", level: 1 }] }],
      goals,
    );
    expect(req).toEqual([{ skillId: "ts", level: 1 }]);
  });

  it("ignores unknown template ids", () => {
    expect(requiredSkillsForGoals([{ type: "role", templateId: "nope" }], goals)).toEqual([]);
  });
});

describe("computeGap", () => {
  it("returns only skills below target level, tagged goal", () => {
    const gap = computeGap(profileWith({ ts: 2, js: 2, basics: 1 }), goals[0].requiredSkills, edges);
    const ids = gap.map((g) => g.skillId);
    expect(ids).toContain("react");
    expect(ids).not.toContain("ts");
    const react = gap.find((g) => g.skillId === "react")!;
    expect(react).toMatchObject({ targetLevel: 3, currentLevel: 0, reason: "goal" });
  });

  it("is level-aware: a partially known skill is still a gap", () => {
    const gap = computeGap(profileWith({ react: 1, js: 2, basics: 1, ts: 2 }), goals[0].requiredSkills, edges);
    expect(gap.find((g) => g.skillId === "react")).toMatchObject({ currentLevel: 1, targetLevel: 3 });
  });

  it("expands transitive prerequisites and tags them prereq-of", () => {
    const gap = computeGap(profileWith({}), goals[0].requiredSkills, edges);
    const byId = Object.fromEntries(gap.map((g) => [g.skillId, g]));
    expect(byId.js.reason).toMatch(/^prereq-of:(react|ts)$/);
    expect(byId.basics.reason).toBe("prereq-of:js");
  });

  it("does not add prerequisites the learner already knows", () => {
    const gap = computeGap(profileWith({ js: 2, basics: 1 }), goals[0].requiredSkills, edges);
    expect(gap.map((g) => g.skillId).sort()).toEqual(["react", "ts"]);
  });

  it("marks a skill 'goal' even if it is also someone's prerequisite", () => {
    const gap = computeGap(profileWith({}, ["next-dev"]), goals[1].requiredSkills, edges);
    expect(gap.find((g) => g.skillId === "react")!.reason).toBe("goal");
  });

  it("records graphPath from the nearest known skill to the goal skill", () => {
    const gap = computeGap(profileWith({ js: 2, basics: 1 }), goals[0].requiredSkills, edges);
    expect(gap.find((g) => g.skillId === "react")!.graphPath).toEqual(["js", "react"]);
  });

  it("records graphPath for a prerequisite through to the goal it serves", () => {
    const gap = computeGap(profileWith({ basics: 1 }), goals[0].requiredSkills, edges);
    const js = gap.find((g) => g.skillId === "js")!;
    expect(js.graphPath[0]).toBe("basics");
    expect(js.graphPath[1]).toBe("js");
    expect(["react", "ts"]).toContain(js.graphPath.at(-1));
  });

  it("orders goal gaps first, then prerequisites", () => {
    const gap = computeGap(profileWith({}), goals[0].requiredSkills, edges);
    const firstPrereq = gap.findIndex((g) => g.reason !== "goal");
    const lastGoal = gap.map((g) => g.reason).lastIndexOf("goal");
    expect(lastGoal).toBeLessThan(firstPrereq);
  });

  it("returns an empty gap when everything is known", () => {
    expect(computeGap(profileWith({ react: 3, ts: 2, js: 2, basics: 1 }), goals[0].requiredSkills, edges)).toEqual([]);
  });
});
