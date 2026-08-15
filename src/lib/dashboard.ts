import { dashboardSummary, type DashboardSummary } from "@/engine/dashboard";
import { loadEngineData } from "@/lib/engineData";
import type { Path, Profile } from "@/schemas";

/** One computation shared by GET /api/dashboard and the get_dashboard_summary chat tool (§8.3). */
export function computeDashboard(profile: Profile, path: Path | null, eventDays: string[], now = new Date()): DashboardSummary {
  return dashboardSummary({ profile, path, data: loadEngineData(), eventDays, today: now.toISOString().slice(0, 10) });
}
