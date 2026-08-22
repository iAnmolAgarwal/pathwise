"use client";

import { ArrowUp, Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";

import type { ChatEvent } from "@/llm/chat";
import type { NovaState } from "@/schemas";
import type { Path, Profile, ProfileOp, PathDiff } from "@/schemas";
import type { ProfileCard, ProfileCardAnswer } from "@/schemas/profileCard";
import { profileCardAnswerToOps, profileCardFollowUp } from "@/lib/profileCard";
import { readSse } from "@/lib/sseClient";
import { Orb } from "@/components/ui/orb";
import { cn } from "@/lib/utils";

import { ProfileCardView } from "./ProfileCardView";
import { RotatingPrompt } from "./RotatingPrompt";
import styles from "./chat.module.css";

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: string[];
  degraded?: boolean;
  streaming?: boolean;
  /** Structured intake card (D-13) shown inside this assistant message. */
  card?: ProfileCard;
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
  /** Judge mode has parked the model: show the resting notice. */
  resting?: boolean;
  /** Compact greeting for the landing drawer. */
  compact?: boolean;
  /** Stage-aware composer suggestions (src/lib/nextPrompts); null keeps the role carousel. */
  prompts?: string[] | null;
};

export const TOOL_LABEL: Record<string, string> = {
  get_profile: "Reading your profile",
  apply_profile_ops: "Updating your profile",
  map_custom_goal: "Mapping your goal onto skills",
  generate_path: "Generating your path",
  replan_path: "Replanning your path",
  explain_item: "Looking up the evidence",
  search_catalog: "Searching the catalog",
  get_dashboard_summary: "Checking your progress",
  propose_profile_card: "Preparing your check-in",
};

const SUGGESTIONS = [
  "I want to become a frontend developer. I know some HTML and CSS.",
  "I'm a nurse moving into data analysis — Excel is my strong point, 5 hours a week, free courses only.",
  "Help me get into cloud engineering; I already work with Linux and Python daily.",
];

const ENTER = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

/** The conversational interface: one SSE turn at a time, tool activity shown as a live checklist. */
export function ChatPanel({
  learnerId,
  initialMessages,
  onProfileUpdated,
  onPathUpdated,
  onNovaState,
  onInputFocus,
  inputRef,
  prompts = null,
  resting = false,
  compact = false,
}: Props) {
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? localRef;
  const seq = useRef(initialMessages.length);
  const reduce = useReducedMotion() ?? false;
  // Cards answered this session (by card id); older cards count as answered once anything follows them.
  const [answeredCards, setAnsweredCards] = useState<Record<string, { skipped: boolean; stated: number }>>({});
  const [cardBusy, setCardBusy] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [messages, activity, reduce]);

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
          case "ui_card":
            patch((m) => ({ ...m, card: event.card }));
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

  async function answerCard(card: ProfileCard, answer: ProfileCardAnswer, skipped: boolean) {
    if (busy || cardBusy) return;
    setCardBusy(card.id);
    setError(null);
    try {
      const ops = skipped ? [] : profileCardAnswerToOps(answer, card);
      if (ops.length > 0) {
        const res = await fetch(`/api/learners/${learnerId}/profile`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ops }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Could not save your answers (${res.status})`);
        }
        onProfileUpdated((await res.json()) as Profile, ops);
      }
      const stated = Object.values(answer.skills).filter((l) => l > 0).length;
      setAnsweredCards((prev) => ({ ...prev, [card.id]: { skipped, stated } }));
      setCardBusy(null);
      await send(profileCardFollowUp(answer, card, skipped));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCardBusy(null);
    }
  }

  const canSend = input.trim().length > 0 && !busy;

  return (
    <section className={styles.panel} aria-label="Chat with Nova">
      <div className={styles.log} role="log" aria-live="polite">
        {messages.length === 0 && (
          <motion.div
            className={cn(styles.greeting, compact && styles.greetingCompact)}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ENTER}
          >
            <Orb state="breathing" size={64} label="Nova" paused={reduce} />
            <h2 className={styles.greetingTitle}>
              Hi, I&apos;m <span className="text-gradient-violet">Nova</span>.
            </h2>
            <p className={styles.greetingLead}>
              Tell me what you want to become and what you already know. I&apos;ll map the gap, build a path from
              real courses, and change it when you push back.
            </p>
            <ul className={styles.suggestions} aria-label="Try one of these">
              {SUGGESTIONS.map((s, i) => (
                <motion.li
                  key={s}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ENTER, delay: 0.12 + i * 0.07 }}
                >
                  <button type="button" className={styles.suggestion} onClick={() => send(s)}>
                    {s}
                  </button>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, index) => (
            <motion.div
              key={m.id}
              className={cn(styles.row, m.role === "user" ? styles.rowUser : styles.rowNova)}
              data-role={m.role}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ENTER}
            >
              {m.role === "user" ? (
                <div className={styles.userBubble}>{m.text}</div>
              ) : (
                <NovaMessage
                  message={m}
                  activity={m.streaming ? activity : null}
                  reduce={reduce}
                  cardAnswered={m.card ? (answeredCards[m.card.id] ?? (index < messages.length - 1 ? { skipped: false, stated: 0 } : null)) : null}
                  cardBusy={m.card ? cardBusy === m.card.id : false}
                  onCardSubmit={(answer) => m.card && answerCard(m.card, answer, false)}
                  onCardSkip={(answer) => m.card && answerCard(m.card, answer, true)}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className={styles.composerWrap}>
        <AnimatePresence>
          {resting && (
            <motion.p
              className={styles.notice}
              role="status"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={ENTER}
            >
              <span className={styles.noticeDot} aria-hidden />
              Nova is resting — the model is unavailable right now. Your path, graph and dashboard still work.
            </motion.p>
          )}
        </AnimatePresence>

        <form
          className={cn(styles.composer, busy && styles.composerBusy)}
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          {input === "" && !focused && !busy && (
            <RotatingPrompt
              className={styles.rotating}
              paused={reduce}
              phrases={prompts}
              intro={messages.length === 0 ? "I want to become a" : "Ask about your path, or say: I want to become a"}
              onPick={(text) => {
                setInput(text);
                textareaRef.current?.focus();
              }}
            />
          )}
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={1}
            value={input}
            placeholder={focused ? (messages.length === 0 ? "Tell Nova what you want to become…" : "Reply to Nova…") : ""}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              setFocused(true);
              onInputFocus?.(true);
            }}
            onBlur={() => {
              setFocused(false);
              onInputFocus?.(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            disabled={busy}
            aria-label="Message Nova"
            data-testid="chat-input"
          />
          <div className={styles.composerBar}>
            <span className={styles.hint} aria-hidden>
              <kbd>↵</kbd> send · <kbd>⇧↵</kbd> new line
            </span>
            <button type="submit" className={styles.send} disabled={!canSend} aria-label={busy ? "Nova is answering" : "Send"} data-testid="chat-send">
              {busy ? <Orb state="working" size={20} label="Nova is answering" paused={reduce} /> : <ArrowUp />}
            </button>
          </div>
        </form>
        {error ? (
          <p className={cn(styles.footnote, styles.footnoteError)} role="alert">
            {error}
          </p>
        ) : (
          <p className={styles.footnote}>Nova can misread you — the path itself is computed from your profile, not generated.</p>
        )}
      </div>
    </section>
  );
}

function NovaMessage({
  message,
  activity,
  reduce,
  cardAnswered,
  cardBusy,
  onCardSubmit,
  onCardSkip,
}: {
  message: ChatMessageView;
  activity: string | null;
  reduce: boolean;
  cardAnswered: { skipped: boolean; stated: number } | null;
  cardBusy: boolean;
  onCardSubmit: (answer: ProfileCardAnswer) => void;
  onCardSkip: (answer: ProfileCardAnswer) => void;
}) {
  const done = message.toolCalls ?? [];
  const showChecklist = done.length > 0 || activity;
  const thinking = message.streaming && !message.text && !activity;

  return (
    <div className={styles.novaMessage}>
      <div className={styles.novaMark} aria-hidden>
        <span />
      </div>
      <div className={styles.novaBody}>
        {showChecklist && (
          <ol className={styles.checklist} aria-label="What Nova did">
            {done.map((name, i) => (
              <li key={`${name}-${i}`} className={styles.checkDone}>
                <span className={styles.checkIcon}>
                  <Check />
                </span>
                {TOOL_LABEL[name] ?? name}
              </li>
            ))}
            {activity && (
              <li className={styles.checkRunning} data-testid="chat-activity">
                <span className={styles.checkIcon}>
                  <Orb state="searching" size={20} label="Working" paused={reduce} />
                </span>
                {activity}…
              </li>
            )}
          </ol>
        )}

        {thinking && (
          <div className={styles.thinking} aria-label="Nova is thinking">
            <Orb state="searching" size={20} label="Nova is thinking" paused={reduce} />
            <span>Thinking</span>
          </div>
        )}

        {message.text && (
          <p className={cn(styles.novaText, message.degraded && styles.novaTextDegraded)}>
            {message.text}
            {message.streaming && <span className={styles.caret} aria-hidden />}
          </p>
        )}

        {message.card && <ProfileCardView card={message.card} answered={cardAnswered} busy={cardBusy} onSubmit={onCardSubmit} onSkip={onCardSkip} />}

        {message.degraded && !message.streaming && (
          <span className={styles.degradedTag}>answered without the model</span>
        )}
      </div>
    </div>
  );
}
