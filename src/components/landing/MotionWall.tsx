"use client";

import { useEffect, useRef } from "react";

import type { DemoNumbers } from "@/lib/demoStory";
import type { TrustNumbers } from "@/lib/trustFormat";

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

/** Six things a course list never does; one shipped feature per panel (§7, §8.3, §5.1, §5.5, §6, §8.4). */
const PANELS: Panel[] = [
  { eyebrow: "WHY THIS COURSE", title: ["WHY", "THIS?"], footer: "FIVE SCORES ON EVERY CARD", speed: 0.92 },
  { eyebrow: "LIVE PROFILE", title: ["FILLS", "AS YOU TALK"], footer: "", speed: 0.88 },
  { eyebrow: "SKILL GRAPH", title: ["GAP", "MAP"], footer: "", speed: 0.92 },
  { eyebrow: "WHEN A COURSE IS TOO HARD", title: ["THE PLAN", "CHANGES"], footer: "", speed: 0.9 },
  { eyebrow: "DASHBOARD", title: ["PROGRESS", "RADAR"], footer: "", speed: 0.86 },
  { eyebrow: "IF THE MODEL IS DOWN", title: ["STILL", "ANSWERS"], footer: "", speed: 0.84 },
];

const SCORE_LABELS: { key: keyof DemoNumbers["score"]; label: string }[] = [
  { key: "coverage", label: "coverage" },
  { key: "levelFit", label: "level fit" },
  { key: "preferenceFit", label: "preference fit" },
  { key: "quality", label: "quality" },
  { key: "similarity", label: "similarity" },
];

const pct = (value: number) => `${Math.round(value * 100)}%`;

type ArtProps = { index: number; numbers: TrustNumbers; demo: DemoNumbers };

/** The real app element behind each panel, fed by the engine's output for the demo learner. */
function PanelArt({ index, numbers, demo }: ArtProps) {
  switch (index) {
    case 0:
      return (
        <div className={styles.art} aria-hidden>
          {SCORE_LABELS.map(({ key, label }) => (
            <div className={styles.bar} key={key} style={{ "--w": pct(demo.score[key]) } as React.CSSProperties}>
              <span>{label}</span>
              <i />
              <b>{demo.score[key].toFixed(2)}</b>
            </div>
          ))}
        </div>
      );
    case 1:
      return (
        <div className={`${styles.art} ${styles.chips}`} aria-hidden>
          <span className={styles.chip}>
            <em>goal</em> {demo.chips.goal}
          </span>
          <span className={styles.chip}>
            <em>time</em> {demo.chips.hoursPerWeek} h / week
          </span>
          {demo.chips.skills.map((skill, i) => (
            <span className={i === demo.chips.skills.length - 1 ? `${styles.chip} ${styles.new}` : styles.chip} key={skill.id}>
              {i === demo.chips.skills.length - 1 ? `+ ${skill.name}` : skill.name} <em>level {skill.level}</em>
            </span>
          ))}
        </div>
      );
    case 2:
      return (
        <div className={styles.art} aria-hidden>
          <svg className={styles.graph} viewBox="0 0 220 120" fill="none">
            <g stroke="var(--color-line-strong)" strokeWidth="1.2">
              <path d="M30 95 L80 62 L140 70 L190 30" />
              <path d="M80 62 L120 24" />
              <path d="M140 70 L175 98" />
              <path d="M30 95 L60 24" />
            </g>
            <circle cx="30" cy="95" r="7" fill="var(--color-status-acquired)" />
            <circle cx="60" cy="24" r="6" fill="var(--color-status-acquired)" />
            <circle cx="80" cy="62" r="7" fill="var(--color-status-progress)" />
            <circle cx="120" cy="24" r="6" fill="var(--color-status-progress)" />
            <circle cx="140" cy="70" r="7" fill="var(--color-status-gap)" />
            <circle cx="175" cy="98" r="6" fill="var(--color-status-gap)" />
            <circle cx="190" cy="30" r="7" fill="var(--color-status-acquired)" />
          </svg>
          <div className={styles.streak}>
            <i style={{ background: "var(--color-status-acquired)" }} />
            <span>acquired</span>
            <i style={{ background: "var(--color-status-progress)" }} />
            <span>in progress</span>
            <i style={{ background: "var(--color-status-gap)" }} />
            <span>gap</span>
          </div>
          <p className={styles.count}>
            {numbers.skills} skills / {numbers.authoredEdges} edges
          </p>
        </div>
      );
    case 3: {
      const [added] = demo.tooHard.added;
      const [removed] = demo.tooHard.removed;
      return (
        <div className={styles.art} aria-hidden>
          <div className={styles.diff}>
            <b>Path updated</b>
            <p className={styles.cause}>{demo.tooHard.cause}</p>
            {added ? (
              <p className={styles.row}>
                <span className={styles.plus}>+</span>
                <strong>{added.title}</strong>
              </p>
            ) : null}
            {removed ? (
              <p className={styles.row}>
                <span className={styles.minus}>−</span>
                <s>{removed.title}</s>
              </p>
            ) : null}
          </div>
        </div>
      );
    }
    case 4:
      return (
        <div className={styles.art} aria-hidden>
          <div className={styles.streak}>
            {Array.from({ length: 7 }, (_, day) => (
              <i className={day < demo.streakDays ? styles.on : undefined} key={day} />
            ))}
            <span>{demo.streakDays}-day streak</span>
          </div>
          <div className={styles.bar} style={{ "--w": `${demo.progressPct}%` } as React.CSSProperties}>
            <span>progress</span>
            <i />
            <b>{demo.progressPct}%</b>
          </div>
        </div>
      );
    default:
      return (
        <div className={`${styles.art} ${styles.meter}`} aria-hidden>
          <span className={styles.state}>
            <i /> Nova is resting. The model is unavailable.
          </span>
          <div className={styles.meterRow} style={{ "--w": "100%" } as React.CSSProperties}>
            <span>path</span>
            <i />
          </div>
          <div className={styles.meterRow} style={{ "--w": "100%" } as React.CSSProperties}>
            <span>graph</span>
            <i />
          </div>
          <div className={styles.meterRow} style={{ "--w": "100%" } as React.CSSProperties}>
            <span>dashboard</span>
            <i />
          </div>
          <span className={styles.state}>
            <i /> Path, graph and dashboard keep working without the model.
          </span>
        </div>
      );
  }
}

export function MotionWall({ id, numbers, demo }: { id?: string; numbers: TrustNumbers; demo: DemoNumbers }) {
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
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  // Six video textures decode continuously; only the ones on screen should. Pause when the wall
  // is scrolled away or the tab is hidden, resume when it is back.
  useEffect(() => {
    const sync = () => {
      const shouldPlay = inView && !document.hidden;
      videoRefs.current.forEach((video) => {
        if (!video) return;
        if (shouldPlay) void video.play().catch(() => undefined);
        else video.pause();
      });
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [inView]);

  return (
    <section ref={sectionRef} id={id} className={`${styles.scene} ${inView ? "" : styles.quiet}`} aria-labelledby="wall-heading">
      <div className={styles.wall}>
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
              {panel.footer ? <p className={styles.footer}>{panel.footer}</p> : null}
              <PanelArt index={index} numbers={numbers} demo={demo} />
            </div>
          </article>
        ))}
      </div>

      <div className={styles.vignette} aria-hidden />

      <div className={styles.glass}>
        <div className={styles.reflection} aria-hidden />
        <div className={styles.glassCopy}>
          <p className={styles.intro}>
            You get a plan, the reasons behind each step, and a mentor who rewrites it when you push back.
          </p>
          <h2 id="wall-heading" className={styles.heading}>
            <span>Six things</span>
            <span>a course list</span>
            <span>never does.</span>
          </h2>
          <p className={styles.wordmark}>PATHWISE</p>
        </div>
      </div>

      <div className={`${styles.grain} bg-noise`} aria-hidden />
    </section>
  );
}
