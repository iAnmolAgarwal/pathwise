import { describe, expect, it } from "vitest";
import { applyProfileOps, defaultProfile } from "@/engine/profile";
import type { Profile, ProfileOp } from "@/schemas";

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
    // Values that slip past the static types (e.g. from raw JSON) are still rejected.
    const bad = (op: unknown) => op as ProfileOp;
    expect(() => applyProfileOps(base, [bad({ op: "set_preference", key: "pace", value: "warp" })])).toThrow();
    expect(() => applyProfileOps(base, [bad({ op: "set_preference", key: "hoursPerWeek", value: -1 })])).toThrow();
  });
});

describe("applyProfileOps: adaptation ops (§5.5)", () => {
  const base: Profile = defaultProfile();

  it("avoid accumulates item, provider and format memos without duplicates", () => {
    const p = applyProfileOps(base, [
      { op: "avoid", catalogId: "a", provider: "Udemy", format: "video" },
      { op: "avoid", catalogId: "b", provider: "Udemy" },
      { op: "avoid", catalogId: "a" },
    ]);
    expect(p.dislikes).toEqual({ catalogIds: ["a", "b"], providers: ["Udemy"], formats: ["video"] });
  });

  it("assessed level overwrites inferred, and inferred never overwrites assessed", () => {
    let p = applyProfileOps(base, [{ op: "set_skill", skillId: "sql", level: 1, source: "inferred" }]);
    p = applyProfileOps(p, [{ op: "set_skill", skillId: "sql", level: 3, source: "assessed" }]);
    expect(p.skills.sql).toEqual({ level: 3, source: "assessed" });
    p = applyProfileOps(p, [{ op: "set_skill", skillId: "sql", level: 0, source: "inferred" }]);
    expect(p.skills.sql).toEqual({ level: 3, source: "assessed" });
  });
});
