import { describe, expect, it } from "vitest";
import { applyProfileOps, defaultProfile } from "@/engine/profile";
import type { Profile } from "@/schemas";

describe("defaultProfile", () => {
  it("has no goals, no skills, and the documented default preferences", () => {
    expect(defaultProfile()).toEqual({
      goals: [],
      skills: {},
      preferences: { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" },
    });
  });
});

describe("applyProfileOps", () => {
  const base: Profile = defaultProfile();

  it("does not mutate its input", () => {
    const before = structuredClone(base);
    applyProfileOps(base, [{ op: "add_goal", goal: { type: "role", templateId: "x" } }]);
    expect(base).toEqual(before);
  });

  it("add_goal appends; remove_goal removes by index and ignores out-of-range", () => {
    let p = applyProfileOps(base, [
      { op: "add_goal", goal: { type: "role", templateId: "a" } },
      { op: "add_goal", goal: { type: "role", templateId: "b" } },
    ]);
    expect(p.goals.map((g) => (g.type === "role" ? g.templateId : ""))).toEqual(["a", "b"]);
    p = applyProfileOps(p, [{ op: "remove_goal", index: 0 }, { op: "remove_goal", index: 7 }]);
    expect(p.goals).toEqual([{ type: "role", templateId: "b" }]);
  });

  it("set_skill records level and source", () => {
    const p = applyProfileOps(base, [{ op: "set_skill", skillId: "python", level: 2, source: "stated" }]);
    expect(p.skills.python).toEqual({ level: 2, source: "stated" });
  });

  it("an inferred set never overwrites an assessed level, but a stated one does", () => {
    const assessed: Profile = { ...base, skills: { python: { level: 3, source: "assessed" } } };
    const inferred = applyProfileOps(assessed, [{ op: "set_skill", skillId: "python", level: 1, source: "inferred" }]);
    expect(inferred.skills.python).toEqual({ level: 3, source: "assessed" });
    const stated = applyProfileOps(assessed, [{ op: "set_skill", skillId: "python", level: 1, source: "stated" }]);
    expect(stated.skills.python).toEqual({ level: 1, source: "stated" });
  });

  it("set_preference validates the value against the preference schema", () => {
    const p = applyProfileOps(base, [
      { op: "set_preference", key: "hoursPerWeek", value: 10 },
      { op: "set_preference", key: "formats", value: ["video"] },
    ]);
    expect(p.preferences.hoursPerWeek).toBe(10);
    expect(p.preferences.formats).toEqual(["video"]);
    expect(() => applyProfileOps(base, [{ op: "set_preference", key: "pace", value: "warp" }])).toThrow();
    expect(() => applyProfileOps(base, [{ op: "set_preference", key: "hoursPerWeek", value: -1 }])).toThrow();
  });
});
