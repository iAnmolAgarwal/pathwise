"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { NOVA_SCENE_TIMEOUT_MS, NovaScene } from "@/components/landing/NovaScene";
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
  // The scene never arrived — the orb stays as the stage instead of standing in for it.
  // An error is final; a stall may still resolve, so the two are kept apart.
  const [sceneErrored, setSceneErrored] = useState(false);
  const [sceneStalled, setSceneStalled] = useState(false);
  const [hover, setHover] = useState(false);
  // A reaction is "fresh" until the viewer has sat with it.
  const [seenReaction, setSeenReaction] = useState<string | null>(null);
  const inView = useInView(rootRef, "0px");

  // A stalled scene request resolves neither callback, so a timer is what notices it.
  // The scene stays mounted: arriving late still replaces the orb.
  useEffect(() => {
    if (app) return;
    const timer = setTimeout(() => setSceneStalled(true), NOVA_SCENE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [app]);

  // An error outranks a load callback: once the boundary has caught, the canvas is gone.
  const sceneVisible = !!app && !sceneErrored;

  // The scene renders at 60 fps: run it only while the stage is on screen.
  useEffect(() => {
    if (!app || sceneErrored) return;
    if (inView && !reducedMotion) app.play();
    else app.stop();
  }, [app, sceneErrored, inView, reducedMotion]);

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

      {!sceneVisible && (
        <div className={styles.loader} aria-hidden>
          {/* Held still once the scene has given up: the orb is the stage now, not a wait. */}
          <Orb state={NOVA_ORB[state]} size={64} paused={reducedMotion || sceneErrored || sceneStalled} />
        </div>
      )}

      <NovaScene
        className={cn(styles.spline, sceneVisible && styles.splineReady)}
        onLoad={setApp}
        onError={() => setSceneErrored(true)}
      />

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
