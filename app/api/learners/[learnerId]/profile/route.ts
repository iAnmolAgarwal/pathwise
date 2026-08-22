import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePath } from "@/engine";
import { applyProfileOps } from "@/engine/profile";
import { diffPaths } from "@/engine/replan";
import { getLatestPath, getProfile, insertPath, saveProfile } from "@/db/queries";
import { jsonError, parseBody } from "@/lib/api";
import { requireLearner } from "@/lib/authz";
import { loadEngineData } from "@/lib/engineData";
import { PathDiffSchema, PathSchema, ProfileOpSchema, ProfileSchema } from "@/schemas";

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

const EditResponseSchema = z.object({
  profile: ProfileSchema,
  /** Null when the learner had no path to redo (no goal, or nothing generated yet). */
  replan: z.object({ version: z.number().int().positive(), path: PathSchema, diff: PathDiffSchema }).nullable(),
});

/**
 * The learner edits their own profile (skill levels, hours, pace, budget): apply the ops, then
 * redo the path against the new profile when one exists. The diff carries a plain-language cause
 * so the path view can say why items moved.
 */
export async function PATCH(request: Request, { params }: Ctx) {
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

  const previous = await getLatestPath(learnerId);
  if (!previous || next.goals.length === 0) return NextResponse.json(EditResponseSchema.parse({ profile: next, replan: null }));

  const data = loadEngineData();
  const now = new Date().toISOString();
  const { path } = generatePath(next, data, { now, trigger: "replan" });
  const diff = diffPaths(previous.data, path, { eventId: `profile-edit:${now}`, humanReadable: describeEdit(body.data.ops) }, {
    added: () => "Needed after your profile update",
    removed: () => "No longer needed after your profile update",
  });
  const row = await insertPath(learnerId, path, diff);
  return NextResponse.json(EditResponseSchema.parse({ profile: next, replan: { version: row.version, path, diff } }));
}

function describeEdit(ops: z.infer<typeof ProfileOpSchema>[]): string {
  const parts: string[] = [];
  const skills = ops.filter((o) => o.op === "set_skill").length;
  if (skills) parts.push(`${skills} skill ${skills === 1 ? "level" : "levels"}`);
  for (const o of ops) if (o.op === "set_preference") parts.push(o.key === "hoursPerWeek" ? "weekly hours" : o.key);
  return `You updated your profile (${parts.join(", ") || "no changes"}) and the path was redone against it`;
}
