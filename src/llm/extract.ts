import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ProfileOpSchema, type Profile, type ProfileOp } from "@/schemas";
import { EFFORT, MAX_TOKENS, MODEL } from "./client";
import { EXTRACT_SYSTEM_PROMPT } from "./prompts";
import { summarizeProfile } from "./context";

const ExtractionSchema = z.object({ ops: z.array(ProfileOpSchema) });

/**
 * One chat message → ProfileOp[] (§8.1). Structured output means no JSON retry loops; the
 * ops are then validated against the vocabulary and applied by the deterministic engine
 * code. Ops that reference unknown skills or templates are dropped, never guessed.
 */
export async function extractProfileOps(
  client: Anthropic,
  input: {
    message: string;
    profile: Profile;
    skillIds: readonly string[];
    templateIds: readonly string[];
    skillNames: Record<string, string>;
    templateTitles: Record<string, string>;
  },
): Promise<{ ops: ProfileOp[]; dropped: ProfileOp[]; usage: Anthropic.Usage }> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS.extraction,
    output_config: { effort: EFFORT.extraction, format: zodOutputFormat(ExtractionSchema) },
    system: [{ type: "text", text: EXTRACT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          `Current profile:\n${summarizeProfile(input.profile, input.skillNames, input.templateTitles)}`,
          "",
          `Learner message:\n${input.message}`,
        ].join("\n"),
      },
    ],
  });
  const raw = response.parsed_output?.ops ?? [];
  const { kept, dropped } = filterOpsToVocabulary(raw, input.skillIds, input.templateIds);
  return { ops: kept, dropped, usage: response.usage };
}

/** Pure: keep only ops whose ids exist in the shipped taxonomy. */
export function filterOpsToVocabulary(
  ops: ProfileOp[],
  skillIds: readonly string[],
  templateIds: readonly string[],
): { kept: ProfileOp[]; dropped: ProfileOp[] } {
  const skills = new Set(skillIds);
  const templates = new Set(templateIds);
  const kept: ProfileOp[] = [];
  const dropped: ProfileOp[] = [];
  for (const op of ops) {
    if (op.op === "set_skill" && !skills.has(op.skillId)) dropped.push(op);
    else if (op.op === "add_goal" && op.goal.type === "role" && !templates.has(op.goal.templateId)) dropped.push(op);
    else if (op.op === "add_goal" && op.goal.type === "custom") {
      const mapped = op.goal.mappedSkills.filter((s) => skills.has(s.skillId));
      kept.push({ ...op, goal: { ...op.goal, mappedSkills: mapped } });
    } else kept.push(op);
  }
  return { kept, dropped };
}
