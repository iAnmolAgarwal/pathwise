import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEngineData } from "@/lib/engineData";
import { loadGraphEvidence, meetsPromotionThresholds } from "@/lib/graphEvidence";

// The explorer's edge slice must agree with what the pipeline reported: every path-driving
// edge, plus exactly the mined candidates merge_edges.py listed as meeting the §15.6 thresholds.

const report = JSON.parse(readFileSync(join(__dirname, "..", "pipeline", "evidence", "agreement_report.json"), "utf8"));
const graph = loadGraphEvidence();
const data = loadEngineData();

describe("graph evidence slice", () => {
  it("contains every path-driving edge with its status and source numbers", () => {
    const driving = data.skillEdges.filter((e) => e.drivesPath);
    const inGraph = new Map(graph.edges.map((e) => [`${e.from}>${e.to}`, e]));
    for (const e of driving) {
      const g = inGraph.get(`${e.from}>${e.to}`);
      expect(g, `${e.from}>${e.to}`).toBeDefined();
      expect(g!.status).toBe(e.status);
      for (const src of ["stackoverflow", "coursera"] as const) {
        expect(g!.sources[src]?.n).toBe(e.sources[src]?.n);
        expect(g!.sources[src]?.confidence).toBe(e.sources[src]?.confidence);
        if (e.sources[src]) expect(graph.caveats[src]).toBe(e.sources[src]!.caveat);
      }
    }
  });

  it("includes exactly the mined candidates the agreement report counts as meeting the promotion thresholds", () => {
    const candidates = graph.edges.filter((e) => e.origin === "mined");
    expect(candidates.length).toBe(report.mined.meetingPromotionThresholds);
    expect(candidates.every((e) => !e.drivesPath && (e.status === "candidate" || e.status === "promoted"))).toBe(true);
  });

  it("agrees with merge_edges.py on the candidate set, source by source", () => {
    const header = (graph as unknown as { thresholds: { promoteConfidence: number; promoteSupport: number; promoteCorroboration: number } }).thresholds;
    const soTags = (JSON.parse(readFileSync(join(__dirname, "..", "src", "data", "skill_edges.json"), "utf8")) as { stackoverflow: { tags: Record<string, string[]> } }).stackoverflow.tags;
    const mined = data.skillEdges.filter((e) => e.origin === "mined" && meetsPromotionThresholds(e, soTags, header));
    expect(mined.length).toBe(report.mined.meetingPromotionThresholds);
  });

  it("carries the caveats, the Stack Overflow tags behind every skill on an edge, and Coursera pairs for the popover", () => {
    expect(graph.caveats.stackoverflow).toMatch(/asking ≠ completing/);
    expect(graph.caveats.coursera).toMatch(/review order/);
    for (const e of graph.edges) {
      if (e.sources.stackoverflow) {
        expect((graph.soTags[e.from]?.length ?? 0) + (graph.soTags[e.to]?.length ?? 0), `${e.from}>${e.to}`).toBeGreaterThan(0);
      }
      if (e.sources.coursera) expect(e.sources.coursera.nCoursePairs).toBeGreaterThan(0);
    }
  });

  it("is a small payload (the 8k weak candidates never reach the client)", () => {
    expect(graph.edges.length).toBeLessThan(600);
    expect(JSON.stringify(graph).length).toBeLessThan(200_000);
  });
});
