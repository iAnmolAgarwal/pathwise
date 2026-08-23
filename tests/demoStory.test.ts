import { describe, expect, it } from "vitest";
import { demoNumbers, replayDemoStory } from "@/lib/demoStory";
import { loadEngineData } from "@/lib/engineData";

const data = loadEngineData();
const now = new Date("2026-08-23T12:00:00Z");

describe("the demo learner's story replays through the engine", () => {
  it("accepts every event the story lists", () => {
    const replay = replayDemoStory(data, now);
    expect(replay.skippedEvents).toEqual([]);
    expect(replay.replans.length).toBeGreaterThan(3);
  });

  it("is deterministic for a fixed clock", () => {
    expect(replayDemoStory(data, now).path).toEqual(replayDemoStory(data, now).path);
  });

  it("keeps the last seven days active so the streak is live", () => {
    const { streakDays } = demoNumbers(data, now);
    expect(streakDays).toBe(7);
  });
});

describe("benefits wall numbers are engine output", () => {
  const n = demoNumbers(data, now);

  it("score parts are the first open item's breakdown, each in [0, 1]", () => {
    const replay = replayDemoStory(data, now);
    const open = replay.path.phases.flatMap((p) => p.items).find((i) => i.status === "todo" || i.status === "in_progress");
    expect(open).toBeDefined();
    const b = open!.evidence.scoreBreakdown;
    expect(n.score).toEqual({ coverage: b.coverage, levelFit: b.levelFit, preferenceFit: b.preferenceFit, quality: b.quality, similarity: b.similarity });
    for (const v of Object.values(n.score)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("progress is a whole percent strictly inside the range", () => {
    expect(Number.isInteger(n.progressPct)).toBe(true);
    expect(n.progressPct).toBeGreaterThan(0);
    expect(n.progressPct).toBeLessThan(100);
  });

  it("the too_hard banner comes from a replan that added remediation", () => {
    expect(n.tooHard.added.length).toBeGreaterThan(0);
    expect(n.tooHard.cause).toMatch(/too hard$/);
    for (const row of [...n.tooHard.added, ...n.tooHard.removed]) {
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.reason.length).toBeGreaterThan(0);
    }
  });
});
