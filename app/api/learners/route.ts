import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultProfile } from "@/engine/profile";
import { createLearner, listLearners } from "@/db/queries";
import { parseBody } from "@/lib/api";

const CreateLearnerSchema = z.object({ displayName: z.string().trim().min(1).max(60) });

const LearnerSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  avatarSeed: z.string(),
  createdAt: z.date(),
});

export async function POST(request: Request) {
  const body = await parseBody(request, CreateLearnerSchema);
  if (!body.ok) return body.response;
  const learner = await createLearner(body.data.displayName, defaultProfile());
  return NextResponse.json(LearnerSchema.parse(learner), { status: 201 });
}

export async function GET() {
  const rows = await listLearners();
  return NextResponse.json(z.array(LearnerSchema).parse(rows));
}
