import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultProfile } from "@/engine/profile";
import { createLearner, listLearners } from "@/db/queries";
import { parseBody } from "@/lib/api";
import { requireSession } from "@/lib/authz";

const CreateLearnerSchema = z.object({ displayName: z.string().trim().min(1).max(60) });

const LearnerSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  avatarSeed: z.string(),
  createdAt: z.date(),
});

/** Create a learner owned by the signed-in user. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;
  const body = await parseBody(request, CreateLearnerSchema);
  if (!body.ok) return body.response;
  const learner = await createLearner(session.user.id, body.data.displayName, defaultProfile());
  return NextResponse.json(LearnerSchema.parse(learner), { status: 201 });
}

/** The signed-in user's learners only — the picker's list. */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) return session.response;
  const rows = await listLearners(session.user.id);
  return NextResponse.json(z.array(LearnerSchema).parse(rows));
}
