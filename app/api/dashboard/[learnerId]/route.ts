import { NextResponse } from "next/server";
import { getLatestPath, getLearner, getProfile, listFeedbackDays } from "@/db/queries";
import { jsonError, UuidSchema } from "@/lib/api";
import { computeDashboard } from "@/lib/dashboard";

type Ctx = { params: Promise<{ learnerId: string }> };

/** Radar, progress, timeline, streak and next-best-action, all computed from stored state. */
export async function GET(_request: Request, { params }: Ctx) {
  const { learnerId } = await params;
  if (!UuidSchema.safeParse(learnerId).success) return jsonError(400, "Invalid learner id");
  if (!(await getLearner(learnerId))) return jsonError(404, "Learner not found");
  const [profile, latest, eventDays] = await Promise.all([getProfile(learnerId), getLatestPath(learnerId), listFeedbackDays(learnerId)]);
  if (!profile) return jsonError(404, "Learner not found");
  return NextResponse.json(computeDashboard(profile, latest?.data ?? null, eventDays));
}
