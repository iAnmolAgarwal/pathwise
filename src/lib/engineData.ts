import { z } from "zod";
import type { EngineData } from "@/engine/types";
import branchesJson from "@/data/branches.json";
import catalogJson from "@/data/catalog.json";
import embeddingsJson from "@/data/embeddings.json";
import goalsJson from "@/data/goals.json";
import skillEdgesJson from "@/data/skill_edges.json";
import skillsJson from "@/data/skills.json";
import { BranchSchema, CatalogItemSchema, GoalTemplateSchema, SkillEdgeSchema, SkillSchema } from "@/schemas";

let cached: EngineData | null = null;

/** Parses the pipeline-generated JSON once per process; the engine itself never reads files. */
export function loadEngineData(): EngineData {
  cached ??= {
    skills: z.array(SkillSchema).parse(skillsJson),
    goals: z.array(GoalTemplateSchema).parse(goalsJson),
    catalog: z.array(CatalogItemSchema).parse(catalogJson),
    embeddings: z.record(z.string(), z.array(z.number())).parse(embeddingsJson),
    skillEdges: z.array(SkillEdgeSchema).parse(skillEdgesJson.edges),
    branches: z.array(BranchSchema).parse(branchesJson.branches),
  };
  return cached;
}
