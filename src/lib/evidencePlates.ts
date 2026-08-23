import { BADGE_ANCHOR_EDGE, edgeCardLines, type EdgeCardLines } from "@/lib/edgeCard";
import { loadEngineData } from "@/lib/engineData";
import { loadGraphEvidence, type GraphEdgeSource } from "@/lib/graphEvidence";
import { SOURCE_NAME } from "@/lib/learnerEvidence";
import type { EvidenceSource } from "@/schemas";

/**
 * What the landing's evidence plates show: the anchor edge exactly as the app's click card prints
 * it, plus the six N-2 fields per source and the fixed per-source caveat. Every value is copied
 * from skill_edges.json at build time; nothing here is typed in. Server-only.
 */
export type EvidencePlateSource = {
  id: EvidenceSource;
  name: string;
  support: number;
  reverse: number;
  confidence: number;
  n: number;
  caveat: string;
  /** Whether this source confirms the authored direction at the pipeline's floor. */
  confirms: boolean;
};

export type EvidencePlates = {
  from: string;
  to: string;
  card: EdgeCardLines;
  sources: EvidencePlateSource[];
};

export function loadEvidencePlates(): EvidencePlates {
  const graph = loadGraphEvidence();
  const data = loadEngineData();
  const edge = graph.edges.find((e) => e.from === BADGE_ANCHOR_EDGE.from && e.to === BADGE_ANCHOR_EDGE.to);
  if (!edge) throw new Error(`evidencePlates: anchor edge ${BADGE_ANCHOR_EDGE.from} → ${BADGE_ANCHOR_EDGE.to} is not drawn`);
  const nameOf = (id: string) => data.skills.find((s) => s.id === id)?.name ?? id;
  const card = edgeCardLines(edge, nameOf, graph.thresholds);
  const sources = (["stackoverflow", "coursera"] as const)
    .map((id): EvidencePlateSource | null => {
      const stat: GraphEdgeSource | undefined = edge.sources[id];
      if (!stat) return null;
      return { id, name: SOURCE_NAME[id], support: stat.support, reverse: stat.reverse, confidence: stat.confidence, n: stat.n, caveat: graph.caveats[id], confirms: card.confirmedBy.includes(id) };
    })
    .filter((s): s is EvidencePlateSource => s !== null);
  return { from: nameOf(edge.from), to: nameOf(edge.to), card, sources };
}
