import { NextResponse } from "next/server";
import { z } from "zod";
import { applyFeedback } from "@/engine/replan";
import { getLatestPath, getProfile, insertFeedbackEvent, insertPath, saveProfile, updatePathData } from "@/db/queries";
import { jsonError, parseBody } from "@/lib/api";
import { loadEngineData } from "@/lib/engineData";
import { FeedbackEventSchema, PathDiffSchema, PathSchema, ProfileSchema } from "@/schemas";

const BodySchema = z.object({ learnerId: z.uuid(), event: FeedbackEventSchema });

const ResponseSchema = z.object({
  eventId: z.string(),
  replanned: z.boolean(),
  version: z.number().int().positive(),
  path: PathSchema,
  diff: PathDiffSchema.nullable(),
  profile: ProfileSchema,
  cause: z.string(),
});

/**
 * Record one feedback event and apply the §5.5 rules: the profile is mutated through ops,
 * the path is regenerated when the rule says so, and the diff comes back with its cause.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, BodySchema);
  if (!body.ok) return body.response;
  const { learnerId, event } = body.data;
  const profile = await getProfile(learnerId);
  if (!profile) return jsonError(404, "Learner not found");
  const latest = await getLatestPath(learnerId);
  if (!latest) return jsonError(409, "Generate a path before giving feedback on it");

  const data = loadEngineData();
  const catalogIds = new Set(data.catalog.map((c) => c.id));
  if ("catalogId" in event) {
    if (!catalogIds.has(event.catalogId)) return jsonError(400, "Unknown catalog item");
    if (!latest.data.phases.some((p) => p.items.some((i) => i.catalogId === event.catalogId))) {
      return jsonError(409, "That item is not on the current path");
    }
  } else if (!data.skills.some((s) => s.id === event.skillId)) {
    return jsonError(400, "Unknown skill");
  }

  const stored = await insertFeedbackEvent(learnerId, event);
  const result = applyFeedback(event, {
    profile,
    path: latest.data,
    data,
    now: new Date().toISOString(),
    eventId: stored.id,
  });
  await saveProfile(learnerId, result.profile);
  let version = latest.version;
  if (result.replanned) {
    version = (await insertPath(learnerId, result.path, result.diff)).version;
  } else {
    await updatePathData(latest.id, result.path);
  }
  return NextResponse.json(
    ResponseSchema.parse({
      eventId: stored.id,
      replanned: result.replanned,
      version,
      path: result.path,
      diff: result.diff,
      profile: result.profile,
      cause: result.cause,
    }),
  );
}
