"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/ui/orb";
import { NovaScene } from "@/components/landing/NovaScene";

import styles from "./hero.module.css";
import { useInView } from "./useInView";

const ENTER = { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const };

export function Hero({ storyHref = "#story", appHref = "/learn" }: { storyHref?: string; appHref?: string }) {
  const containerRef = useRef<HTMLElement>(null);
  const appRef = useRef<Application | null>(null);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const inView = useInView(containerRef, "0px");

  // Nova's scene renders at 60 fps; stop it while the hero is scrolled away.
  useEffect(() => {
    const app = appRef.current;
    if (!app || !sceneLoaded) return;
    if (inView) app.play();
    else app.stop();
  }, [inView, sceneLoaded]);

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
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Link href={appHref} className={styles.liveLabel} aria-label="Nova is live — start a quick chat">
              <span className={styles.liveIcon}>
                <span />
              </span>
              <div>
                <strong>Nova is live</strong>
                <small>Start a quick chat</small>
              </div>
            </Link>
          </motion.div>
        </motion.div>

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
            Learn what
            <span className={`${styles.gradientText} text-gradient-violet`}>matters.</span>
          </h1>

          <p className={styles.lead}>
            Tell Nova where you want to be. She maps your skill gap, sequences the fewest courses
            that close it, and rewrites the plan when you push back.
          </p>

          <div className={styles.buttons}>
            <Button asChild>
              <a href={storyHref}>
                Explore how it works <ArrowRight data-icon="inline-end" />
              </a>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={appHref}>View a sample path</Link>
            </Button>
          </div>

          <div className={styles.features}>
            <div>
              <strong>159 skills</strong>
              <span>mapped &amp; sequenced</span>
            </div>
            <i aria-hidden />
            <div>
              <strong>Adaptive</strong>
              <span>feedback rewrites the path</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
