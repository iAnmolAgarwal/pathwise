"use client";

import { useEffect, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { NovaScene } from "@/components/landing/NovaScene";
import { useInView } from "@/components/landing/useInView";
import { Orb } from "@/components/ui/orb";
import { NOVA_LABEL, NOVA_ORB, type NovaStageProps } from "@/nova/stage";
import { cn } from "@/lib/utils";

import styles from "./stage.module.css";

/**
 * Nova's stage inside the app: the Spline scene, framed for a pane rather than
 * a hero, with the orb standing in until the scene arrives. Reads only
 * `state` / `transitions` (§9.2) — the per-state scene motion lands in a later
 * pass; for now the presence label tracks the state and the scene idles.
 */
export function NovaStage({ state, placement, reducedMotion, className }: NovaStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const inView = useInView(rootRef, "0px");

  // The scene renders at 60 fps: run it only while the stage is on screen.
  useEffect(() => {
    const app = appRef.current;
    if (!app || !loaded) return;
    if (inView && !reducedMotion) app.play();
    else app.stop();
  }, [inView, loaded, reducedMotion]);

  return (
    <div
      ref={rootRef}
      className={cn(styles.stage, className)}
      data-placement={placement}
      data-state={state}
      role="img"
      aria-label={NOVA_LABEL[state]}
    >
      <div className={styles.halo} aria-hidden />

      {!loaded && (
        <div className={styles.loader} aria-hidden>
          <Orb state={NOVA_ORB[state]} size={64} paused={reducedMotion} />
        </div>
      )}

      <NovaScene
        className={cn(styles.spline, loaded && styles.splineReady)}
        onLoad={(app) => {
          appRef.current = app;
          setLoaded(true);
        }}
      />

      <div className={styles.caption} aria-hidden>
        <Orb state={NOVA_ORB[state]} size={20} paused={reducedMotion} />
        <span className="label-caps">{NOVA_LABEL[state]}</span>
      </div>
    </div>
  );
}
