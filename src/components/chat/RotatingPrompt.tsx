"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import goals from "@/data/goals.json";
import { cn } from "@/lib/utils";

import styles from "./chat.module.css";

/** The role titles the engine knows — the same list the goal templates ship with. */
export const ROLE_TITLES: string[] = (goals as { title: string }[]).map((g) => g.title);

const ENTER = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };
const EVERY_MS = 2200;

type Props = {
  /** Text before the rotating slot; ignored when `phrases` are given. */
  intro?: string;
  /** Full sentences to rotate instead of role titles — what the learner would say next at this stage. */
  phrases?: string[] | null;
  paused?: boolean;
  className?: string;
  /** Fills the composer with the phrase on show (the whole placeholder is a button then). */
  onPick?: (text: string) => void;
};

/**
 * Tutorial-by-placeholder: sits over the empty composer and cycles either the role titles (before
 * a goal exists) or stage-aware suggestions (after), so the learner sees exactly what to type.
 * Static (first entry) under reduced motion.
 */
export function RotatingPrompt({ intro = "", phrases, paused = false, className, onPick }: Props) {
  const list = phrases && phrases.length > 0 ? phrases : ROLE_TITLES;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [list.length, phrases]);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % list.length), EVERY_MS);
    return () => clearInterval(t);
  }, [paused, list.length]);
  const role = list[index] ?? list[0];
  const text = phrases && phrases.length > 0 ? role : `${intro} ${role}`.trim();
  const Tag = onPick ? "button" : "span";
  return (
    <Tag
      className={cn(styles.rotatingInner, onPick && styles.rotatingPick, className)}
      aria-hidden={!onPick}
      {...(onPick ? { type: "button" as const, onClick: () => onPick(text), "aria-label": `Use suggestion: ${text}` } : {})}
    >
      {phrases && phrases.length > 0 ? null : <>{intro} </>}
      <span className={styles.rotatingSlot}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={role}
            className={cn(styles.rotatingValue, phrases && phrases.length > 0 ? styles.rotatingPhrase : "text-gradient-violet")}
            initial={paused ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { ...ENTER, delay: 0.2 } }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.18 } }}
            transition={ENTER}
          >
            {role}
          </motion.span>
        </AnimatePresence>
      </span>
    </Tag>
  );
}
