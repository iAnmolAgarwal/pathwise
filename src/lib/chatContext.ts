import { getLatestPath, getProfile, insertPath, saveProfile } from "@/db/queries";
import { loadEngineData } from "@/lib/engineData";
import type { ChatContext } from "@/llm/tools";
import { summarizeProfile } from "@/llm/context";
import type { Profile } from "@/schemas";

/** The DB-backed ChatContext: this is the only place the LLM layer's persistence seam meets Drizzle. */
export function dbChatContext(learnerId: string): ChatContext {
  const data = loadEngineData();
  return {
    learnerId,
    data,
    async getProfile() {
      const profile = await getProfile(learnerId);
      if (!profile) throw new Error("Learner not found");
      return profile;
    },
    saveProfile: (profile) => saveProfile(learnerId, profile),
    async getLatestPath() {
      const latest = await getLatestPath(learnerId);
      return latest ? { version: latest.version, path: latest.data } : null;
    },
    async savePath(path, diff) {
      const row = await insertPath(learnerId, path, diff);
      return { version: row.version };
    },
    // Dashboard computation arrives with the dashboard route; until then, honest counts only.
    async dashboardSummary() {
      const latest = await getLatestPath(learnerId);
      const items = latest?.data.phases.flatMap((p) => p.items) ?? [];
      const done = items.filter((i) => i.status === "done").length;
      const next = items.find((i) => i.status === "todo" || i.status === "in_progress");
      const catalog = new Map(data.catalog.map((c) => [c.id, c]));
      return {
        available: false,
        note: "Progress tracking and the dashboard arrive in a later release; counts below come from the current path.",
        pathVersion: latest?.version ?? null,
        itemsPlanned: items.length,
        itemsDone: done,
        nextItem: next ? { catalogId: next.catalogId, title: catalog.get(next.catalogId)?.title } : null,
      };
    },
    now: () => new Date(),
  };
}

export function profileSummaryFor(profile: Profile): string {
  const data = loadEngineData();
  return summarizeProfile(
    profile,
    Object.fromEntries(data.skills.map((s) => [s.id, s.name])),
    Object.fromEntries(data.goals.map((g) => [g.id, g.title])),
  );
}
