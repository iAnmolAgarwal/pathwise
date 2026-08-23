"use client";

import { ArrowRight } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/ui/orb";
import { NovaScene } from "@/components/landing/NovaScene";
import { useQuickChat } from "@/components/landing/QuickChat";
import type { TrustNumbers } from "@/lib/trustFormat";

import styles from "./hero.module.css";
import { useInView } from "./useInView";

const ENTER = { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const };

export function Hero({ storyHref = "#how-it-works", numbers }: { storyHref?: string; numbers: TrustNumbers }) {
  const containerRef = useRef<HTMLElement>(null);
  const appRef = useRef<Application | null>(null);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const quickChat = useQuickChat();
  const reduce = useReducedMotion();

  // The runtime has no pause: play() after stop() replays the intro zoom. So the scene keeps
  // running while the hero is within a viewport of the screen (scrolling to the next section
  // and back never replays) and only stops once the visitor is well past it.
  const near = useInView(containerRef, "100% 0px");
  useEffect(() => {
    const app = appRef.current;
    if (!app || !sceneLoaded) return;
    if (near) app.play();
    else app.stop();
  }, [near, sceneLoaded]);

  const cursorX = useMotionValue(-500);
  const cursorY = useMotionValue(-500);
  const smoothX = useSpring(cursorX, { stiffness: 130, damping: 25, mass: 0.25 });
  const smoothY = useSpring(cursorY, { stiffness: 130, damping: 25, mass: 0.25 });

  function handleMouseMove(event: React.MouseEvent<HTMLElement>) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    cursorX.set(event.clientX - bounds.left);
    cursorY.set(event.clientY - bounds.top);
  }

  return (
    <motion.section
      ref={containerRef}
      className={styles.hero}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={ENTER}
      aria-label="Pathwise — Nova, your AI learning mentor"
    >
      <motion.div className={`${styles.cursorLight} bg-cursor-light`} style={{ x: smoothX, y: smoothY }} aria-hidden />

      <div className={styles.content}>
        <motion.div
          className={styles.textArea}
          initial={{ opacity: 0, x: -35 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...ENTER, delay: 0.15 }}
        >
          <Badge variant="eyebrow" dot className={styles.eyebrow}>
            Nova · your AI learning mentor
          </Badge>

          <h1 className={styles.h1}>
            A learning path
            <span className={`${styles.gradientText} text-gradient-violet`}>you can verify.</span>
          </h1>

          <p className={styles.lead}>
            For anyone working towards a role in tech — frontend, data, cloud, ML, security, {numbers.goalTemplates} roles in all — who wants
            to know what to learn next, in what order, and why.
          </p>

          <div className={styles.buttons}>
            <Button asChild>
              <a href={storyHref}>
                Explore how it works <ArrowRight data-icon="inline-end" />
              </a>
            </Button>
          </div>

        </motion.div>

        <motion.div
          className={styles.sceneArea}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...ENTER, duration: 1, delay: 0.15 }}
        >
          {!sceneLoaded && (
            <div className={styles.loader} aria-live="polite">
              <Orb state="breathing" size={64} label="Loading Nova" />
              <p className="label-caps">Loading Nova</p>
            </div>
          )}

          <NovaScene
            className={styles.spline}
            onLoad={(app) => {
              appRef.current = app;
              setSceneLoaded(true);
            }}
          />

          <motion.div
            className={styles.liveLabelWrap}
            animate={reduce ? undefined : { y: [0, -5, 0] }}
            transition={reduce ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <button type="button" onClick={quickChat.open} className={styles.liveLabel}>
              <span className={styles.liveIcon}>
                <span />
              </span>
              <div>
                <strong>Talk to Nova</strong>
                <small>Start a quick chat</small>
              </div>
            </button>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}
