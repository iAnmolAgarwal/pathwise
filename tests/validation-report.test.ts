import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Smoke test for the offline pipeline: the committed validation report must be
// green and must match the current contents of src/data — so any drift between
// the data files and the last validate.py run fails CI-ish `npm test`.

const reportPath = join(__dirname, "..", "pipeline", "validation-report.json");
const dataDir = join(__dirname, "..", "src", "data");

describe("pipeline validation report", () => {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));

  it("passed its last run", () => {
    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("matches the committed data files (no drift since validation)", () => {
    for (const [name, expected] of Object.entries<string>(report.dataHashes)) {
      const actual = createHash("sha256")
        .update(readFileSync(join(dataDir, name)))
        .digest("hex");
      expect(`${name}:${actual}`).toBe(`${name}:${expected}`);
    }
  });

  it("meets the M1 floor counts", () => {
    expect(report.counts.skills).toBeGreaterThanOrEqual(150);
    expect(report.counts.goals).toBeGreaterThanOrEqual(15);
    expect(report.counts.courses).toBeGreaterThanOrEqual(150);
    expect(report.counts.embeddings).toBe(
      report.counts.skills +
        report.counts.courses +
        report.counts.projects +
        report.counts.assessments,
    );
  });
});
