"use client";

import { ArrowRight, Pause, Play } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { useInView } from "./useInView";

import catalog from "@/data/catalog.json";
import { Button } from "@/components/ui/button";

import styles from "./stream.module.css";

const PATH = {
  perspective: 30,
  cardHeight: 25,
  birthHeight: 2.6,
  exitHeight: 46,
  railBirth: -11,
  railExit: 44,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 28,
  stops: 28,
};

function makeKeyframes(direction: 1 | -1, name: string) {
  const frames: string[] = [];
  for (let step = 0; step <= PATH.stops; step += 1) {
    const progress = step / PATH.stops;
    const scale =
      (PATH.birthHeight / PATH.cardHeight) *
      Math.pow(PATH.exitHeight / PATH.birthHeight, progress);
    const z = PATH.perspective * (1 - 1 / scale);
    const rail =
      PATH.railExit -
      (PATH.railExit - PATH.railBirth) * Math.pow(1 - progress, PATH.fan);
    const turn = PATH.turnBirth + (PATH.turnExit - PATH.turnBirth) * progress;
    frames.push(
      `${(progress * 100).toFixed(2)}%{transform:translate3d(${(direction * rail).toFixed(2)}cqw,0,${z.toFixed(2)}cqw) rotateY(${(-direction * turn).toFixed(2)}deg)}`,
    );
  }
  return `@keyframes ${name}{${frames.join("")}}`;
}

/** Top of the difficulty scale, read from the catalog rather than typed. */
const LEVELS = Math.max(
  ...(catalog as { difficulty: number }[]).map((c) => c.difficulty),
);

interface StreamCard {
  id: string;
  title: string;
  provider: string;
  difficulty: number;
}

const SLOTS = 18;
const TITLE_MAX = 30;
const PROVIDER_MAX = 18;

/** A title or provider that would spill past the card is cut to a fixed length with an ellipsis. */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s*\(.*?\)\s*$/, "").trim();
  return clean.length > max
    ? `${clean.slice(0, max - 1).trimEnd()}\u2026`
    : clean;
}

/** The whole catalog in a fixed shuffled order (stride walk, deterministic) — every item passes through the corridor. */
function orderCatalog(): StreamCard[] {
  const all = catalog as StreamCard[];
  const out: StreamCard[] = [];
  for (let step = 0; step < all.length; step += 1)
    out.push(all[(step * 7) % all.length]);
  return out;
}

export function SkillStream({
  id,
  nextHref = "#how-it-works",
}: {
  id?: string;
  nextHref?: string;
}) {
  const [paused, setPaused] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef);
  const running = !paused && inView;
  const animationId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const rightAnimation = `stream-right-${animationId}`;
  const leftAnimation = `stream-left-${animationId}`;
  const animationCSS = useMemo(
    () =>
      `${makeKeyframes(1, rightAnimation)}${makeKeyframes(-1, leftAnimation)}`,
    [rightAnimation, leftAnimation],
  );
  const sequence = useMemo(() => orderCatalog(), []);
  // Eighteen slots; each card advances to the next unseen item every time its loop restarts, so the
  // full catalog streams past at the cost of eighteen DOM nodes.
  const [rounds, setRounds] = useState<number[]>(() => Array(SLOTS).fill(0));
  const itemFor = (slot: number) =>
    sequence[(slot + SLOTS * rounds[slot]) % sequence.length];
  const advance = (slot: number) =>
    setRounds((current) => current.map((r, i) => (i === slot ? r + 1 : r)));

  return (
    <section
      ref={sectionRef}
      id={id}
      className={styles.shell}
      aria-labelledby="stream-title"
    >
      <style>{animationCSS}</style>

      <div className={styles.scene} aria-hidden>
        <div className={styles.world}>
          {[
            { animationName: rightAnimation, base: 0, mirror: false },
            { animationName: leftAnimation, base: 9, mirror: true },
          ].map(({ animationName, base, mirror }) =>
            Array.from({ length: 9 }, (_, index) => {
              const slot = base + index;
              const item = itemFor(slot);
              return (
                <div
                  className={`${styles.card} ${mirror ? styles.mirror : ""}`}
                  key={`${animationName}-${index}`}
                  onAnimationIteration={() => advance(slot)}
                  style={{
                    animation: `${animationName} 18s linear infinite`,
                    animationDelay: `${-(index * 18) / 9}s`,
                    animationPlayState: running ? "running" : "paused",
                  }}
                >
                  <span className={styles.domain}>
                    {clip(item.provider, PROVIDER_MAX)}
                  </span>
                  <span className={styles.name}>
                    {clip(item.title, TITLE_MAX)}
                  </span>
                  <span className={styles.level}>
                    {Array.from({ length: LEVELS }, (_, i) => i + 1).map(
                      (n) => (
                        <i
                          key={n}
                          className={
                            n <= item.difficulty ? styles.on : undefined
                          }
                        />
                      ),
                    )}
                  </span>
                </div>
              );
            }),
          )}
        </div>
      </div>

      <div className={styles.ambient} aria-hidden />

      <header className={styles.topbar}>
        <button
          className={styles.pause}
          type="button"
          onClick={() => setPaused((current) => !current)}
          aria-label={paused ? "Play animation" : "Pause animation"}
        >
          {paused ? (
            <Play size={16} strokeWidth={2} />
          ) : (
            <Pause size={16} strokeWidth={2} />
          )}
          <span className={styles.pauseLabel}>{paused ? "Play" : "Pause"}</span>
        </button>
      </header>

      <div className={styles.content}>
        <h2 id="stream-title" className={styles.h2}>
          Ten thousand courses. No order.
        </h2>
        <p className={styles.lead}>
          Every site hands you a pile of courses. None of them starts from what
          you already know and tells you the shortest way to the role you
          actually want.
        </p>
        <div className={styles.cta}>
          <Button size="lg" asChild>
            <a href={nextHref}>
              See how we order it <ArrowRight data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
