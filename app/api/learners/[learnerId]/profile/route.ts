import { NextResponse } from "next/server";
import { z } from "zod";
import { applyProfileOps } from "@/engine/profile";
import { getProfile, saveProfile } from "@/db/queries";
import { jsonError, parseBody } from "@/lib/api";
import { requireLearner } from "@/lib/authz";
import { ProfileOpSchema, ProfileSchema } from "@/schemas";

type Ctx = { params: Promise<{ learnerId: string }> };

const OpsSchema = z.object({ ops: z.array(ProfileOpSchema).min(1).max(100) });

export async function GET(_request: Request, { params }: Ctx) {
  const { learnerId } = await params;
  const authz = await requireLearner(learnerId);
  if (!authz.ok) return authz.response;
  const profile = await getProfile(learnerId);
  if (!profile) return jsonError(404, "Learner not found");
  return NextResponse.json(ProfileSchema.parse(profile));
}

/** Apply a batch of ProfileOps deterministically (§4.2) and persist the result. */
export async function POST(request: Request, { params }: Ctx) {
  const { learnerId } = await params;
  const authz = await requireLearner(learnerId);
  if (!authz.ok) return authz.response;
  const body = await parseBody(request, OpsSchema);
  if (!body.ok) return body.response;
  const current = await getProfile(learnerId);
  if (!current) return jsonError(404, "Learner not found");
  let next;
  try {
    next = ProfileSchema.parse(applyProfileOps(current, body.data.ops));
  } catch (err) {
    return jsonError(400, "Ops produced an invalid profile", err instanceof z.ZodError ? z.treeifyError(err) : undefined);
  }
  await saveProfile(learnerId, next);
  return NextResponse.json(next);
}
