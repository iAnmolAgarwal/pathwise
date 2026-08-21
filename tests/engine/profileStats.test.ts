import { describe, expect, it } from "vitest";
import { generatePath } from "@/engine";
import { activityCalendar, badgesFor, difficultyRows, profileStats } from "@/engine/profileStats";
import { loadEngineData } from "@/lib/engineData";
import type { Path, Profile } from "@/schemas";
import { FIXTURE_LEARNERS } from "../fixtures/learners";

const NOW = "2026-08-15T00:00:00.000Z";
const TODAY = "2026-08-15"; // a Saturday
const data = loadEngineData();
const profile = FIXTURE_LEARNERS["beginner-frontend"];
const path: Path = generatePath(profile, data, { now: NOW, trigger: "initial" }).path;

describe("activityCalendar", () => {
  it("starts on a Sunday and ends on today", () => {
    const a = activityCalendar([], TODAY, 4);
    expect(new Date(`${a.from}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(a.to).toBe(TODAY);
    expect(a.days.at(-1)?.day).toBe(TODAY);
  });

  it("has no gaps between the first and last day", () => {
    const a = activityCalendar([], TODAY, 6);
    for (let i = 1; i < a.days.length; i++) {
      const prev = Date.parse(`${a.days[i - 1].day}T00:00:00Z`);
      const cur = Date.parse(`${a.days[i].day}T00:00:00Z`);
      expect(cur - prev).toBe(86_400_000);
    }
  });

  it("counts events per day and ignores days outside the window", () => {
    const a = activityCalendar(["2026-08-14", "2026-08-14", "2026-08-15", "2020-01-01"], TODAY, 4);
    expect(a.days.find((d) => d.day === "2026-08-14")?.count).toBe(2);
    expect(a.days.find((d) => d.day === "2026-08-15")?.count).toBe(1);
    expect(a.activeDays).toBe(2);
    expect(a.days.some((d) => d.day === "2020-01-01")).toBe(false);
  });
});

describe("difficultyRows", () => {
  const rows = difficultyRows(profile, data);

  it("always returns easy, medium and hard in order", () => {
    expect(rows.map((r) => r.band)).toEqual(["easy", "medium", "hard"]);
  });

  it("counts goal-required skills only, and attained never exceeds required", () => {
    expect(rows.reduce((n, r) => n + r.required, 0)).toBeGreaterThan(0);
    for (const r of rows) expect(r.attained).toBeLessThanOrEqual(r.required);
  });

  it("credits a skill once the learner reaches its required level", () => {
    const before = difficultyRows(profile, data).reduce((n, r) => n + r.attained, 0);
    const [first] = data.goals.flatMap((g) =>
      profile.goals.some((pg) => pg.type === "role" && pg.templateId === g.id) ? g.requiredSkills : [],
    );
    const raised: Profile = { ...profile, skills: { ...profile.skills, [first.skillId]: { level: first.level, source: "stated" } } };
    expect(difficultyRows(raised, data).reduce((n, r) => n + r.attained, 0)).toBe(before + 1);
  });
});

describe("badgesFor", () => {
  const rows = difficultyRows(profile, data);

  it("awards First Path once a path exists, not before", () => {
    const without = badgesFor(profile, null, data, rows, 0);
    expect(without.find((b) => b.id === "first-path")?.earned).toBe(false);
    const with_ = badgesFor(profile, path, data, rows, 0);
    expect(with_.find((b) => b.id === "first-path")?.earned).toBe(true);
  });

  it("gates the streak badges on the longest streak", () => {
    const at7 = badgesFor(profile, path, data, rows, 7);
    expect(at7.find((b) => b.id === "streak-7")?.earned).toBe(true);
    expect(at7.find((b) => b.id === "streak-30")?.earned).toBe(false);
    expect(badgesFor(profile, path, data, rows, 30).find((b) => b.id === "streak-30")?.earned).toBe(true);
  });

  it("never awards Foundations or Goal Complete when the goal requires nothing", () => {
    const empty: Profile = { ...profile, goals: [] };
    const badges = badgesFor(empty, path, data, difficultyRows(empty, data), 0);
    expect(badges.find((b) => b.id === "foundations")?.earned).toBe(false);
    expect(badges.find((b) => b.id === "goal-complete")?.earned).toBe(false);
  });

  it("awards Depth only at level 3", () => {
    const l2: Profile = { ...profile, skills: { html: { level: 2, source: "stated" } } };
    const l3: Profile = { ...profile, skills: { html: { level: 3, source: "stated" } } };
    expect(badgesFor(l2, path, data, rows, 0).find((b) => b.id === "depth")?.earned).toBe(false);
    expect(badgesFor(l3, path, data, rows, 0).find((b) => b.id === "depth")?.earned).toBe(true);
  });
});

describe("profileStats", () => {
  const stats = profileStats({ profile, path, data, eventDays: ["2026-08-15"], today: TODAY });

  it("totals agree with the per-band rows", () => {
    expect(stats.totals.attained).toBe(stats.difficulty.reduce((n, r) => n + r.attained, 0));
    expect(stats.totals.required).toBe(stats.difficulty.reduce((n, r) => n + r.required, 0));
  });

  it("returns all eight badges and a calendar ending today", () => {
    expect(stats.badges).toHaveLength(8);
    expect(new Set(stats.badges.map((b) => b.id)).size).toBe(8);
    expect(stats.activity.to).toBe(TODAY);
    expect(stats.activity.activeDays).toBe(1);
  });
});
