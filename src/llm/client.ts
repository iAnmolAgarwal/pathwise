import Anthropic from "@anthropic-ai/sdk";

/** One model everywhere (§8.1); intro pricing runs through the judging window. */
export const MODEL = "claude-sonnet-5";

/** Adaptive thinking is the default on this model; effort is the only depth control we set. */
export const EFFORT = {
  chat: "low",
  /** Turns that reason over a generated path get a little more room. */
  pathContext: "medium",
  extraction: "low",
  mapping: "low",
  narration: "low",
} as const;

export const MAX_TOKENS = {
  chat: 1024,
  narration: 1024,
  mapping: 2048,
  extraction: 1024,
} as const;

let cached: Anthropic | null = null;

/** Lazily constructed so builds and tests never need ANTHROPIC_API_KEY. */
export function llm(): Anthropic {
  cached ??= new Anthropic({ maxRetries: 2 });
  return cached;
}

/** Test seam: inject a fake client. */
export function setLlmClient(client: Anthropic | null) {
  cached = client;
}
