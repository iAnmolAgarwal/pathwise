import { describe, expect, it } from "vitest";
import type { GraphEdge } from "@/lib/graphEvidence";
import { loadGraphEvidence } from "@/lib/graphEvidence";
import { BADGE_ANCHOR_EDGE, edgeCardLines, leadSource, sourceConfirms } from "@/lib/edgeCard";

const floor = { confirmConfidence: 0.7, confirmN: 20 };
const nameOf = (id: string) => ({ javascript: "JavaScript", react: "React", css: "CSS", html: "HTML" })[id] ?? id;
const base: GraphEdge = { from: "javascript", to: "react", origin: "authored", status: "confirmed-one-source", drivesPath: true, sources: {} };
const so = { support: 50452, reverse: 14143, confidence: 0.781, n: 64595 };
const cs = { support: 30, reverse: 10, confidence: 0.75, n: 40, nCoursePairs: 2 };

describe("edge click card (de-clutter, item 8)", () => {
  it("reads 'A before B' · 'Verified by k of 2 sources' · the largest source's count and share", () => {
    const lines = edgeCardLines({ ...base, status: "confirmed-both", sources: { stackoverflow: so, coursera: cs } }, nameOf, floor);
    expect(lines.order).toBe("JavaScript before React");
    expect(lines.verdict).toBe("Verified by 2 of 2 sources");
    expect(lines.count).toBe("64,595 learners, 78 % in this order · Stack Overflow");
    expect(lines.lead).toBe("stackoverflow");
    expect(lines.confirmedBy).toEqual(["stackoverflow", "coursera"]);
  });

  it("counts only sources at the pipeline's confirm floor", () => {
    const weak = { ...cs, confidence: 0.6 };
    const lines = edgeCardLines({ ...base, sources: { stackoverflow: so, coursera: weak } }, nameOf, floor);
    expect(lines.verdict).toBe("Verified by 1 of 2 sources");
    expect(sourceConfirms(weak, floor)).toBe(false);
    expect(sourceConfirms({ ...cs, n: 19 }, floor)).toBe(false);
  });

  it("says 'No confirming data yet' for an authored link nothing confirms, with the count still quoted when a source saw it", () => {
    expect(edgeCardLines({ ...base, status: "no-data" }, nameOf, floor)).toMatchObject({ verdict: "No confirming data yet", verdictKind: "none", count: null, lead: null });
    const seen = edgeCardLines({ ...base, status: "no-data", sources: { stackoverflow: { ...so, confidence: 0.5 } } }, nameOf, floor);
    expect(seen.verdict).toBe("No confirming data yet");
    expect(seen.count).toBe("64,595 learners, 50 % in this order · Stack Overflow");
  });

  it("says 'Under review' for a contradicted link and marks a mined candidate as not path-driving", () => {
    expect(edgeCardLines({ ...base, status: "contradicted-in-review", sources: { coursera: cs } }, nameOf, floor).verdict).toBe("Under review");
    expect(edgeCardLines({ ...base, origin: "mined", status: "candidate", drivesPath: false, sources: { stackoverflow: so } }, nameOf, floor).verdictKind).toBe("candidate");
  });

  it("leads with the source that saw more sequences", () => {
    expect(leadSource({ ...base, sources: { coursera: { ...cs, n: 70000 }, stackoverflow: so } })).toBe("coursera");
    expect(leadSource(base)).toBeNull();
  });

  it("carries no rating words on any real edge (N-5), and every N-2 field survives into the details data", () => {
    const graph = loadGraphEvidence();
    const nameOfReal = (id: string) => id;
    const banned = /satisf|struggl|\bhard\b|\beasy\b|rating|rated|liked|enjoy/i;
    for (const e of graph.edges) {
      const lines = edgeCardLines(e, nameOfReal, graph.thresholds);
      expect(`${lines.order} ${lines.verdict} ${lines.count ?? ""}`).not.toMatch(banned);
      for (const s of ["stackoverflow", "coursera"] as const) {
        const stat = e.sources[s];
        if (!stat) continue;
        for (const k of ["support", "reverse", "confidence", "n"] as const) expect(typeof stat[k]).toBe("number");
        expect(graph.caveats[s].length).toBeGreaterThan(0);
      }
    }
    expect(graph.edges.filter((e) => e.drivesPath).length).toBe(193);
  });

  it("the badge anchor is an authored, path-driving arrow verified by both sources (javascript → react is a mined candidate, so it cannot anchor)", () => {
    const graph = loadGraphEvidence();
    const e = graph.edges.find((x) => x.from === BADGE_ANCHOR_EDGE.from && x.to === BADGE_ANCHOR_EDGE.to)!;
    expect(e.drivesPath).toBe(true);
    const lines = edgeCardLines(e, nameOf, graph.thresholds);
    expect(lines.verdict).toBe("Verified by 2 of 2 sources");
    expect(lines.lead).toBe("stackoverflow");
    const jsReact = graph.edges.find((x) => x.from === "javascript" && x.to === "react");
    expect(jsReact?.drivesPath ?? false).toBe(false);
  });
});
