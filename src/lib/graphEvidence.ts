import { z } from "zod";
import skillEdgesJson from "@/data/skill_edges.json";
import { loadEngineData } from "@/lib/engineData";
import type { EvidenceSource, SkillEdge } from "@/schemas";

/**
 * The slice of skill_edges.json the skill-graph explorer renders (§9.3): every path-driving
 * edge, plus the mined-only candidates that meet the §15.6 promotion thresholds — the same set
 * pipeline/sources/promotions.md lists for human review. The other ~8k mined pairs stay in the
 * data file as evidence and never reach the client. Built server-side, passed as props.
 */

/** One source's numbers for one edge. The caveat and the Stack Overflow tags live once in GraphEvidence. */
export type GraphEdgeSource = {
  support: number;
  reverse: number;
  confidence: number;
  n: number;
  /** Coursera: distinct course pairs pooled and the top pairs behind the direction. */
  nCoursePairs?: number;
  coursePairs?: { from: string; to: string; support: number }[];
};

export type GraphEdge = {
  from: string;
  to: string;
  origin: SkillEdge["origin"];
  status: SkillEdge["status"];
  drivesPath: boolean;
  sources: Partial<Record<EvidenceSource, GraphEdgeSource>>;
  resolution?: { decision: string; note: string; date: string };
};

export type GraphEvidence = {
  edges: GraphEdge[];
  /** Fixed per-source caveat, rendered wherever that source's numbers are (N-2). */
  caveats: Record<EvidenceSource, string>;
  /** Stack Overflow tags behind each skill (the hand-built tag → skill map, §15.2). */
  soTags: Record<string, string[]>;
  thresholds: PromotionThresholds;
};

export type PromotionThresholds = { promoteConfidence: number; promoteSupport: number; promoteCorroboration: number };

const HeaderSchema = z.object({
  caveats: z.object({ stackoverflow: z.string(), coursera: z.string() }),
  stackoverflow: z.object({ tags: z.record(z.string(), z.array(z.string())) }),
  thresholds: z.object({
    promoteConfidence: z.number(),
    promoteSupport: z.number(),
    promoteCorroboration: z.number().int(),
  }),
});

/** Corroboration as merge_edges.py counts it: Coursera = distinct course pairs; Stack Overflow = distinct tags behind the two skills. */
function corroboration(source: EvidenceSource, stat: SkillEdge["sources"][EvidenceSource], from: string, to: string, soTags: Record<string, string[]>): number {
  if (source === "coursera") return stat?.detail?.nCoursePairs ?? 0;
  return new Set([...(soTags[from] ?? []), ...(soTags[to] ?? [])]).size;
}

/** §15.6: a mined edge is a promotion candidate when one source clears confidence, support and corroboration. */
export function meetsPromotionThresholds(edge: SkillEdge, soTags: Record<string, string[]>, t: PromotionThresholds): boolean {
  return (["stackoverflow", "coursera"] as const).some((source) => {
    const stat = edge.sources[source];
    if (!stat) return false;
    return stat.confidence >= t.promoteConfidence && stat.support >= t.promoteSupport && corroboration(source, stat, edge.from, edge.to, soTags) >= t.promoteCorroboration;
  });
}

function toGraphEdge(edge: SkillEdge): GraphEdge {
  const sources: GraphEdge["sources"] = {};
  for (const source of ["stackoverflow", "coursera"] as const) {
    const stat = edge.sources[source];
    if (!stat) continue;
    const base: GraphEdgeSource = { support: stat.support, reverse: stat.reverse, confidence: stat.confidence, n: stat.n };
    if (source === "coursera") {
      base.nCoursePairs = stat.detail?.nCoursePairs;
      base.coursePairs = stat.detail?.coursePairs?.map((p) => ({ from: p.fromCourseId, to: p.toCourseId, support: p.support }));
    }
    sources[source] = base;
  }
  return {
    from: edge.from,
    to: edge.to,
    origin: edge.origin,
    status: edge.status,
    drivesPath: edge.drivesPath,
    sources,
    ...(edge.resolution ? { resolution: { decision: edge.resolution.decision, note: edge.resolution.note, date: edge.resolution.date } } : {}),
  };
}

let cached: GraphEvidence | null = null;

export function loadGraphEvidence(): GraphEvidence {
  if (cached) return cached;
  const header = HeaderSchema.parse(skillEdgesJson);
  const soTags = header.stackoverflow.tags;
  const edges = loadEngineData()
    .skillEdges.filter((e) => e.drivesPath || meetsPromotionThresholds(e, soTags, header.thresholds))
    .map(toGraphEdge);
  // Only the tags of skills that appear on a rendered edge travel to the client.
  const onEdges = new Set(edges.flatMap((e) => [e.from, e.to]));
  const tags = Object.fromEntries(Object.entries(soTags).filter(([id]) => onEdges.has(id)));
  cached = { edges, caveats: header.caveats, soTags: tags, thresholds: header.thresholds };
  return cached;
}
