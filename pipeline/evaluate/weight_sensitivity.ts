/**
 * Weight sensitivity study (docs/EVALUATION.md §4). Perturbs ENGINE_WEIGHTS one axis at a
 * time by ±25 % and regenerates every path in the corpus — the five fixture learners plus
 * the property sweep — reporting how many path items change and whether any fixture's
 * phase order flips. Nothing here changes a weight; it measures how much each one matters.
 *
 *   npx tsx pipeline/evaluate/weight_sensitivity.ts [--out pipeline/evidence/weight_sensitivity.json] [--md]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ENGINE_WEIGHTS, generatePath } from "@/engine";
import type { EngineWeights } from "@/engine/score";
import { loadEngineData } from "@/lib/engineData";
import type { Path, Profile } from "@/schemas";
import { FIXTURE_LEARNERS } from "../../tests/fixtures/learners";
import { sweepProfiles } from "../../tests/fixtures/sweep";

const NOW = "2026-08-23T00:00:00.000Z";
const DELTA = 0.25;

type Axis = keyof EngineWeights;
const AXES = Object.keys(ENGINE_WEIGHTS) as Axis[];

type Shape = { items: string[]; phases: string[]; phaseOf: Map<string, number> };

function shape(path: Path): Shape {
  const items = path.phases.flatMap((p) => p.items.map((i) => i.catalogId));
  const phases = path.phases.map((p) => p.title.replace(/^Phase \d+ — /, ""));
  const phaseOf = new Map<string, number>();
  path.phases.forEach((p, idx) => p.items.forEach((i) => phaseOf.set(i.catalogId, idx)));
  return { items, phases, phaseOf };
}

/** What changed between the baseline path and a perturbed one, for one learner. */
function compare(base: Shape, alt: Shape) {
  const baseSet = new Set(base.items);
  const altSet = new Set(alt.items);
  const added = alt.items.filter((id) => !baseSet.has(id));
  const removed = base.items.filter((id) => !altSet.has(id));
  const shared = base.items.filter((id) => altSet.has(id));
  // Order among the items both paths contain: do the two paths list them in the same sequence?
  const altOrder = new Map(alt.items.map((id, i) => [id, i]));
  let reordered = 0;
  for (let i = 1; i < shared.length; i += 1) {
    if (altOrder.get(shared[i])! < altOrder.get(shared[i - 1])!) reordered += 1;
  }
  // Phase order: the sequence of phase titles (domains); a flip is the same titles in a different order.
  const samePhaseTitles = [...base.phases].sort().join("|") === [...alt.phases].sort().join("|");
  const phaseOrderFlipped = samePhaseTitles && base.phases.join("|") !== alt.phases.join("|");
  const phaseCountChanged = base.phases.length !== alt.phases.length;
  return { added, removed, reordered, phaseOrderFlipped, phaseCountChanged, baseItems: base.items.length };
}

function perturb(axis: Axis, sign: 1 | -1): EngineWeights {
  return { ...ENGINE_WEIGHTS, [axis]: Number((ENGINE_WEIGHTS[axis] * (1 + sign * DELTA)).toFixed(6)) };
}

type LearnerResult = ReturnType<typeof compare> & { name: string; fixture: boolean };

type AxisResult = {
  axis: Axis;
  direction: "+25%" | "-25%";
  weights: EngineWeights;
  learners: number;
  learnersChanged: number;
  itemsAdded: number;
  itemsRemoved: number;
  itemsChanged: number;
  itemsTotal: number;
  itemsChangedPct: number;
  reorderedLearners: number;
  phaseOrderFlips: number;
  phaseCountChanges: number;
  fixtureFlips: string[];
  /** Every learner (fixture or sweep) whose phase order flipped. */
  phaseFlipLearners: string[];
  fixtureChanges: { name: string; added: string[]; removed: string[]; reordered: number }[];
};

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const out = outIdx >= 0 ? args[outIdx + 1] : null;
  const md = args.includes("--md");

  const data = loadEngineData();
  const corpus = sweepProfiles(data);
  const fixtureNames = new Set(Object.keys(FIXTURE_LEARNERS));
  const baseline = new Map<string, Shape>();
  for (const { name, profile } of corpus) {
    baseline.set(name, shape(generatePath(profile, data, { now: NOW, trigger: "initial" }).path));
  }
  const itemsTotal = [...baseline.values()].reduce((n, s) => n + s.items.length, 0);

  const results: AxisResult[] = [];
  for (const axis of AXES) {
    for (const sign of [1, -1] as const) {
      const weights = perturb(axis, sign);
      const per: LearnerResult[] = corpus.map(({ name, profile }: { name: string; profile: Profile }) => {
        const alt = shape(generatePath(profile, data, { now: NOW, trigger: "initial", weights }).path);
        return { name, fixture: fixtureNames.has(name), ...compare(baseline.get(name)!, alt) };
      });
      const changed = per.filter((r) => r.added.length || r.removed.length || r.reordered || r.phaseOrderFlipped || r.phaseCountChanged);
      const itemsAdded = per.reduce((n, r) => n + r.added.length, 0);
      const itemsRemoved = per.reduce((n, r) => n + r.removed.length, 0);
      const itemsChanged = itemsAdded + itemsRemoved;
      results.push({
        axis,
        direction: sign > 0 ? "+25%" : "-25%",
        weights,
        learners: per.length,
        learnersChanged: changed.length,
        itemsAdded,
        itemsRemoved,
        itemsChanged,
        itemsTotal,
        itemsChangedPct: Number(((100 * itemsChanged) / itemsTotal).toFixed(2)),
        reorderedLearners: per.filter((r) => r.reordered > 0).length,
        phaseOrderFlips: per.filter((r) => r.phaseOrderFlipped).length,
        phaseCountChanges: per.filter((r) => r.phaseCountChanged).length,
        fixtureFlips: per.filter((r) => r.fixture && r.phaseOrderFlipped).map((r) => r.name),
        phaseFlipLearners: per.filter((r) => r.phaseOrderFlipped).map((r) => r.name),
        fixtureChanges: per
          .filter((r) => r.fixture && (r.added.length || r.removed.length || r.reordered))
          .map((r) => ({ name: r.name, added: r.added, removed: r.removed, reordered: r.reordered })),
      });
    }
  }

  const report = {
    generatedAt: NOW,
    delta: DELTA,
    baseline: ENGINE_WEIGHTS,
    corpus: { learners: corpus.length, fixtures: fixtureNames.size, items: itemsTotal },
    results,
  };

  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (md || !out) {
    const lines = [
      `Corpus: ${corpus.length} learners (${fixtureNames.size} fixtures + sweep), ${itemsTotal} path items at baseline. Perturbation ±${DELTA * 100} % per axis.`,
      "",
      "| axis | Δ | learners changed | items added | items removed | items changed (% of corpus) | learners reordered | phase-order flips | phase-count changes | fixture flips |",
      "|---|---|---|---|---|---|---|---|---|---|",
      ...results.map(
        (r) =>
          `| ${r.axis} | ${r.direction} | ${r.learnersChanged}/${r.learners} | ${r.itemsAdded} | ${r.itemsRemoved} | ${r.itemsChanged} (${r.itemsChangedPct} %) | ${r.reorderedLearners} | ${r.phaseOrderFlips} | ${r.phaseCountChanges} | ${r.fixtureFlips.length ? r.fixtureFlips.join(", ") : "none"} |`,
      ),
      "",
      "Phase-order flips (any learner):",
      ...results.flatMap((r) => r.phaseFlipLearners.map((n) => `- ${r.axis} ${r.direction} · ${n}`)),
      "",
      "Fixture-level changes:",
      ...results.flatMap((r) =>
        r.fixtureChanges.length
          ? r.fixtureChanges.map((f) => `- ${r.axis} ${r.direction} · ${f.name}: +${f.added.length} [${f.added.join(", ")}] −${f.removed.length} [${f.removed.join(", ")}]${f.reordered ? ` · ${f.reordered} order inversions` : ""}`)
          : [],
      ),
    ];
    console.log(lines.join("\n"));
  }
}

main();
