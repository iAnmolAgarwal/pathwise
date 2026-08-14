import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SkillSchema } from "@/schemas";
import skillsJson from "@/data/skills.json";

describe("skills.json", () => {
  const skills = z.array(SkillSchema).parse(skillsJson);
  const ids = new Set(skills.map((s) => s.id));

  it("parses through SkillSchema", () => {
    expect(skills.length).toBeGreaterThanOrEqual(150);
  });

  it("has unique ids", () => {
    expect(ids.size).toBe(skills.length);
  });

  it("has no dangling prereq references", () => {
    const dangling = skills.flatMap((s) =>
      s.prereqs.filter((p) => !ids.has(p)).map((p) => `${s.id} -> ${p}`),
    );
    expect(dangling).toEqual([]);
  });

  it("has no self-referential prereqs", () => {
    const selfRefs = skills.filter((s) => s.prereqs.includes(s.id));
    expect(selfRefs).toEqual([]);
  });

  it("prereq edges form a DAG", () => {
    const prereqsById = new Map(skills.map((s) => [s.id, s.prereqs]));
    // 0 = unvisited, 1 = in progress, 2 = done
    const state = new Map<string, number>();
    const hasCycle = (id: string): boolean => {
      if (state.get(id) === 1) return true;
      if (state.get(id) === 2) return false;
      state.set(id, 1);
      for (const p of prereqsById.get(id) ?? []) {
        if (hasCycle(p)) return true;
      }
      state.set(id, 2);
      return false;
    };
    expect(skills.some((s) => hasCycle(s.id))).toBe(false);
  });
});
