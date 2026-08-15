"use client";

import { useEffect, useRef, useState } from "react";
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
export function ChatPanel({ learnerId, initialMessages, onProfileUpdated, onPathUpdated, onNovaState }: Props) {
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
    <section className="flex h-full min-h-[28rem] flex-col rounded border" aria-label="Chat with Nova">
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="text-neutral-600">
            <p>Hi, I&apos;m Nova. Tell me what you want to learn or become, and what you already know — I&apos;ll build your path from there.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" className="rounded border px-2 py-1 text-left hover:bg-neutral-50" onClick={() => send(s)}>
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
                  ? "max-w-[85%] whitespace-pre-wrap rounded-lg bg-black px-3 py-2 text-white"
                  : `max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 ${m.degraded ? "bg-amber-50 text-amber-900" : "bg-neutral-100"}`
              }
            >
              {m.text || (m.streaming ? <span className="text-neutral-400">…</span> : null)}
              {m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0 && (
                <p className="mt-1 text-[11px] text-neutral-500">used: {m.toolCalls.join(", ")}</p>
              )}
            </div>
          </div>
        ))}
        {activity && (
          <p className="text-xs text-neutral-500" data-testid="chat-activity">
            {activity}…
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          className="min-h-[2.5rem] flex-1 resize-none rounded border px-3 py-2 text-sm"
          rows={2}
          value={input}
          placeholder="Describe your goal, or ask about your path…"
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => onNovaState("listening")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          disabled={busy}
          aria-label="Message Nova"
        />
        <button className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50" disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
