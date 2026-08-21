import { NextResponse } from "next/server";
import { getLatestPath, getLearner, getProfile, listFeedbackDays } from "@/db/queries";
import { jsonError, UuidSchema } from "@/lib/api";
import { computeProfileStats } from "@/lib/profileStats";

type Ctx = { params: Promise<{ learnerId: string }> };

/** Difficulty split, badges and the activity calendar, all computed from stored state. */
export async function GET(_request: Request, { params }: Ctx) {
  const { learnerId } = await params;
  if (!UuidSchema.safeParse(learnerId).success) return jsonError(400, "Invalid learner id");
  if (!(await getLearner(learnerId))) return jsonError(404, "Learner not found");
  const [profile, latest, eventDays] = await Promise.all([getProfile(learnerId), getLatestPath(learnerId), listFeedbackDays(learnerId)]);
  if (!profile) return jsonError(404, "Learner not found");
  return NextResponse.json(computeProfileStats(profile, latest?.data ?? null, eventDays));
}
