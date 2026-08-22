import { describe, expect, it } from "vitest";
import { BADGE_ANCHOR_EDGE } from "@/lib/edgeCard";
import { carryGraphQuery, graphQuery, parseGraphQuery } from "@/lib/graphLink";

describe("trust-badge deep link", () => {
  it("round-trips the anchor edge through the query string", () => {
    const q = graphQuery(BADGE_ANCHOR_EDGE);
    expect(q).toBe("?tab=graph&edge=python%3Epython-data-analysis");
    expect(parseGraphQuery(new URLSearchParams(q))).toEqual({ tab: "graph", edge: { from: "python", to: "python-data-analysis" } });
    expect(parseGraphQuery({ tab: "graph", edge: "python>python-data-analysis" })).toEqual({ tab: "graph", edge: BADGE_ANCHOR_EDGE });
  });

  it("ignores other tabs and malformed edges, and carries only what it parsed", () => {
    expect(parseGraphQuery({ tab: "path" })).toBeNull();
    expect(parseGraphQuery({ tab: "graph", edge: "<script>" })).toEqual({ tab: "graph", edge: null });
    expect(parseGraphQuery({ tab: ["graph", "graph"] })).toBeNull();
    expect(carryGraphQuery({})).toBe("");
    expect(carryGraphQuery({ tab: "graph", edge: "a>b", other: "x" } as never)).toBe("?tab=graph&edge=a%3Eb");
  });
});
