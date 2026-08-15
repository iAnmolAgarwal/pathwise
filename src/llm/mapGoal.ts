import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { mappedGoalSchema, type MappedGoal } from "@/schemas";
import { EFFORT, MAX_TOKENS, MODEL } from "./client";
import { MAP_GOAL_SYSTEM_PROMPT } from "./prompts";

/**
 * Free-text goal → skills from the closed vocabulary (D-05). The enum in the output schema
 * is the taxonomy itself, so the model cannot return a skill the engine does not know.
 * The template check is a hint for the caller; the caller decides whether to use it.
 */
export async function mapCustomGoal(
  client: Anthropic,
  input: { text: string; skillIds: readonly string[]; templateIds: readonly string[] },
): Promise<{ goal: MappedGoal; usage: Anthropic.Usage }> {
  const schema = mappedGoalSchema(input.skillIds);
  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS.mapping,
    output_config: { effort: EFFORT.mapping, format: zodOutputFormat(schema) },
    system: [{ type: "text", text: MAP_GOAL_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Goal: ${input.text}` }],
  });
  const goal = message.parsed_output;
  if (!goal) throw new Error("Goal mapping returned no structured output");
  const templates = new Set(input.templateIds);
  if (goal.matchesTemplateId && !templates.has(goal.matchesTemplateId)) goal.matchesTemplateId = null;
  // Belt and braces: the enum already constrains ids, but keep the mapping unique.
  const seen = new Set<string>();
  goal.mappedSkills = goal.mappedSkills.filter((s) => (seen.has(s.skillId) ? false : (seen.add(s.skillId), true)));
  return { goal, usage: message.usage };
}
