import { describe, expect, it } from "vitest";
import { generatePath, prereqMap } from "@/engine";
import { achievedLevels, unmetRequirements } from "@/engine/select";
import { loadEngineData } from "@/lib/engineData";
import type { CatalogItem, Profile } from "@/schemas";
import { FIXTURE_LEARNERS } from "../fixtures/learners";

const NOW = "2026-08-15T00:00:00.000Z";
const data = loadEngineData();
const catalogById = new Map(data.catalog.map((c) => [c.id, c]));

/**
 * A deterministic sweep: every goal template under several learner shapes, plus the five
 * fixtures. Known-skill sets are derived from the template's own requirements so each
 * profile is a plausible partial learner rather than random noise.
 */
function buildProfiles(): { name: string; profile: Profile }[] {
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

const cases = buildProfiles().map(({ name, profile }) => ({
  name,
  profile,
  result: generatePath(profile, data, { now: NOW, trigger: "initial" }),
}));

const flatItems = (phases: { items: { catalogId: string }[] }[]): CatalogItem[] =>
  phases.flatMap((p) => p.items.map((i) => catalogById.get(i.catalogId)!));

describe("engine properties (§5.6)", () => {
  it(`sweeps ${cases.length} profiles`, () => {
    expect(cases.length).toBeGreaterThan(60);
  });

  it("paths are always topologically valid over the honoured course-order edges", () => {
    for (const { name, result } of cases) {
      const order = new Map(flatItems(result.path.phases).map((c, i) => [c.id, i]));
      for (const e of result.working.courseOrderEdges) {
        expect(order.get(e.from), `${name}: ${e.from} → ${e.to} (${e.becauseSkill})`).toBeLessThan(
          order.get(e.to)!,
        );
      }
    }
  });

  it("never contains an item whose requirements are not met by the profile plus prior items", () => {
    for (const { name, profile, result } of cases) {
      const prior: CatalogItem[] = [];
      for (const item of flatItems(result.path.phases)) {
        const levels = achievedLevels(profile, prior.filter((p) => p.kind !== "assessment"));
        const unmet = unmetRequirements(item, levels);
        expect(unmet, `${name}: ${item.id} lacks ${JSON.stringify(unmet)}`).toEqual([]);
        prior.push(item);
      }
    }
  });

  it("every evidence.sequencedAfter points at an earlier item and a real skill link", () => {
    for (const { name, result } of cases) {
      const seen = new Set<string>();
      for (const item of result.path.phases.flatMap((p) => p.items)) {
        for (const after of item.evidence.sequencedAfter) {
          expect(seen.has(after.catalogId), `${name}: ${item.catalogId} after ${after.catalogId}`).toBe(true);
          const teacher = catalogById.get(after.catalogId)!;
          expect(teacher.skillsTaught.some((t) => t.skillId === after.becauseSkill)).toBe(true);
        }
        seen.add(item.catalogId);
      }
    }
  });

  it("always covers the gap or exhausts the budget (no eligible course left that fits and helps)", () => {
    for (const { name, profile, result } of cases) {
      const { gap, candidates, courseBudgetHours, uncovered, stoppedBecause } = result.working;
      if (uncovered.length === 0) {
        expect(stoppedBecause, name).toBe("covered");
        continue;
      }
      const courses = flatItems(result.path.phases).filter((c) => c.kind === "course");
      const courseHours = courses.reduce((h, c) => h + c.durationHours, 0);
      const levels = achievedLevels(profile, courses);
      const targets = new Map(gap.map((g) => [g.skillId, g.targetLevel]));
      const chosen = new Set(courses.map((c) => c.id));
      const offenders = candidates.filter((c) => {
        if (c.item.kind !== "course" || chosen.has(c.item.id)) return false;
        const gain = c.item.skillsTaught.reduce((g, t) => {
          const target = targets.get(t.skillId);
          return target === undefined ? g : g + Math.max(0, Math.min(t.level, target) - (levels.get(t.skillId) ?? 0));
        }, 0);
        if (gain === 0) return false;
        if (courseHours + c.item.durationHours > courseBudgetHours) return false;
        return unmetRequirements(c.item, levels).length === 0;
      });
      expect(offenders.map((c) => c.item.id), `${name} (${stoppedBecause})`).toEqual([]);
    }
  });

  it("stays within the total time budget", () => {
    for (const { name, result } of cases) {
      const hours = flatItems(result.path.phases).reduce((h, c) => h + c.durationHours, 0);
      expect(hours, name).toBeLessThanOrEqual(result.working.budgetHours);
      expect(result.working.usedHours).toBe(hours);
    }
  });

  it("never repeats an item and only recommends catalog items", () => {
    for (const { name, result } of cases) {
      const ids = result.path.phases.flatMap((p) => p.items.map((i) => i.catalogId));
      expect(new Set(ids).size, name).toBe(ids.length);
      for (const id of ids) expect(catalogById.has(id), `${name}: ${id}`).toBe(true);
    }
  });

  it("every item advances at least one gap or prerequisite skill, with a logged score", () => {
    for (const { name, result } of cases) {
      for (const item of result.path.phases.flatMap((p) => p.items)) {
        expect(item.evidence.gapSkillsCovered.length, `${name}: ${item.catalogId}`).toBeGreaterThan(0);
        expect(item.evidence.scoreBreakdown.total).toBeGreaterThan(0);
      }
    }
  });

  it("phases never exceed the size cap and are numbered consecutively", () => {
    for (const { name, result } of cases) {
      result.path.phases.forEach((p, i) => {
        expect(p.title, name).toMatch(new RegExp(`^Phase ${i + 1} — `));
        expect(p.items.filter((it) => catalogById.get(it.catalogId)!.kind === "course").length).toBeLessThanOrEqual(4);
      });
    }
  });

  it("the path-driving skill DAG is acyclic (engine precondition)", () => {
    const prereqs = prereqMap(data.skillEdges);
    const state = new Map<string, 1 | 2>();
    const visit = (id: string): boolean => {
      if (state.get(id) === 1) return false;
      if (state.get(id) === 2) return true;
      state.set(id, 1);
      for (const p of prereqs.get(id) ?? []) if (!visit(p)) return false;
      state.set(id, 2);
      return true;
    };
    for (const s of data.skills) expect(visit(s.id), s.id).toBe(true);
  });
});

describe("evidence score consistency", () => {
  it("every item's evidence coverage is measured against the same (evidence) gap", async () => {
    const { coverageOf } = await import("@/engine/score");
    for (const { name, result } of cases) {
      for (const item of result.path.phases.flatMap((p) => p.items)) {
        const expected = coverageOf(catalogById.get(item.catalogId)!, result.working.evidenceGap).coverage;
        expect(item.evidence.scoreBreakdown.coverage, `${name}: ${item.catalogId}`).toBeCloseTo(expected, 6);
      }
    }
  });
});

describe("engine module boundary (§3)", () => {
  it("src/engine imports nothing from llm/, db/, or app/ and reads no files", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(__dirname, "..", "..", "src", "engine");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const src = readFileSync(join(dir, file), "utf8");
      const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      expect(imports.filter((i) => /(^|\/)(llm|db|app)(\/|$)/.test(i) || /^node:|^fs$|^path$/.test(i)), file).toEqual([]);
    }
  });

  it("the path-driving edge set is authored ∪ promoted only (N-4)", () => {
    for (const e of data.skillEdges) {
      expect(e.drivesPath, `${e.from}>${e.to}`).toBe(e.origin === "authored" || e.status === "promoted");
    }
  });
});

describe("learner evidence on path items (§5.6, N-2)", () => {
  const byPair = new Map(data.skillEdges.map((e) => [`${e.from}>${e.to}`, e]));

  it("never cites an edge that is not in skill_edges.json, and copies that edge's numbers exactly", () => {
    let cited = 0;
    for (const { name, result } of cases) {
      for (const item of result.path.phases.flatMap((p) => p.items)) {
        for (const le of item.evidence.learnerEvidence?.edges ?? []) {
          cited++;
          const edge = byPair.get(`${le.from}>${le.to}`);
          expect(edge, `${name}: ${item.catalogId} cites ${le.from}>${le.to}`).toBeDefined();
          expect(edge!.drivesPath, `${name}: ${le.from}>${le.to} is not path-driving`).toBe(true);
          const stat = edge!.sources[le.source];
          expect(stat, `${name}: ${le.from}>${le.to} has no ${le.source} data`).toBeDefined();
          expect({ support: le.support, reverse: le.reverse, confidence: le.confidence, n: le.n, caveat: le.caveat }).toEqual({
            support: stat!.support, reverse: stat!.reverse, confidence: stat!.confidence, n: stat!.n, caveat: stat!.caveat,
          });
          expect(le.n).toBe(le.support + le.reverse);
        }
      }
    }
    expect(cited).toBeGreaterThan(0);
  });

  it("cites only edges the covered gap skill sits on, within its own graphPath", () => {
    for (const { name, result } of cases) {
      for (const item of result.path.phases.flatMap((p) => p.items)) {
        for (const le of item.evidence.learnerEvidence?.edges ?? []) {
          const onPath = item.evidence.gapSkillsCovered.some((g) => {
            if (g.skillId !== le.from && g.skillId !== le.to) return false;
            const i = g.graphPath.indexOf(le.from);
            return i >= 0 && g.graphPath[i + 1] === le.to;
          });
          expect(onPath, `${name}: ${item.catalogId} cites ${le.from}>${le.to}`).toBe(true);
        }
      }
    }
  });

  it("carries no satisfaction wording in any caveat (N-5)", () => {
    for (const { result } of cases) {
      for (const item of result.path.phases.flatMap((p) => p.items)) {
        const le = item.evidence.learnerEvidence;
        for (const e of le?.edges ?? []) expect(e.caveat).not.toMatch(/satisf|struggl|liked|\bhard\b/i);
        if (le?.branch) expect(le.branch.caveat).not.toMatch(/satisf|struggl|liked|\bhard\b/i);
      }
    }
  });

  it("a branch line comes only from a skill the learner has, above both floors, with branches.json's numbers verbatim (§15.8)", () => {
    const byKey = new Map(data.branches.map((b) => [`${b.from}|${b.source}`, b]));
    let cited = 0;
    for (const { name, result, profile } of cases) {
      const known = new Set(Object.entries(profile.skills).filter(([, v]) => v.level > 0).map(([id]) => id));
      for (const item of result.path.phases.flatMap((p) => p.items)) {
        const br = item.evidence.learnerEvidence?.branch;
        if (!br) continue;
        cited++;
        const label = `${name}: ${item.catalogId} branch ${br.from} → this (${br.source})`;
        expect(known.has(br.from), label).toBe(true);
        const entry = byKey.get(`${br.from}|${br.source}`);
        expect(entry?.minSupportMet, label).toBe(true);
        expect(br.nTotal, label).toBe(entry!.nTotal);
        expect(br.nTotal).toBeGreaterThanOrEqual(50);
        expect(br.toThis).toBeGreaterThanOrEqual(5);
        expect(br.caveat).toBe(entry!.caveat);
        // The step points at a skill the item teaches, and its numbers are the file's.
        const covered = new Set(item.evidence.gapSkillsCovered.map((g) => g.skillId));
        const step = entry!.next.find((x) => covered.has(x.to) && x.n === br.toThis && x.shareShrunk === br.shareShrunk);
        expect(step, label).toBeDefined();
      }
    }
    expect(cited).toBeGreaterThan(0);
  });

  it("learnerEvidence is never an empty shell", () => {
    for (const { result } of cases) {
      for (const item of result.path.phases.flatMap((p) => p.items)) {
        const le = item.evidence.learnerEvidence;
        if (le) expect(le.edges.length > 0 || le.branch !== undefined).toBe(true);
      }
    }
  });
});
