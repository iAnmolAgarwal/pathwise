"use client";

import { useEffect, useRef } from "react";

import { useInView } from "./useInView";

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

/** Small illustrations of each feature, drawn in CSS/SVG so every panel carries information. */
function PanelArt({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <div className={styles.art} aria-hidden>
          <div className={styles.bar} style={{ "--w": "82%" } as React.CSSProperties}>
            <span>relevance</span>
            <i />
            <b>0.82</b>
          </div>
          <div className={styles.bar} style={{ "--w": "71%" } as React.CSSProperties}>
            <span>level fit</span>
            <i />
            <b>0.71</b>
          </div>
          <div className={styles.bar} style={{ "--w": "64%" } as React.CSSProperties}>
            <span>time</span>
            <i />
            <b>0.64</b>
          </div>
          <div className={styles.bar} style={{ "--w": "90%" } as React.CSSProperties}>
            <span>style</span>
            <i />
            <b>0.90</b>
          </div>
        </div>
      );
    case 1:
      return (
        <div className={`${styles.art} ${styles.chips}`} aria-hidden>
          <span className={styles.chip}>
            <em>goal</em> ML engineer
          </span>
          <span className={styles.chip}>
            <em>time</em> 6 h / week
          </span>
          <span className={styles.chip}>
            <em>python</em> level 3
          </span>
          <span className={`${styles.chip} ${styles.new}`}>
            <em>+ sql</em> level 2
          </span>
        </div>
      );
    case 2:
      return (
        <div className={styles.art} aria-hidden>
          <svg className={styles.graph} viewBox="0 0 220 120" fill="none">
            <g stroke="rgba(255,255,255,0.28)" strokeWidth="1.2">
              <path d="M30 95 L80 62 L140 70 L190 30" />
              <path d="M80 62 L120 24" />
              <path d="M140 70 L175 98" />
              <path d="M30 95 L60 24" />
            </g>
            <circle cx="30" cy="95" r="7" fill="#f5f5f7" />
            <circle cx="60" cy="24" r="6" fill="#f5f5f7" />
            <circle cx="80" cy="62" r="7" fill="#a78bfa" />
            <circle cx="120" cy="24" r="6" fill="#a78bfa" />
            <circle cx="140" cy="70" r="7" fill="#ff6b6b" />
            <circle cx="175" cy="98" r="6" fill="#ff6b6b" />
            <circle cx="190" cy="30" r="7" fill="rgba(255,255,255,0.35)" />
          </svg>
          <div className={styles.streak}>
            <i className={styles.on} style={{ background: "#f5f5f7" }} />
            <span>acquired</span>
            <i style={{ background: "#a78bfa" }} />
            <span>in progress</span>
            <i style={{ background: "#ff6b6b" }} />
            <span>gap</span>
          </div>
        </div>
      );
    case 3:
      return (
        <div className={styles.art} aria-hidden>
          <div className={styles.diff}>
            <b>Path updated</b>
            Swapped <s>Kafka: The Definitive Guide</s> for Streaming Systems because you marked the
            last one too hard.
          </div>
        </div>
      );
    case 4:
      return (
        <div className={styles.art} aria-hidden>
          <div className={styles.streak}>
            <i className={styles.on} />
            <i className={styles.on} />
            <i className={styles.on} />
            <i className={styles.on} />
            <i />
            <i className={styles.on} />
            <i className={styles.on} />
            <span>6-week streak</span>
          </div>
          <div className={styles.bar} style={{ "--w": "38%" } as React.CSSProperties}>
            <span>progress</span>
            <i />
            <b>38%</b>
          </div>
        </div>
      );
    default:
      return (
        <div className={`${styles.art} ${styles.meter}`} aria-hidden>
          <span className={styles.state}>
            <i /> LLM budget · 62% left
          </span>
          <div className={styles.meterRow} style={{ "--w": "62%" } as React.CSSProperties}>
            <span>tokens</span>
            <i />
          </div>
          <div className={styles.meterRow} style={{ "--w": "91%" } as React.CSSProperties}>
            <span>cache hits</span>
            <i />
          </div>
          <span className={styles.state}>
            <i style={{ background: "#ffffff", boxShadow: "0 0 8px rgba(255,255,255,.6)" }} /> degraded → engine still answers
          </span>
        </div>
      );
  }
}

export function MotionWall({ id }: { id?: string }) {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef);

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
    <section ref={sectionRef} id={id} className={`${styles.scene} ${inView ? "" : styles.quiet}`} aria-labelledby="wall-heading">
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
              <PanelArt index={index} />
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
