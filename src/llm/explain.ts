import type Anthropic from "@anthropic-ai/sdk";
import { EFFORT, MAX_TOKENS, MODEL } from "./client";
import { EXPLAIN_SYSTEM_PROMPT } from "./prompts";
import type { describeEvidence } from "./tools";

/**
 * Narrative rendering of one Evidence object (§7 rendering 2). The model sees only the
 * evidence (with names resolved) and a profile summary, so it cannot introduce facts the
 * structural rendering does not also show.
 */
export async function narrateEvidence(
  client: Anthropic,
  input: { evidence: ReturnType<typeof describeEvidence>; profileSummary: string },
): Promise<{ narration: string; usage: Anthropic.Usage }> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS.narration,
    output_config: { effort: EFFORT.narration },
    system: EXPLAIN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `Learner profile summary:\n${input.profileSummary}`,
          "",
          `Evidence for one path item (JSON):\n${JSON.stringify(input.evidence)}`,
          "",
          "Explain why this item is on the learner's path.",
        ].join("\n"),
      },
    ],
  });
  const message = await stream.finalMessage();
  const narration = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { narration, usage: message.usage };
}
