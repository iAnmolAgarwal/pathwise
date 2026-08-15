import { NextResponse } from "next/server";
import { z } from "zod";
import { getLatestPath, getLearner } from "@/db/queries";
import { jsonError, UuidSchema } from "@/lib/api";
import { PathDiffSchema, PathSchema } from "@/schemas";

type Ctx = { params: Promise<{ learnerId: string }> };

const ResponseSchema = z.object({
  version: z.number().int().positive(),
  path: PathSchema,
  diff: PathDiffSchema.nullable(),
  createdAt: z.iso.datetime(),
});

/** Latest path version (and its diff, once replanning exists) for a learner. */
export async function GET(_request: Request, { params }: Ctx) {
  const { learnerId } = await params;
  if (!UuidSchema.safeParse(learnerId).success) return jsonError(400, "Invalid learner id");
  if (!(await getLearner(learnerId))) return jsonError(404, "Learner not found");
  const latest = await getLatestPath(learnerId);
  if (!latest) return jsonError(404, "No path generated yet");
  return NextResponse.json(
    ResponseSchema.parse({
      version: latest.version,
      path: latest.data,
      diff: latest.diff,
      createdAt: latest.createdAt.toISOString(),
    }),
  );
}
