import { profileStats, type ProfileStats } from "@/engine/profileStats";
import { loadEngineData } from "@/lib/engineData";
import type { Path, Profile } from "@/schemas";

/** One computation behind GET /api/profile-stats, mirroring computeDashboard in lib/dashboard.ts. */
export function computeProfileStats(profile: Profile, path: Path | null, eventDays: string[], now = new Date()): ProfileStats {
  return profileStats({ profile, path, data: loadEngineData(), eventDays, today: now.toISOString().slice(0, 10) });
}
