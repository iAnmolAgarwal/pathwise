import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compactCount, loadTrustNumbers } from "@/lib/trust";

const report = JSON.parse(readFileSync(join(__dirname, "..", "pipeline", "evidence", "agreement_report.json"), "utf8"));

describe("landing trust numbers come from the committed files", () => {
  it("matches the agreement report field for field", () => {
    const t = loadTrustNumbers();
    expect(t.authoredEdges).toBe(report.authoredEdges);
    expect(t.observable).toBe(report.observable.anySource);
    expect(t.confirmedAny).toBe(report.confirmed.anySource);
    expect(t.confirmedPct).toBe(report.confirmed.pctOfObservableAny);
    expect(t.confirmedBoth).toBe(report.confirmed.both);
    expect(t.contradicted).toBe(report.contradicted.count);
    expect(t.resolved).toBe(report.contradicted.resolved);
    expect(t.promoted).toBe(report.mined.promoted);
    expect(t.skills).toBe(159);
    expect(t.catalogItems).toBe(246);
    expect(t.soUsers).toBeGreaterThan(1_000_000);
    expect(t.courseraLearners).toBeGreaterThan(10_000);
  });

  it("formats counts without rounding up", () => {
    expect(compactCount(2_137_848)).toBe("2.1 M");
    expect(compactCount(2_199_999)).toBe("2.1 M");
    expect(compactCount(72_774)).toBe("72,774");
  });
});
