import { defaultProfile } from "@/engine/profile";
import { loadEngineData } from "@/lib/engineData";
import type { ChatContext } from "@/llm/tools";
import { computeDashboard } from "@/lib/dashboard";
import type { Path, PathDiff, Profile } from "@/schemas";

/** In-memory ChatContext: the tools' persistence seam without a database. */
export function memoryContext(initial: Profile = defaultProfile()) {
  const state = { profile: initial, paths: [] as Path[], diffs: [] as (PathDiff | null)[] };
  const ctx: ChatContext = {
    learnerId: "00000000-0000-0000-0000-000000000000",
    data: loadEngineData(),
    async getProfile() {
      return state.profile;
    },
    async saveProfile(p) {
      state.profile = p;
    },
    async getLatestPath() {
      const n = state.paths.length;
      return n ? { version: n, path: state.paths[n - 1] } : null;
    },
    async savePath(p, diff) {
      state.paths.push(p);
      state.diffs.push(diff);
      return { version: state.paths.length };
    },
    async dashboardSummary() {
      const n = state.paths.length;
      return computeDashboard(state.profile, n ? state.paths[n - 1] : null, [], ctx.now());
    },
    now: () => new Date("2026-08-15T00:00:00.000Z"),
  };
  return { ctx, state };
}
