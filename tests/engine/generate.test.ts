import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, generatePath } from "@/engine";
import { PACE_HORIZON_WEEKS } from "@/engine/select";
import type { EngineData } from "@/engine/types";
import { PathSchema, type CatalogItem, type Profile } from "@/schemas";

function item(over: Partial<CatalogItem> & { id: string }): CatalogItem {
  return {
    kind: "course",
    title: over.id,
    provider: "P",
    url: `https://example.com/${over.id}`,
    description: "x",
    skillsTaught: [],
    skillsRequired: [],
    difficulty: 1,
    durationHours: 10,
    format: "video",
    cost: "free",
    qualityPrior: 0.5,
    ...over,
  };
}

const data: EngineData = {
  skills: [
    { id: "js", name: "JavaScript", domain: "web-frontend", description: "x", levelBand: 1, prereqs: [] },
    { id: "react", name: "React", domain: "web-frontend", description: "x", levelBand: 2, prereqs: ["js"] },
    { id: "testing", name: "Testing", domain: "web-frontend", description: "x", levelBand: 2, prereqs: ["js"] },
  ],
  goals: [
    {
      id: "fe",
      title: "Frontend",
      description: "x",
      requiredSkills: [{ skillId: "react", level: 2 }, { skillId: "testing", level: 1 }],
    },
  ],
  catalog: [
    item({ id: "js-course", skillsTaught: [{ skillId: "js", level: 2 }] }),
    item({ id: "react-course", skillsTaught: [{ skillId: "react", level: 2 }], skillsRequired: [{ skillId: "js", level: 1 }], difficulty: 2 }),
    item({ id: "testing-course", skillsTaught: [{ skillId: "testing", level: 1 }], skillsRequired: [{ skillId: "js", level: 1 }], difficulty: 2 }),
    item({ id: "react-project", kind: "project", skillsTaught: [{ skillId: "react", level: 2 }], skillsRequired: [{ skillId: "react", level: 1 }], durationHours: 5 }),
    item({ id: "js-quiz", kind: "assessment", skillsTaught: [{ skillId: "js", level: 1 }], durationHours: 1 }),
  ],
  embeddings: {},
};

const profile: Profile = {
  goals: [{ type: "role", templateId: "fe" }],
  skills: {},
  preferences: { hoursPerWeek: 10, formats: [], budget: "any", pace: "standard" },
};

const NOW = "2026-08-15T00:00:00.000Z";

describe("generatePath", () => {
  const { path, working } = generatePath(profile, data, { now: NOW, trigger: "initial" });

  it("produces a Path that validates against PathSchema", () => {
    expect(PathSchema.safeParse(path).success).toBe(true);
    expect(path.meta).toEqual({ generatedAt: NOW, engineVersion: ENGINE_VERSION, trigger: "initial" });
  });

  it("phases courses in dependency order", () => {
    const ids = path.phases.map((p) => p.items.map((i) => i.catalogId));
    expect(ids[0]).toContain("js-course");
    expect(ids.flat().indexOf("js-course")).toBeLessThan(ids.flat().indexOf("react-course"));
  });

  it("puts the project after the courses of its phase and the assessment at the boundary", () => {
    const phaseWithProject = path.phases.find((p) => p.items.some((i) => i.catalogId === "react-project"))!;
    const kinds = phaseWithProject.items.map((i) => data.catalog.find((c) => c.id === i.catalogId)!.kind);
    expect(kinds.indexOf("project")).toBeGreaterThan(kinds.lastIndexOf("course"));
    const phaseWithQuiz = path.phases.find((p) => p.items.some((i) => i.catalogId === "js-quiz"))!;
    expect(phaseWithQuiz.items.at(-1)!.catalogId).toBe("js-quiz");
  });

  it("attaches evidence to every item with sequencedAfter pointing at earlier items", () => {
    const seen: string[] = [];
    for (const phase of path.phases) {
      for (const it of phase.items) {
        expect(it.status).toBe("todo");
        expect(it.evidence.catalogId).toBe(it.catalogId);
        for (const after of it.evidence.sequencedAfter) expect(seen).toContain(after.catalogId);
        seen.push(it.catalogId);
      }
    }
    const react = path.phases.flatMap((p) => p.items).find((i) => i.catalogId === "react-course")!;
    expect(react.evidence.sequencedAfter).toEqual([{ catalogId: "js-course", becauseSkill: "js" }]);
    expect(react.evidence.gapSkillsCovered[0]).toMatchObject({ skillId: "react", reason: "goal" });
  });

  it("gives every phase a title and milestone", () => {
    for (const [i, phase] of path.phases.entries()) {
      expect(phase.title).toContain(`Phase ${i + 1}`);
      expect(phase.milestone).toBeTruthy();
    }
  });

  it("exposes its working: gap, candidates, budget, and stop reason", () => {
    expect(working.gap.map((g) => g.skillId).sort()).toEqual(["js", "react", "testing"]);
    expect(working.candidates.length).toBeGreaterThan(0);
    expect(working.budgetHours).toBe(10 * PACE_HORIZON_WEEKS.standard);
    expect(working.stoppedBecause).toBe("covered");
  });

  it("returns an empty path for a learner with no gap", () => {
    const done: Profile = {
      ...profile,
      skills: { js: { level: 2, source: "stated" }, react: { level: 2, source: "stated" }, testing: { level: 1, source: "stated" } },
    };
    const res = generatePath(done, data, { now: NOW, trigger: "initial" });
    expect(res.path.phases).toEqual([]);
    expect(PathSchema.safeParse(res.path).success).toBe(true);
  });
});
