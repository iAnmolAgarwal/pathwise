"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Orb } from "@/components/ui/orb";
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

const STORAGE_KEY = "pathwise.quickLearner";
const ENTER = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

/**
 * "Talk to Nova" on the landing: a glass drawer with the real chat inside. The
 * first message creates a learner (kept in localStorage so a return visit
 * continues the same conversation) and the drawer offers the full workspace.
 */
export function QuickChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const api = useMemo<QuickChatApi>(
    () => ({ open: () => setOpen(true), close: () => setOpen(false), isOpen }),
    [isOpen],
  );
  return (
    <QuickChatContext.Provider value={api}>
      {children}
      <QuickChatDrawer open={isOpen} onClose={api.close} />
    </QuickChatContext.Provider>
  );
}

type Learner = { id: string; displayName: string };

function readStoredLearner(): Learner | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Learner) : null;
  } catch {
    return null;
  }
}

function QuickChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReducedMotion() ?? false;
  // Read lazily: nothing depends on it until the drawer opens, so hydration stays stable.
  const [learner, setLearner] = useState<Learner | null>(readStoredLearner);
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
        const next = { id: created.id, displayName: created.displayName };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setLearner(next);
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
                  <Button asChild variant="secondary" size="sm">
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

            {learner ? (
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
