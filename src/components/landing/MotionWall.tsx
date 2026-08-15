"use client";

import { useEffect, useRef } from "react";

import styles from "./wall.module.css";

interface Panel {
  /** Optional looping screen capture; falls back to the poster gradient. */
  src?: string;
  eyebrow: string;
  title: string[];
  footer: string;
  speed: number;
}

/** Six things a course catalogue does not do. */
const PANELS: Panel[] = [
  { eyebrow: "01 / EXPLAINABLE", title: ["WHY", "THIS?"], footer: "EVIDENCE, NOT VIBES", speed: 0.92 },
  { eyebrow: "LIVE PROFILE", title: ["FILLS", "AS YOU TALK"], footer: "OPS APPLIED IN VIEW", speed: 0.88 },
  { eyebrow: "SKILL GRAPH", title: ["GAP", "MAP"], footer: "159 NODES / 193 EDGES", speed: 0.92 },
  { eyebrow: "ADAPTIVE", title: ["PATH", "DIFF"], footer: "FEEDBACK REWRITES", speed: 0.9 },
  { eyebrow: "DASHBOARD", title: ["PROGRESS", "RADAR"], footer: "STREAK / NEXT ACTION", speed: 0.86 },
  { eyebrow: "JUDGE MODE", title: ["COST", "AWARE"], footer: "DEGRADES, NEVER DIES", speed: 0.84 },
];

export function MotionWall({ id }: { id?: string }) {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      const panel = PANELS[index];
      const beginPlayback = () => {
        video.muted = true;
        video.defaultMuted = true;
        video.playbackRate = panel.speed;
        void video.play().catch(() => undefined);
      };
      if (video.readyState >= 3) beginPlayback();
      video.addEventListener("canplay", beginPlayback);
      cleanups.push(() => video.removeEventListener("canplay", beginPlayback));
    });
    const handleVisibility = () => {
      videoRefs.current.forEach((video) => {
        if (!video) return;
        if (document.hidden) video.pause();
        else void video.play().catch(() => undefined);
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <section id={id} className={styles.scene} aria-labelledby="wall-heading">
      <div className={styles.wall} aria-hidden>
        {PANELS.map((panel, index) => (
          <article className={styles.panel} key={panel.eyebrow}>
            {panel.src ? (
              <video
                ref={(node) => {
                  videoRefs.current[index] = node;
                }}
                className={styles.video}
                src={panel.src}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
                tabIndex={-1}
              />
            ) : (
              <div className={styles.poster} />
            )}
            <div className={styles.copy}>
              <p className={styles.eyebrow}>{panel.eyebrow}</p>
              <p className={styles.title}>
                {panel.title.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </p>
              <p className={styles.footer}>{panel.footer}</p>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.vignette} aria-hidden />

      <div className={styles.glass}>
        <div className={styles.reflection} aria-hidden />
        <div className={styles.glassCopy}>
          <p className={styles.intro}>
            Most recommenders hand you a list. Pathwise hands you a sequenced, evidenced plan — and a
            mentor who explains every step and changes it when you push back.
          </p>
          <h2 id="wall-heading" className={styles.heading}>
            <span>Different</span>
            <span>by design,</span>
            <span>not by claim</span>
          </h2>
          <p className={styles.wordmark}>PATHWISE</p>
        </div>
      </div>

      <div className={`${styles.grain} bg-noise`} aria-hidden />
    </section>
  );
}
