"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { NovaScene } from "@/components/landing/NovaScene";
import { useInView } from "@/components/landing/useInView";
import { Orb } from "@/components/ui/orb";
import { NOVA_LABEL, NOVA_ORB, type NovaStageProps } from "@/nova/stage";
import { cn } from "@/lib/utils";

import styles from "./stage.module.css";

export type NovaReaction = { text: string; tone: "greet" | "cheer" | "nudge" | "info" | "rest" };

const ENTER = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

/**
 * Nova's stage inside the app: the Spline scene framed for a pane, the orb standing in
 * until it loads, and a reaction bubble for the moment you arrive. Reads `state` /
 * `transitions` (§9.2) for the caption; scene motion stays the scene's own.
 */
export function NovaStage({ state, placement, reducedMotion = false, className, reaction }: NovaStageProps & { reaction?: NovaReaction | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [hover, setHover] = useState(false);
  // A reaction is "fresh" until the viewer has sat with it.
  const [seenReaction, setSeenReaction] = useState<string | null>(null);
  const inView = useInView(rootRef, "0px");

  // The scene renders at 60 fps: run it only while the stage is on screen.
  useEffect(() => {
    if (!app) return;
    if (inView && !reducedMotion) app.play();
    else app.stop();
  }, [app, inView, reducedMotion]);

  // A reaction shows when the stage appears or the reaction changes, then fades; hover brings it back.
  const freshReaction = !!reaction && reaction.text !== seenReaction;
  useEffect(() => {
    if (!freshReaction || !reaction) return;
    const t = setTimeout(() => setSeenReaction(reaction.text), 7000);
    return () => clearTimeout(t);
  }, [freshReaction, reaction]);

  const reactionVisible = !!reaction && (freshReaction || hover);

  return (
    <div
      ref={rootRef}
      className={cn(styles.stage, className)}
      data-placement={placement}
      data-state={state}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      role="img"
      aria-label={NOVA_LABEL[state]}
    >
      <div className={styles.halo} aria-hidden />

      {!app && (
        <div className={styles.loader} aria-hidden>
          <Orb state={NOVA_ORB[state]} size={64} paused={reducedMotion} />
        </div>
      )}

      <NovaScene className={cn(styles.spline, app && styles.splineReady)} onLoad={setApp} />

      <AnimatePresence>
        {reactionVisible && reaction && (
          <motion.div
            key={reaction.text}
            className={styles.bubble}
            data-tone={reaction.tone}
            initial={reducedMotion ? false : { opacity: 0, x: 12, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, transition: { duration: 0.25 } }}
            transition={ENTER}
            role="status"
          >
            <span className={styles.bubbleKicker}>Nova</span>
            <p>{reaction.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
