import { describe, expect, it } from "vitest";
import { generatePath } from "@/engine";
import { activityCalendar, dashboardSummary, difficultySplit, milestoneBadges, streakFromDays } from "@/engine/dashboard";
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

describe("difficultySplit (dashboard item 7c)", () => {
  it("buckets catalog difficulty 1–2 / 3 / 4–5 and counts done against total per bucket", () => {
    const split = difficultySplit(path, data);
    const total = split.easy.total + split.medium.total + split.hard.total;
    expect(total).toBe(items(path).length);
    expect(split.easy.done + split.medium.done + split.hard.done).toBe(0);
    const catalog = new Map(data.catalog.map((c) => [c.id, c.difficulty]));
    expect(split.easy.total).toBe(items(path).filter((i) => catalog.get(i.catalogId)! <= 2).length);
    expect(split.medium.total).toBe(items(path).filter((i) => catalog.get(i.catalogId) === 3).length);
    expect(split.hard.total).toBe(items(path).filter((i) => catalog.get(i.catalogId)! >= 4).length);
  });

  it("counts a completed item in its bucket only, and is all zeros without a path", () => {
    const first = items(path)[0];
    const done = applyFeedback({ type: "completed", catalogId: first.catalogId }, { profile, path, data, now: NOW, eventId: "e" });
    const split = difficultySplit(done.path, data);
    const bucket = data.catalog.find((c) => c.id === first.catalogId)!.difficulty;
    const key = bucket <= 2 ? "easy" : bucket === 3 ? "medium" : "hard";
    expect(split[key].done).toBe(1);
    expect(split.easy.done + split.medium.done + split.hard.done).toBe(1);
    expect(difficultySplit(null, data)).toEqual({ easy: { done: 0, total: 0 }, medium: { done: 0, total: 0 }, hard: { done: 0, total: 0 } });
  });
});

describe("activityCalendar (dashboard item 7a)", () => {
  it("lays out the last 52 weeks ending today, Sunday-first columns, with active days marked and counted", () => {
    const cal = activityCalendar(["2026-08-15", "2026-08-14", "2026-08-14", "2025-01-01"], TODAY);
    expect(cal.weeks).toHaveLength(53);
    const cells = cal.weeks.flat();
    expect(cells.at(-1)?.day).toBe(TODAY);
    expect(cells[0]?.day <= "2025-08-16").toBe(true);
    expect(cells.filter((c) => c.active).map((c) => c.day)).toEqual(["2026-08-14", "2026-08-15"]);
    expect(cal.activeDays).toBe(2);
    // Every column is a full week starting on a Sunday; cells after today are absent.
    expect(cal.weeks.every((w) => w.length <= 7)).toBe(true);
    expect(new Date(`${cal.weeks[1][0].day}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(cal.months[0]).toMatchObject({ label: expect.any(String), week: expect.any(Number) });
    expect(cal.months.map((m) => m.label).at(-1)).toBe("Aug");
  });

  it("is empty, not faked, without events", () => {
    const cal = activityCalendar([], TODAY);
    expect(cal.activeDays).toBe(0);
    expect(cal.weeks.flat().some((c) => c.active)).toBe(false);
  });
});

describe("milestoneBadges (dashboard item 7d)", () => {
  it("earns one badge per completed phase and keeps the rest locked by name", () => {
    const s = dashboardSummary({ profile, path, data, eventDays: [], today: TODAY });
    const badges = milestoneBadges(s.timeline);
    expect(badges).toHaveLength(path.phases.length);
    expect(badges.every((b) => !b.earned)).toBe(true);
    expect(badges.map((b) => b.milestone)).toEqual(path.phases.map((p) => p.milestone));
    const allDone: Path = { ...path, phases: path.phases.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i, status: "done" as const })) })) };
    const s2 = dashboardSummary({ profile, path: allDone, data, eventDays: [], today: TODAY });
    expect(milestoneBadges(s2.timeline).every((b) => b.earned)).toBe(true);
    expect(s2.difficulty.easy.done + s2.difficulty.medium.done + s2.difficulty.hard.done).toBe(items(path).length);
    expect(s2.activity.activeDays).toBe(0);
  });
});

describe("achievements (dashboard badges, derived on read)", () => {
  it("earns first-path with a path and nothing else for a fresh learner; all-done earns first step, phase one, foundations and goal-complete when levels are met", () => {
    const s = dashboardSummary({ profile, path, data, eventDays: [], today: TODAY });
    const byId = Object.fromEntries(s.achievements.map((a) => [a.id, a.earned]));
    expect(byId["first-path"]).toBe(true);
    expect(byId["first-done"]).toBe(false);
    expect(byId["streak-7"]).toBe(false);
    const allDone: Path = { ...path, phases: path.phases.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i, status: "done" as const })) })) };
    const s2 = dashboardSummary({ profile, path: allDone, data, eventDays: [], today: TODAY });
    const by2 = Object.fromEntries(s2.achievements.map((a) => [a.id, a.earned]));
    expect(by2["first-done"]).toBe(true);
    expect(by2["phase-1"]).toBe(true);
    expect(by2["foundations"]).toBe(s2.difficulty.easy.total > 0);
    expect(by2["goal-complete"]).toBe(s2.progress.attainedLevels === s2.progress.requiredLevels);
  });

  it("streak badges follow the longest streak; no path means no first-path", () => {
    const days = Array.from({ length: 7 }, (_, i) => `2026-08-${String(9 + i).padStart(2, "0")}`);
    const s = dashboardSummary({ profile, path, data, eventDays: days, today: TODAY });
    expect(s.achievements.find((a) => a.id === "streak-7")?.earned).toBe(true);
    expect(s.achievements.find((a) => a.id === "streak-30")?.earned).toBe(false);
    expect(dashboardSummary({ profile, path: null, data, eventDays: [], today: TODAY }).achievements.find((a) => a.id === "first-path")?.earned).toBe(false);
  });
});
