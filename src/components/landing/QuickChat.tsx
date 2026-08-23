"use client";

import { ArrowRight, LogIn, X } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Orb } from "@/components/ui/orb";
import { signInUrl } from "@/lib/signInUrl";
import { NOVA_LABEL, NOVA_ORB } from "@/nova/stage";
import type { NovaState } from "@/schemas";

import styles from "./quickchat.module.css";

type QuickChatApi = { open: () => void; close: () => void; isOpen: boolean };
const QuickChatContext = createContext<QuickChatApi | null>(null);

export function useQuickChat(): QuickChatApi {
  const ctx = useContext(QuickChatContext);
  if (!ctx) throw new Error("useQuickChat must be used inside <QuickChatProvider>");
  return ctx;
}

const ENTER = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

type Learner = { id: string; displayName: string };

/** What the landing page knows about the visitor: signed out, or signed in with their latest learner (if any). */
export type QuickChatVisitor = { signedIn: false } | { signedIn: true; learner: Learner | null };

/**
 * "Talk to Nova" on the landing: a glass drawer with the real chat inside. Signed-out
 * visitors are offered sign-in (and return to the app afterwards); signed-in visitors
 * continue with their most recent learner, or name a new one on their first message.
 */
export function QuickChatProvider({ visitor, children }: { visitor: QuickChatVisitor; children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const api = useMemo<QuickChatApi>(
    () => ({ open: () => setOpen(true), close: () => setOpen(false), isOpen }),
    [isOpen],
  );
  return (
    <QuickChatContext.Provider value={api}>
      {children}
      <QuickChatDrawer open={isOpen} onClose={api.close} visitor={visitor} />
    </QuickChatContext.Provider>
  );
}

function QuickChatDrawer({ open, onClose, visitor }: { open: boolean; onClose: () => void; visitor: QuickChatVisitor }) {
  const reduce = useReducedMotion() ?? false;
  const [learner, setLearner] = useState<Learner | null>(visitor.signedIn ? visitor.learner : null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nova, setNova] = useState<NovaState>("idle");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const start = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const displayName = name.trim();
      if (!displayName || busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/learners", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ displayName }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not start");
        const created = (await res.json()) as Learner;
        setLearner({ id: created.id, displayName: created.displayName });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start");
      } finally {
        setBusy(false);
      }
    },
    [name, busy],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className={styles.scrim}
            aria-label="Close chat"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
          <motion.aside
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Quick chat with Nova"
            initial={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }}
            transition={ENTER}
          >
            <header className={styles.header}>
              <div className={styles.presence} data-state={nova}>
                <Orb state={NOVA_ORB[nova]} size={20} paused={reduce} />
                <div>
                  <span className="label-caps">Quick chat</span>
                  <strong>{NOVA_LABEL[nova]}</strong>
                </div>
              </div>
              <div className={styles.headerActions}>
                {learner && (
                  <Button asChild variant="secondary" size="sm" className="ring-orbit">
                    <Link href={`/learn/${learner.id}`}>
                      Open workspace <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                )}
                <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                  <X />
                </button>
              </div>
            </header>

            {!visitor.signedIn ? (
              <div className={styles.start}>
                <Orb state="breathing" size={64} label="Nova" paused={reduce} />
                <h2 className={styles.startTitle}>
                  Hi, I&apos;m <span className="text-gradient-violet">Nova</span>.
                </h2>
                <p className={styles.startLead}>
                  Sign in with Google and I&apos;ll keep your goal, your skills and every version of your path under your
                  account.
                </p>
                <Button size="lg" asChild className={styles.startButton}>
                  <Link href={signInUrl("/learn")}>
                    <LogIn data-icon="inline-start" /> Sign in to start
                  </Link>
                </Button>
              </div>
            ) : learner ? (
              <div className={styles.body}>
                <ChatPanel
                  key={learner.id}
                  learnerId={learner.id}
                  initialMessages={[]}
                  onProfileUpdated={() => undefined}
                  onPathUpdated={() => undefined}
                  onNovaState={setNova}
                  compact
                />
              </div>
            ) : (
              <form className={styles.start} onSubmit={start}>
                <Orb state="breathing" size={64} label="Nova" paused={reduce} />
                <h2 className={styles.startTitle}>
                  Hi, I&apos;m <span className="text-gradient-violet">Nova</span>.
                </h2>
                <p className={styles.startLead}>
                  Tell me a name to keep your conversation under, then describe where you want to be. I&apos;ll build the first
                  path right here.
                </p>
                <label className={styles.startField}>
                  <span className="label-caps">Your name</span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya"
                    maxLength={60}
                    autoFocus
                    required
                    name="displayName"
                    autoComplete="name"
                  />
                </label>
                <Button type="submit" size="lg" disabled={busy || !name.trim()} className={styles.startButton}>
                  {busy ? (
                    <>
                      <Orb state="working" size={20} label="Starting" /> Starting
                    </>
                  ) : (
                    <>
                      Start talking <ArrowRight data-icon="inline-end" />
                    </>
                  )}
                </Button>
                {error && (
                  <p className={styles.startError} role="alert">
                    {error}
                  </p>
                )}
              </form>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
