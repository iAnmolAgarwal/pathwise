import type Anthropic from "@anthropic-ai/sdk";

type Scripted = {
  content: Anthropic.ContentBlock[];
  stop_reason: Anthropic.Message["stop_reason"];
};

/**
 * A minimal stand-in for the Anthropic client: `messages.stream()` replays scripted
 * responses in order, emitting text blocks through the `text` listener the way the SDK does.
 */
export function fakeClient(script: Scripted[], parsed: unknown = { ops: [] }) {
  const requests: Anthropic.MessageCreateParams[] = [];
  const parseRequests: unknown[] = [];
  let i = 0;
  const client = {
    messages: {
      stream(params: Anthropic.MessageCreateParams) {
        // Snapshot: the loop mutates its messages array after each call.
        requests.push(JSON.parse(JSON.stringify(params)));
        const next = script[Math.min(i, script.length - 1)];
        i += 1;
        const listeners: ((delta: string) => void)[] = [];
        return {
          on(event: string, cb: (delta: string) => void) {
            if (event === "text") listeners.push(cb);
            return this;
          },
          async finalMessage(): Promise<Anthropic.Message> {
            for (const block of next.content) {
              if (block.type === "text") for (const cb of listeners) cb(block.text);
            }
            return {
              id: `msg_${i}`,
              type: "message",
              role: "assistant",
              model: "claude-sonnet-5",
              content: next.content,
              stop_reason: next.stop_reason,
              stop_sequence: null,
              stop_details: null,
              usage: {
                input_tokens: 100,
                output_tokens: 20,
                cache_creation_input_tokens: i === 1 ? 2000 : 0,
                cache_read_input_tokens: i === 1 ? 0 : 2000,
                cache_creation: null,
                server_tool_use: null,
                service_tier: null,
                inference_geo: null,
              } as Anthropic.Usage,
            } as Anthropic.Message;
          },
        };
      },
      async parse(params: unknown) {
        parseRequests.push(params);
        return {
          parsed_output: parsed,
          usage: { input_tokens: 50, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        };
      },
    },
  };
  return { client: client as unknown as Anthropic, requests, parseRequests };
}

export function text(t: string): Anthropic.TextBlock {
  return { type: "text", text: t, citations: null };
}

export function toolUse(id: string, name: string, input: unknown): Anthropic.ToolUseBlock {
  return { type: "tool_use", id, name, input, caller: null } as unknown as Anthropic.ToolUseBlock;
}
