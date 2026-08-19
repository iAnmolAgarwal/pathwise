import type { Domain } from "@/schemas";

/** Slimmed catalog and skill records the workspace hands to its views (built server-side in the page). */
export type CatalogLite = {
  title: string;
  provider: string;
  url: string;
  kind: "course" | "project" | "assessment";
  durationHours: number;
  difficulty: number;
};

export type SkillLite = { id: string; name: string; domain: Domain };
