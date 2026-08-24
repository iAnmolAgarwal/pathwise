import { NextResponse } from "next/server";
import { z } from "zod";
import { getLatestPath, getProfile } from "@/db/queries";
import { jsonError, parseBody } from "@/lib/api";
import { requireLearner } from "@/lib/authz";
import { profileSummaryFor } from "@/lib/chatContext";
import { judgeGate } from "@/lib/budget";
import { loadEngineData } from "@/lib/engineData";
import { llm } from "@/llm/client";
import { narrateEvidence } from "@/llm/explain";
import { addUsage, classifyLlmError, emptyUsage } from "@/llm/judgeMode";
import { describeEvidence } from "@/llm/tools";
import { DegradationSchema, DescribedEvidenceSchema, EvidenceSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({ learnerId: z.uuid(), catalogId: z.string().min(1) });

const ResponseSchema = z.object({
  evidence: EvidenceSchema,
  described: DescribedEvidenceSchema,
  narration: z.string().nullable(),
  degraded: DegradationSchema.nullable(),
});
type ExplainResponse = z.infer<typeof ResponseSchema>;
const respond = (body: ExplainResponse) => NextResponse.json(ResponseSchema.parse(body));

/**
 * POST /api/explain — the two renderings of §7 side by side: the structural Evidence
 * object (pure) and a narration generated from nothing but that evidence. If the model is
 * unavailable the evidence still comes back and `narration` is null.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, BodySchema);
  if (!body.ok) return body.response;
  const { learnerId, catalogId } = body.data;
  const authz = await requireLearner(learnerId);
  if (!authz.ok) return authz.response;
  const [profile, latest] = await Promise.all([getProfile(learnerId), getLatestPath(learnerId)]);
  if (!profile) return jsonError(404, "Learner not found");
  if (!latest) return jsonError(404, "No path generated yet");
  const item = latest.data.phases.flatMap((p) => p.items).find((it) => it.catalogId === catalogId);
  if (!item) return jsonError(404, "Item is not on the current path");

  const evidence = EvidenceSchema.parse(item.evidence);
  const described = describeEvidence(evidence, loadEngineData());
  const key = { userId: authz.user.id, learnerId };
  const gate = await judgeGate.allow(key);
  if (!gate.ok) return respond({ evidence, described, narration: null, degraded: gate.degradation });
  try {
    const { narration, usage } = await narrateEvidence(llm(), { evidence: described, profileSummary: profileSummaryFor(profile) });
    await judgeGate.record(key, addUsage(emptyUsage(), usage));
    return respond({ evidence, described, narration, degraded: null });
  } catch (err) {
    const degradation = classifyLlmError(err);
    if (!degradation) throw err;
    return respond({ evidence, described, narration: null, degraded: degradation });
  }
}
