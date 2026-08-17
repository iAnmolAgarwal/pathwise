"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { ChatEvent } from "@/llm/chat";
import type { NovaState } from "@/schemas";
import type { Path, Profile, ProfileOp, PathDiff } from "@/schemas";
import { readSse } from "@/lib/sseClient";

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: string[];
  degraded?: boolean;
  streaming?: boolean;
};

type Props = {
  learnerId: string;
  initialMessages: ChatMessageView[];
  onProfileUpdated: (profile: Profile, ops: ProfileOp[]) => void;
  onPathUpdated: (version: number, path: Path, diff: PathDiff | null) => void;
  onNovaState: (state: NovaState) => void;
  /** Input focus drives Nova's listening state (§9.2). */
  onInputFocus?: (focused: boolean) => void;
  /** Lets the shell focus the composer ("Talk to Nova"). */
  inputRef?: RefObject<HTMLTextAreaElement | null>;
};

const TOOL_LABEL: Record<string, string> = {
  get_profile: "Reading your profile",
  apply_profile_ops: "Updating your profile",
  map_custom_goal: "Mapping your goal onto skills",
  generate_path: "Generating your path",
  replan_path: "Replanning your path",
  explain_item: "Looking up the evidence",
  search_catalog: "Searching the catalog",
  get_dashboard_summary: "Checking your progress",
};

const SUGGESTIONS = [
  "I want to become a frontend developer. I know some HTML and CSS.",
  "I'm a nurse who wants to move into data analysis — Excel is my strong point, 5 hours a week, free courses only.",
  "Help me get into cloud engineering; I already work with Linux and Python daily.",
];

/** The conversational interface: one SSE turn at a time, tool activity shown inline. */
export function ChatPanel({ learnerId, initialMessages, onProfileUpdated, onPathUpdated, onNovaState, onInputFocus, inputRef }: Props) {
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seq = useRef(initialMessages.length);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, activity]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const userId = `u-${++seq.current}`;
    const assistantId = `a-${++seq.current}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text: message },
      { id: assistantId, role: "assistant", text: "", streaming: true },
    ]);
    const patch = (fn: (m: ChatMessageView) => ChatMessageView) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));
    onNovaState("thinking");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ learnerId, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      await readSse(res, (_name, data) => {
        const event = data as ChatEvent;
        switch (event.type) {
          case "text":
            setActivity(null);
            patch((m) => ({ ...m, text: m.text + event.delta }));
            break;
          case "nova_state":
            onNovaState(event.state);
            break;
          case "tool_call":
            if (event.status === "start") setActivity(TOOL_LABEL[event.name] ?? event.name);
            else {
              setActivity(null);
              patch((m) => ({ ...m, toolCalls: [...(m.toolCalls ?? []), event.name] }));
            }
            break;
          case "profile_updated":
            onProfileUpdated(event.profile, event.ops);
            break;
          case "path_updated":
            onPathUpdated(event.version, event.path, event.diff);
            break;
          case "degraded":
            patch((m) => ({ ...m, degraded: true, text: m.text || event.degradation.message }));
            break;
          case "done":
            patch((m) => ({ ...m, streaming: false }));
            break;
          default:
            break;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      patch((m) => ({ ...m, streaming: false, degraded: true, text: m.text || "I couldn't answer that just now." }));
      onNovaState("idle");
    } finally {
      setActivity(null);
      setBusy(false);
      patch((m) => ({ ...m, streaming: false }));
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Chat with Nova">
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5 text-[14px] leading-relaxed" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="text-ink-2">
            <p>Hi, I&apos;m Nova. Tell me what you want to learn or become, and what you already know — I&apos;ll build your path from there.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" className="rounded-card border border-line bg-glass px-3 py-2 text-left text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1" onClick={() => send(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"} data-role={m.role}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-card bg-glass-strong px-3.5 py-2.5 text-ink-1"
                  : `max-w-[85%] whitespace-pre-wrap rounded-card px-3.5 py-2.5 ${m.degraded ? "border border-line bg-surface-2 text-ink-2" : "text-ink-1"}`
              }
            >
              {m.text || (m.streaming ? <span className="text-ink-3">…</span> : null)}
              {m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0 && (
                <p className="mt-1 font-mono text-[11px] text-ink-3">used: {m.toolCalls.join(", ")}</p>
              )}
            </div>
          </div>
        ))}
        {activity && (
          <p className="text-[12px] text-ink-3" data-testid="chat-activity">
            {activity}…
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={inputRef}
          className="min-h-[2.5rem] flex-1 resize-none rounded-card border border-line bg-glass px-3 py-2 text-[14px] text-ink-1 placeholder:text-ink-3 focus:border-line-strong focus:outline-none"
          rows={2}
          value={input}
          placeholder="Describe your goal, or ask about your path…"
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => onInputFocus?.(true)}
          onBlur={() => onInputFocus?.(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          disabled={busy}
          aria-label="Message Nova"
        />
        <button className="rounded-pill bg-brand px-4 py-2 text-[13px] font-[650] text-brand-foreground disabled:opacity-40" disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-[12px] text-coral">{error}</p>}
    </section>
  );
}
