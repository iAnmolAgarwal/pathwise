import { getLatestPath, getProfile, insertPath, listActivityDays, saveProfile } from "@/db/queries";
import { computeDashboard } from "@/lib/dashboard";
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
    async dashboardSummary() {
      const [profile, latest, eventDays] = await Promise.all([this.getProfile(), getLatestPath(learnerId), listActivityDays(learnerId)]);
      return computeDashboard(profile, latest?.data ?? null, eventDays);
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
