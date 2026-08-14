import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CatalogItemSchema, GoalTemplateSchema, SkillSchema } from "@/schemas";
import catalogJson from "@/data/catalog.json";
import embeddingsJson from "@/data/embeddings.json";
import goalsJson from "@/data/goals.json";
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

  it("goals.json parses and references only existing skills", () => {
    const goals = z.array(GoalTemplateSchema).parse(goalsJson);
    expect(goals.length).toBeGreaterThanOrEqual(15);
    expect(new Set(goals.map((g) => g.id)).size).toBe(goals.length);
    const dangling = goals.flatMap((g) =>
      g.requiredSkills
        .filter((r) => !ids.has(r.skillId))
        .map((r) => `${g.id} -> ${r.skillId}`),
    );
    expect(dangling).toEqual([]);
  });

  it("catalog.json parses and references only existing skills", () => {
    const catalog = z.array(CatalogItemSchema).parse(catalogJson);
    expect(catalog.length).toBeGreaterThanOrEqual(150);
    expect(new Set(catalog.map((c) => c.id)).size).toBe(catalog.length);
    const dangling = catalog.flatMap((c) =>
      [...c.skillsTaught, ...c.skillsRequired]
        .filter((r) => !ids.has(r.skillId))
        .map((r) => `${c.id} -> ${r.skillId}`),
    );
    expect(dangling).toEqual([]);
  });

  it("embeddings.json covers every skill and catalog item with 384-dim vectors", () => {
    const embeddings = embeddingsJson as Record<string, number[]>;
    const catalogIds = (catalogJson as { id: string }[]).map((c) => c.id);
    const expected = [...ids, ...catalogIds];
    expect(Object.keys(embeddings).length).toBe(expected.length);
    for (const id of expected) {
      expect(embeddings[id], `missing embedding for ${id}`).toBeDefined();
    }
    expect(embeddings[catalogIds[0]]).toHaveLength(384);
    expect(embeddings[skills[0].id]).toHaveLength(384);
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
