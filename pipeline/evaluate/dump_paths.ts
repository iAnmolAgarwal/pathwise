/**
 * Emits the evaluation corpus of generated paths as JSON (stdout or --out <file>):
 * the five fixture learners plus every goal template under three canonical profiles
 * (empty, partial, time-poor). Read by pipeline/evaluate/*.py; runs the engine exactly as
 * the product does, nothing else.
 *
 *   npx tsx pipeline/evaluate/dump_paths.ts --out pipeline/build/evaluate/paths.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { generatePath } from "@/engine";
import { requiredSkillsForGoals } from "@/engine/gap";
import { loadEngineData } from "@/lib/engineData";
import type { Profile, SkillEdge } from "@/schemas";
import { FIXTURE_LEARNERS } from "../../tests/fixtures/learners";

const NOW = "2026-08-19T00:00:00.000Z";

const basePrefs: Profile["preferences"] = { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" };

/**
 * Canonical "partial" learner for a template: already holds, at level 2, every skill in the
 * goal's prerequisite closure that depends on nothing else inside that closure (the
 * foundations), and at level 1 the skills one step above them. The rest is the gap.
 */
function partialSkills(templateId: string, data: ReturnType<typeof loadEngineData>): Profile["skills"] {
  const required = requiredSkillsForGoals([{ type: "role", templateId }], data.goals);
  const driving = data.skillEdges.filter((e: SkillEdge) => e.drivesPath);
  const prereqsOf = new Map<string, string[]>();
  for (const e of driving) prereqsOf.set(e.to, [...(prereqsOf.get(e.to) ?? []), e.from]);
  const closure = new Set<string>();
  const stack = required.map((r) => r.skillId);
  while (stack.length) {
    const s = stack.pop()!;
    if (closure.has(s)) continue;
    closure.add(s);
    stack.push(...(prereqsOf.get(s) ?? []));
  }
  const depth = new Map<string, number>();
  const depthOf = (s: string): number => {
    if (depth.has(s)) return depth.get(s)!;
    const ps = (prereqsOf.get(s) ?? []).filter((p) => closure.has(p));
    const d = ps.length === 0 ? 0 : 1 + Math.max(...ps.map(depthOf));
    depth.set(s, d);
    return d;
  };
  const skills: Profile["skills"] = {};
  for (const s of [...closure].sort()) {
    const d = depthOf(s);
    if (d === 0) skills[s] = { level: 2, source: "stated" };
    else if (d === 1) skills[s] = { level: 1, source: "stated" };
  }
  return skills;
}

function templateProfiles(data: ReturnType<typeof loadEngineData>): Record<string, Profile> {
  const out: Record<string, Profile> = {};
  for (const g of data.goals) {
    const goals: Profile["goals"] = [{ type: "role", templateId: g.id }];
    out[`template:${g.id}:empty`] = { goals, skills: {}, preferences: basePrefs };
    out[`template:${g.id}:partial`] = { goals, skills: partialSkills(g.id, data), preferences: basePrefs };
    out[`template:${g.id}:time-poor`] = { goals, skills: {}, preferences: { ...basePrefs, hoursPerWeek: 3, pace: "intense" } };
  }
  return out;
}

function main() {
  const data = loadEngineData();
  const catalog = new Map(data.catalog.map((c) => [c.id, c]));
  const profiles: Record<string, Profile> = {
    ...Object.fromEntries(Object.entries(FIXTURE_LEARNERS).map(([k, v]) => [`fixture:${k}`, v])),
    ...templateProfiles(data),
  };
  const paths = Object.entries(profiles).map(([name, profile]) => {
    const { path, working } = generatePath(profile, data, { now: NOW, trigger: "initial" });
    let index = 0;
    const items = path.phases.flatMap((phase, phaseIndex) =>
      phase.items.map((it) => {
        const c = catalog.get(it.catalogId)!;
        return {
          index: index++,
          phaseIndex,
          phaseTitle: phase.title,
          catalogId: it.catalogId,
          kind: c.kind,
          title: c.title,
          skillsTaught: c.skillsTaught,
          evidence: it.evidence,
        };
      }),
    );
    return {
      name,
      kind: name.startsWith("fixture:") ? "fixture" : "template",
      profile,
      gapSkills: working.gap.map((g) => g.skillId),
      items,
    };
  });
  const out = {
    generatedAt: NOW,
    skills: data.skills.map((s) => ({ id: s.id, name: s.name, domain: s.domain })),
    paths,
  };
  const flag = process.argv.indexOf("--out");
  const text = JSON.stringify(out);
  if (flag >= 0 && process.argv[flag + 1]) {
    mkdirSync(dirname(process.argv[flag + 1]), { recursive: true });
    writeFileSync(process.argv[flag + 1], text + "\n");
    console.error(`wrote ${paths.length} paths to ${process.argv[flag + 1]}`);
  } else {
    process.stdout.write(text + "\n");
  }
}

main();
