import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { insertChatMessage, listChatMessages } from "@/db/queries";
import type { ProfileCard } from "@/schemas/profileCard";
import { parseBody } from "@/lib/api";
import { requireLearner } from "@/lib/authz";
import { dbChatContext } from "@/lib/chatContext";
import { SSE_HEADERS, sseStream } from "@/lib/sse";
import { runChatTurn, type ChatEvent } from "@/llm/chat";
import { judgeGate } from "@/lib/budget";
import { llm } from "@/llm/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  learnerId: z.uuid(),
  message: z.string().trim().min(1).max(2000),
});

/** How many prior messages the model sees; older turns are summarised by the profile itself. */
const HISTORY_TURNS = 20;

/**
 * POST /api/chat — one learner turn as an SSE stream (§6, §8.3). Events: text, nova_state,
 * tool_call, profile_updated, path_updated, usage, degraded, done. Side effects (chat
 * persisted, profile ops applied, path regenerated) happen server-side inside the loop.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, BodySchema);
  if (!body.ok) return body.response;
  const { learnerId, message } = body.data;
  const authz = await requireLearner(learnerId);
  if (!authz.ok) return authz.response;
  const userId = authz.user.id;

  const gate = await judgeGate.allow({ userId, learnerId });
  const prior = await listChatMessages(learnerId, HISTORY_TURNS);
  await insertChatMessage(learnerId, "user", { text: message });
  const history: Anthropic.MessageParam[] = prior
    .filter((m) => m.content.text.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content.text }));

  const sse = sseStream();
  const emit = (event: ChatEvent) => sse.send(event.type, event);

  (async () => {
    try {
      if (!gate.ok) {
        emit({ type: "degraded", degradation: gate.degradation });
        emit({ type: "nova_state", state: "resting" });
        emit({ type: "done", text: "" });
        return;
      }
      const toolCalls: string[] = [];
      let card: ProfileCard | undefined;
      const result = await runChatTurn(llm(), dbChatContext(learnerId), { history, message }, (event) => {
        if (event.type === "tool_call" && event.status !== "start") toolCalls.push(event.name);
        if (event.type === "ui_card") card = event.card;
        emit(event);
      });
      const text = result.text || (result.degradation ? result.degradation.message : "");
      if (text || card) {
        await insertChatMessage(learnerId, "assistant", {
          text,
          toolCalls,
          ...(card ? { card } : {}),
          ...(result.degradation ? { degraded: true } : {}),
        });
      }
      await judgeGate.record({ userId, learnerId }, result.usage);
    } catch (err) {
      console.error("chat turn failed", err);
      emit({ type: "degraded", degradation: { degraded: true, reason: "unavailable", message: "Something went wrong on our side. Your path and profile are unaffected." } });
      emit({ type: "done", text: "" });
    } finally {
      sse.close();
    }
  })();

  return new Response(sse.stream, { headers: SSE_HEADERS });
}
