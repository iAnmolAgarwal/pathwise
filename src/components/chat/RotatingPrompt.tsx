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

/**
 * Tutorial-by-placeholder: sits over the empty composer and cycles the role so a first-time
 * visitor sees exactly what to type. Static (first role) under reduced motion.
 */
export function RotatingPrompt({ intro, paused = false, className }: { intro: string; paused?: boolean; className?: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % ROLE_TITLES.length), EVERY_MS);
    return () => clearInterval(t);
  }, [paused]);
  const role = ROLE_TITLES[index] ?? ROLE_TITLES[0];
  return (
    <span className={cn(styles.rotatingInner, className)} aria-hidden>
      {intro}{" "}
      <span className={styles.rotatingSlot}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={role}
            className={cn(styles.rotatingValue, "text-gradient-violet")}
            initial={paused ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.25 } }}
            transition={ENTER}
          >
            {role}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
