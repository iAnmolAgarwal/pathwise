import { describe, expect, it } from "vitest";
import type { DashboardSummary } from "@/engine/dashboard";
import { computeDashboard } from "@/lib/dashboard";
import { generatePath } from "@/engine";
import { defaultProfile } from "@/engine/profile";
import { loadEngineData } from "@/lib/engineData";
import { DashboardSummarySchema, DescribedEvidenceSchema, type DashboardSummaryOut } from "@/schemas";
import { describeEvidence } from "@/llm/tools";

// The schema and the engine type must describe the same shape, in both directions.
const _engineToSchema: DashboardSummaryOut = null as unknown as DashboardSummary;
const _schemaToEngine: DashboardSummary = null as unknown as DashboardSummaryOut;
void _engineToSchema;
void _schemaToEngine;

describe("dashboard and explain output schemas", () => {
  const data = loadEngineData();
  const profile = { ...defaultProfile(), goals: [{ type: "role" as const, templateId: "data-analyst" }] };
  const { path } = generatePath(profile, data, { now: "2026-08-23T00:00:00Z", trigger: "initial" });

  it("accepts a computed dashboard with and without a path", () => {
    expect(() => DashboardSummarySchema.parse(computeDashboard(profile, path, ["2026-08-22"]))).not.toThrow();
    expect(() => DashboardSummarySchema.parse(computeDashboard(defaultProfile(), null, []))).not.toThrow();
  });

  it("accepts every described evidence object on a generated path", () => {
    for (const item of path.phases.flatMap((p) => p.items)) {
      expect(() => DescribedEvidenceSchema.parse(describeEvidence(item.evidence, data))).not.toThrow();
    }
  });
});
