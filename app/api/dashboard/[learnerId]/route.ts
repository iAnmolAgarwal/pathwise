import { NextResponse } from "next/server";
import { getLatestPath, getProfile, listActivityDays } from "@/db/queries";
import { jsonError } from "@/lib/api";
import { requireLearner } from "@/lib/authz";
import { computeDashboard } from "@/lib/dashboard";

type Ctx = { params: Promise<{ learnerId: string }> };

/** Radar, progress, timeline, streak and next-best-action, all computed from stored state. */
export async function GET(_request: Request, { params }: Ctx) {
  const { learnerId } = await params;
  const authz = await requireLearner(learnerId);
  if (!authz.ok) return authz.response;
  const [profile, latest, eventDays] = await Promise.all([getProfile(learnerId), getLatestPath(learnerId), listActivityDays(learnerId)]);
  if (!profile) return jsonError(404, "Learner not found");
  return NextResponse.json(computeDashboard(profile, latest?.data ?? null, eventDays));
}
