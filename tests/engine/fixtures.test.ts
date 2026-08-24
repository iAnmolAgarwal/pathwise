import { describe, expect, it } from "vitest";
import { generatePath } from "@/engine";
import { loadEngineData } from "@/lib/engineData";
import { PathSchema } from "@/schemas";
import { FIXTURE_LEARNERS } from "../fixtures/learners";

const NOW = "2026-08-15T00:00:00.000Z";
const data = loadEngineData();
const catalogById = new Map(data.catalog.map((c) => [c.id, c]));

/** Compact, human-readable view of a path so snapshot diffs are reviewable. */
function summarize(profileName: string) {
  const { path, working } = generatePath(FIXTURE_LEARNERS[profileName], data, {
    now: NOW,
    trigger: "initial",
  });
  return {
    path,
    summary: {
      gapSkills: working.gap.map((g) => `${g.skillId}:${g.currentLevel}->${g.targetLevel}`),
      budgetHours: working.budgetHours,
      usedHours: working.usedHours,
      stoppedBecause: working.stoppedBecause,
      uncovered: working.uncovered.map((u) => `${u.skillId}:${u.levelsMissing}`),
      phases: path.phases.map((p) => ({
        title: p.title,
        milestone: p.milestone,
        items: p.items.map((i) => {
          const c = catalogById.get(i.catalogId)!;
          return `${c.kind}:${c.id} (${c.durationHours}h, score ${i.evidence.scoreBreakdown.total.toFixed(3)})`;
        }),
      })),
    },
  };
}

describe("fixture learners (§5.6)", () => {
  for (const name of Object.keys(FIXTURE_LEARNERS)) {
    describe(name, () => {
      const { path, summary } = summarize(name);

      it("produces a schema-valid, non-empty path", () => {
        expect(PathSchema.safeParse(path).success).toBe(true);
        expect(path.phases.length).toBeGreaterThan(0);
        expect(path.phases.flatMap((p) => p.items).length).toBeGreaterThanOrEqual(3);
      });

      it("matches its snapshot", () => {
        expect(summary).toMatchSnapshot();
      });

      it("is deterministic across runs", () => {
        expect(summarize(name).path).toEqual(path);
      });
    });
  }

  it("beginner-frontend reaches React and builds a real-world project after it", () => {
    const { path } = summarize("beginner-frontend");
    const ids = path.phases.flatMap((p) => p.items.map((i) => i.catalogId));
    expect(ids.some((id) => catalogById.get(id)!.skillsTaught.some((t) => t.skillId === "react"))).toBe(true);
    const html = ids.findIndex((id) => catalogById.get(id)!.skillsTaught.some((t) => t.skillId === "html"));
    const react = ids.findIndex((id) => catalogById.get(id)!.skillsTaught.some((t) => t.skillId === "react"));
    expect(html).toBeLessThan(react);
    const lastProject = ids.findLastIndex((id) => catalogById.get(id)!.kind === "project");
    expect(lastProject).toBeGreaterThan(react);
  });

  it("time-poor-cloud stays within its small budget", () => {
    const { summary } = summarize("time-poor-cloud");
    expect(summary.usedHours).toBeLessThanOrEqual(summary.budgetHours);
    expect(summary.stoppedBecause).toBe("budget");
  });

  it("custom-goal covers its mapped skills completely", () => {
    const { summary } = summarize("custom-goal");
    expect(summary.stoppedBecause).toBe("covered");
    expect(summary.uncovered).toEqual([]);
  });

  it("partial-skills-ml never re-teaches skills the learner already holds at target level", () => {
    const { path, summary } = summarize("partial-skills-ml");
    expect(summary.gapSkills.some((g) => g.startsWith("python:"))).toBe(false);
    for (const item of path.phases.flatMap((p) => p.items)) {
      for (const g of item.evidence.gapSkillsCovered) expect(g.skillId).not.toBe("python");
    }
  });

  it("evidence carries a full score breakdown and a real URL for every item", () => {
    for (const name of Object.keys(FIXTURE_LEARNERS)) {
      const { path } = summarize(name);
      for (const item of path.phases.flatMap((p) => p.items)) {
        const b = item.evidence.scoreBreakdown;
        expect(b.total).toBeGreaterThan(0);
        expect(item.evidence.provenance).toBe(catalogById.get(item.catalogId)!.url);
        expect(item.evidence.gapSkillsCovered.length).toBeGreaterThan(0);
      }
    }
  });
});
