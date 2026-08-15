import type { CatalogItem, Domain, Skill } from "../schemas";
import type { SequenceEdge } from "./types";

/** Antichains larger than this are split into consecutive phases so each stays digestible. */
export const MAX_PHASE_ITEMS = 4;

export type Sequenced = {
  ordered: CatalogItem[];
  phases: CatalogItem[][];
  edges: SequenceEdge[];
};

/**
 * Item A precedes item B when A teaches a skill that B requires, or a skill that is a
 * prerequisite (in the skill DAG) of something B teaches and B does not teach itself.
 * Assessments are never treated as teachers.
 */
export function precedenceEdges(items: CatalogItem[], skills: Skill[]): SequenceEdge[] {
  const prereqsOf = new Map(skills.map((s) => [s.id, s.prereqs]));
  const edges: SequenceEdge[] = [];
  for (const a of items) {
    // Assessments validate skills rather than teach them, so they never precede anything by teaching.
    if (a.kind === "assessment") continue;
    const taughtByA = new Set(a.skillsTaught.map((t) => t.skillId));
    for (const b of items) {
      if (a.id === b.id) continue;
      const taughtByB = new Set(b.skillsTaught.map((t) => t.skillId));
      const because = new Set<string>();
      for (const r of b.skillsRequired) if (taughtByA.has(r.skillId)) because.add(r.skillId);
      for (const t of b.skillsTaught) {
        for (const p of prereqsOf.get(t.skillId) ?? []) {
          if (taughtByA.has(p) && !taughtByB.has(p)) because.add(p);
        }
      }
      // One edge per pair; the first (most specific) reason is kept.
      const [becauseSkill] = because;
      if (becauseSkill) edges.push({ from: a.id, to: b.id, becauseSkill });
    }
  }
  return edges;
}

function tieBreak(a: CatalogItem, b: CatalogItem): number {
  return (
    a.difficulty - b.difficulty ||
    a.durationHours - b.durationHours ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Topological sort of items over the induced precedence order (§5.4), ties broken by
 * difficulty then duration. Phases are the longest-path layers (antichains) of that
 * order. Requirement cycles — possible in a hand-annotated catalog — are broken by
 * releasing the easiest stuck item, so every item is always placed exactly once.
 */
export function sequenceItems(items: CatalogItem[], skills: Skill[]): Sequenced {
  const byId = new Map(items.map((i) => [i.id, i]));
  const allEdges = precedenceEdges(items, skills);
  const incoming = new Map<string, Set<string>>(items.map((i) => [i.id, new Set()]));
  const outgoing = new Map<string, Set<string>>(items.map((i) => [i.id, new Set()]));
  for (const e of allEdges) {
    incoming.get(e.to)!.add(e.from);
    outgoing.get(e.from)!.add(e.to);
  }

  const layer = new Map<string, number>();
  const remaining = new Set(items.map((i) => i.id));
  const keptEdges: SequenceEdge[] = [];
  const edgeKey = (from: string, to: string) => `${from}→${to}`;
  const droppedEdges = new Set<string>();

  while (remaining.size > 0) {
    let ready = [...remaining].filter((id) => incoming.get(id)!.size === 0);
    if (ready.length === 0) {
      // Cycle: release the easiest stuck item by discarding its remaining incoming edges.
      const stuck = [...remaining].map((id) => byId.get(id)!).sort(tieBreak)[0];
      for (const from of incoming.get(stuck.id)!) droppedEdges.add(edgeKey(from, stuck.id));
      incoming.get(stuck.id)!.clear();
      ready = [stuck.id];
    }
    // Longest-path layering: an item's layer is one past its deepest predecessor.
    for (const id of ready) {
      const preds = allEdges
        .filter((e) => e.to === id && !droppedEdges.has(edgeKey(e.from, e.to)))
        .map((e) => layer.get(e.from) ?? 0);
      layer.set(id, preds.length === 0 ? 0 : Math.max(...preds) + 1);
      remaining.delete(id);
      for (const to of outgoing.get(id)!) incoming.get(to)?.delete(id);
    }
  }
  for (const e of allEdges) if (!droppedEdges.has(edgeKey(e.from, e.to))) keptEdges.push(e);

  const depth = Math.max(-1, ...layer.values()) + 1;
  const layers: CatalogItem[][] = Array.from({ length: depth }, () => []);
  for (const item of items) layers[layer.get(item.id)!].push(item);
  const phases: CatalogItem[][] = [];
  for (const l of layers) {
    l.sort(tieBreak);
    for (let i = 0; i < l.length; i += MAX_PHASE_ITEMS) phases.push(l.slice(i, i + MAX_PHASE_ITEMS));
  }
  return { ordered: phases.flat(), phases, edges: keptEdges };
}

const DOMAIN_LABEL: Record<Domain, string> = {
  foundations: "Programming",
  "web-frontend": "Frontend",
  "web-backend": "Backend",
  "data-engineering": "Data Engineering",
  "data-analysis": "Data Analysis",
  "machine-learning": "Machine Learning",
  "ai-engineering": "AI Engineering",
  cloud: "Cloud",
  devops: "DevOps",
  security: "Security",
};

const TIER_WORD = ["Foundations", "Core", "Advanced"] as const;

const MILESTONES: Record<Domain, [string, string, string]> = {
  foundations: [
    "Write and run small programs on your own",
    "Solve multi-step problems with clean, tested code",
    "Design and structure a non-trivial codebase",
  ],
  "web-frontend": [
    "Publish a responsive static page",
    "Build and deploy a component-driven interface",
    "Ship a production-grade frontend with tests and tooling",
  ],
  "web-backend": [
    "Serve data from a simple API",
    "Build a database-backed service with authentication",
    "Operate a scalable, secured backend in production",
  ],
  "data-engineering": [
    "Move data between systems reliably",
    "Build a scheduled, tested data pipeline",
    "Run a warehouse-backed platform with quality checks",
  ],
  "data-analysis": [
    "Answer a question from a real dataset",
    "Deliver an analysis with charts and a clear story",
    "Own an end-to-end analytics workflow for stakeholders",
  ],
  "machine-learning": [
    "Train and evaluate a first model",
    "Build a well-evaluated model on real data",
    "Deploy and monitor a model in production",
  ],
  "ai-engineering": [
    "Call an LLM from code and shape its output",
    "Ship a grounded, evaluated LLM application",
    "Run agentic, tool-using AI systems safely",
  ],
  cloud: [
    "Deploy something to a cloud account",
    "Architect a multi-service cloud application",
    "Design resilient, cost-aware cloud platforms",
  ],
  devops: [
    "Version, containerise, and run an app locally",
    "Automate build, test, and deploy pipelines",
    "Operate infrastructure as code with observability",
  ],
  security: [
    "Understand the threat model of a web app",
    "Find and fix common vulnerabilities hands-on",
    "Run security operations and respond to incidents",
  ],
};

/** Phase title from the dominant domain and level tier; milestone from the template table. */
export function namePhase(
  index: number,
  items: CatalogItem[],
  skills: Skill[],
): { title: string; milestone: string } {
  const domainOf = new Map(skills.map((s) => [s.id, s.domain]));
  const weight = new Map<Domain, number>();
  let levelSum = 0;
  let levelCount = 0;
  for (const item of items) {
    for (const t of item.skillsTaught) {
      const d = domainOf.get(t.skillId);
      if (!d) continue;
      weight.set(d, (weight.get(d) ?? 0) + t.level);
      levelSum += t.level;
      levelCount += 1;
    }
  }
  const domain =
    [...weight.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    "foundations";
  const tier = levelCount === 0 ? 0 : Math.min(2, Math.max(0, Math.round(levelSum / levelCount) - 1));
  const label = DOMAIN_LABEL[domain];
  const title =
    tier === 0
      ? `Phase ${index + 1} — ${label} ${TIER_WORD[0]}`
      : `Phase ${index + 1} — ${TIER_WORD[tier]} ${label}`;
  return { title, milestone: MILESTONES[domain][tier] };
}
