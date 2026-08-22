import { describe, expect, it } from "vitest";
import { generatePath } from "@/engine";
import { defaultProfile } from "@/engine/profile";
import { loadEngineData } from "@/lib/engineData";
import { nextPrompts } from "@/lib/nextPrompts";
import { FIXTURE_LEARNERS } from "./fixtures/learners";

const data = loadEngineData();
const titleOf = (id: string) => data.catalog.find((c) => c.id === id)?.title ?? id;

describe("composer suggestions follow the learner's stage", () => {
  it("is null without a goal, so the role carousel shows", () => {
    expect(nextPrompts(defaultProfile(), null, titleOf)).toBeNull();
  });

  it("asks for skills, hours and budget once a goal exists but no path", () => {
    const profile = FIXTURE_LEARNERS["beginner-frontend"];
    const prompts = nextPrompts(profile, null, titleOf)!;
    expect(prompts).toContain("Build my path");
    expect(prompts.some((p) => p.includes(`${profile.preferences.hoursPerWeek} hours`))).toBe(true);
  });

  it("names the first open item once a path exists and skips the paid-swap when already free-only", () => {
    const profile = FIXTURE_LEARNERS["beginner-frontend"];
    const path = generatePath(profile, data, { now: "2026-08-15T00:00:00.000Z", trigger: "initial" }).path;
    const first = titleOf(path.phases[0].items[0].catalogId);
    const prompts = nextPrompts(profile, path, titleOf)!;
    expect(prompts[0]).toBe(`I finished ${first}`);
    expect(prompts).toContain("What should I do next?");
    expect(prompts.some((p) => p.includes("free courses"))).toBe(profile.preferences.budget !== "free-only");
    const done = { ...path, phases: path.phases.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i, status: "done" as const })) })) };
    expect(nextPrompts(profile, done, titleOf)![0]).toBe("I want a new goal");
  });
});
