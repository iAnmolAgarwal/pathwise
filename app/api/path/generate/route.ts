import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePath } from "@/engine";
import { getLatestPath, getProfile, insertPath } from "@/db/queries";
import { jsonError, parseBody } from "@/lib/api";
import { loadEngineData } from "@/lib/engineData";
import { PathSchema } from "@/schemas";

const BodySchema = z.object({ learnerId: z.uuid() });

const ResponseSchema = z.object({
  version: z.number().int().positive(),
  path: PathSchema,
  working: z.object({
    gapSize: z.number().int(),
    budgetHours: z.number(),
    usedHours: z.number(),
    stoppedBecause: z.enum(["covered", "budget", "no-candidates"]),
    uncovered: z.array(z.object({ skillId: z.string(), levelsMissing: z.number() })),
  }),
});

/** Run the engine against the learner's current profile and persist a new path version. */
export async function POST(request: Request) {
  const body = await parseBody(request, BodySchema);
  if (!body.ok) return body.response;
  const profile = await getProfile(body.data.learnerId);
  if (!profile) return jsonError(404, "Learner not found");
  if (profile.goals.length === 0) return jsonError(409, "Add a goal before generating a path");

  const previous = await getLatestPath(body.data.learnerId);
  const { path, working } = generatePath(profile, loadEngineData(), {
    now: new Date().toISOString(),
    trigger: previous ? "replan" : "initial",
  });
  const row = await insertPath(body.data.learnerId, path, null);
  return NextResponse.json(
    ResponseSchema.parse({
      version: row.version,
      path,
      working: {
        gapSize: working.gap.length,
        budgetHours: working.budgetHours,
        usedHours: working.usedHours,
        stoppedBecause: working.stoppedBecause,
        uncovered: working.uncovered,
      },
    }),
    { status: 201 },
  );
}
