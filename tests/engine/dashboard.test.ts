import { describe, expect, it } from "vitest";
import { generatePath } from "@/engine";
import { dashboardSummary, streakFromDays } from "@/engine/dashboard";
import { applyFeedback } from "@/engine/replan";
import { loadEngineData } from "@/lib/engineData";
import type { Path, Profile } from "@/schemas";
import { FIXTURE_LEARNERS } from "../fixtures/learners";

const NOW = "2026-08-15T00:00:00.000Z";
const TODAY = "2026-08-15";
const data = loadEngineData();
const profile = FIXTURE_LEARNERS["beginner-frontend"];
const path: Path = generatePath(profile, data, { now: NOW, trigger: "initial" }).path;
const items = (p: Path) => p.phases.flatMap((ph) => ph.items);

describe("streakFromDays", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(streakFromDays(["2026-08-13", "2026-08-14", "2026-08-15"], TODAY)).toMatchObject({ current: 3, longest: 3 });
    expect(streakFromDays(["2026-08-13", "2026-08-14"], TODAY)).toMatchObject({ current: 2, longest: 2 });
    expect(streakFromDays(["2026-08-10", "2026-08-11", "2026-08-13"], TODAY)).toMatchObject({ current: 0, longest: 2 });
    expect(streakFromDays([], TODAY)).toMatchObject({ current: 0, longest: 0 });
  });

  it("ignores duplicate days and returns the last fourteen days' activity", () => {
    const s = streakFromDays(["2026-08-15", "2026-08-15", "2026-07-01"], TODAY);
    expect(s.current).toBe(1);
    expect(s.activeDays).toEqual(["2026-08-15"]);
  });
});

describe("dashboardSummary", () => {
  const summary = dashboardSummary({ profile, path, data, eventDays: [], today: TODAY });

  it("progress is level-weighted attainment over goal-required skills", () => {
    expect(summary.progress).toMatchObject({ percent: 0, attainedLevels: 0, itemsDone: 0, itemsTotal: items(path).length });
    expect(summary.progress.requiredLevels).toBeGreaterThan(0);
    const partial: Profile = { ...profile, skills: { html: { level: 2, source: "stated" }, css: { level: 1, source: "stated" } } };
    const s2 = dashboardSummary({ profile: partial, path, data, eventDays: [], today: TODAY });
    expect(s2.progress.attainedLevels).toBe(3);
    expect(s2.progress.percent).toBe(Math.round((3 / s2.progress.requiredLevels) * 100));
  });

  it("radar lists only domains the goal requires, known ≤ required", () => {
    expect(summary.radar.length).toBeGreaterThan(0);
    for (const r of summary.radar) {
      expect(r.required).toBeGreaterThan(0);
      expect(r.known).toBeLessThanOrEqual(r.required);
    }
    expect(summary.radar.map((r) => r.domain)).toContain("web-frontend");
  });

  it("timeline mirrors the phases with completion counts", () => {
    expect(summary.timeline.map((t) => t.title)).toEqual(path.phases.map((p) => p.title));
    expect(summary.timeline[0]).toMatchObject({ itemsDone: 0, itemsTotal: path.phases[0].items.length, complete: false });
  });

  it("next action is the first open item whose predecessors are settled, with a why", () => {
    expect(summary.nextAction.catalogId).toBe(path.phases[0].items[0].catalogId);
    expect(summary.nextAction.why).toMatch(/\w/);
    const done = applyFeedback({ type: "completed", catalogId: path.phases[0].items[0].catalogId }, { profile, path, data, now: NOW, eventId: "e" });
    const s2 = dashboardSummary({ profile: done.profile, path: done.path, data, eventDays: [TODAY], today: TODAY });
    expect(s2.nextAction.catalogId).not.toBe(path.phases[0].items[0].catalogId);
    expect(s2.progress.itemsDone).toBe(1);
    expect(s2.timeline[0].itemsDone).toBe(1);
  });

  it("classifies skills for the graph: acquired / in-progress / gap / unrelated", () => {
    const partial: Profile = { ...profile, skills: { html: { level: 2, source: "stated" } } };
    const s = dashboardSummary({ profile: partial, path, data, eventDays: [], today: TODAY });
    expect(s.skillStatus.html).toBe("acquired");
    expect(s.skillStatus["command-line"]).toBe("in-progress"); // taught in the active first phase
    expect(s.skillStatus.react).toBe("gap");
    expect(s.skillStatus.kubernetes).toBe("unrelated");
    expect(s.gap.map((g) => g.skillId)).toContain("react");
  });

  it("without a path: no next item, an instruction instead", () => {
    const s = dashboardSummary({ profile, path: null, data, eventDays: [], today: TODAY });
    expect(s.nextAction.catalogId).toBeNull();
    expect(s.timeline).toEqual([]);
    expect(s.progress.itemsTotal).toBe(0);
  });

  it("with everything done: reports completion", () => {
    const allDone: Path = structuredClone(path);
    for (const i of items(allDone)) i.status = "done";
    const s = dashboardSummary({ profile, path: allDone, data, eventDays: [], today: TODAY });
    expect(s.nextAction.catalogId).toBeNull();
    expect(s.timeline.every((t) => t.complete)).toBe(true);
  });
});
