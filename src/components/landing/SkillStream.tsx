"use client";

import { ArrowRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import skills from "@/data/skills.json";
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
    const scale = (PATH.birthHeight / PATH.cardHeight) * Math.pow(PATH.exitHeight / PATH.birthHeight, progress);
    const z = PATH.perspective * (1 - 1 / scale);
    const rail = PATH.railExit - (PATH.railExit - PATH.railBirth) * Math.pow(1 - progress, PATH.fan);
    const turn = PATH.turnBirth + (PATH.turnExit - PATH.turnBirth) * progress;
    frames.push(
      `${(progress * 100).toFixed(2)}%{transform:translate3d(${(direction * rail).toFixed(2)}cqw,0,${z.toFixed(2)}cqw) rotateY(${(-direction * turn).toFixed(2)}deg)}`,
    );
  }
  return `@keyframes ${name}{${frames.join("")}}`;
}

interface SkillCard {
  id: string;
  name: string;
  domain: string;
  levelBand: number;
}

/** Nine skills per rail, spread across the ten domains so the corridor reads as the whole map. */
function pickSkills(): { right: SkillCard[]; left: SkillCard[] } {
  const all = skills as SkillCard[];
  const byDomain = new Map<string, SkillCard[]>();
  for (const s of all) byDomain.set(s.domain, [...(byDomain.get(s.domain) ?? []), s]);
  const domains = [...byDomain.keys()];
  const chosen: SkillCard[] = [];
  let round = 0;
  while (chosen.length < 18) {
    for (const d of domains) {
      const list = byDomain.get(d)!;
      const pick = list[(round * 3) % list.length];
      if (pick && !chosen.includes(pick)) chosen.push(pick);
      if (chosen.length === 18) break;
    }
    round += 1;
  }
  return { right: chosen.slice(0, 9), left: chosen.slice(9, 18) };
}

export function SkillStream({ id, appHref = "/learn" }: { id?: string; appHref?: string }) {
  const [paused, setPaused] = useState(false);
  const animationId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const rightAnimation = `stream-right-${animationId}`;
  const leftAnimation = `stream-left-${animationId}`;
  const animationCSS = useMemo(
    () => `${makeKeyframes(1, rightAnimation)}${makeKeyframes(-1, leftAnimation)}`,
    [rightAnimation, leftAnimation],
  );
  const rails = useMemo(() => pickSkills(), []);

  return (
    <section id={id} className={styles.shell} aria-labelledby="stream-title">
      <style>{animationCSS}</style>

      <div className={styles.scene} aria-hidden>
        <div className={styles.world}>
          {[
            { animationName: rightAnimation, cards: rails.right, mirror: false },
            { animationName: leftAnimation, cards: rails.left, mirror: true },
          ].map(({ animationName, cards, mirror }) =>
            cards.map((skill, index) => (
              <div
                className={`${styles.card} ${mirror ? styles.mirror : ""}`}
                key={`${animationName}-${skill.id}`}
                style={{
                  animation: `${animationName} 18s linear infinite`,
                  animationDelay: `${-(index * 18) / 9}s`,
                  animationPlayState: paused ? "paused" : "running",
                }}
              >
                <span className={styles.domain}>{skill.domain.replace(/-/g, " ")}</span>
                <span className={styles.name}>{skill.name}</span>
                <span className={styles.level}>
                  {[1, 2, 3].map((n) => (
                    <i key={n} className={n <= skill.levelBand ? styles.on : undefined} />
                  ))}
                </span>
              </div>
            )),
          )}
        </div>
      </div>

      <div className={styles.ambient} aria-hidden />

      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} />
          SKILL MAP
        </div>
        <button
          className={styles.pause}
          type="button"
          onClick={() => setPaused((current) => !current)}
          aria-label={paused ? "Play animation" : "Pause animation"}
        >
          {paused ? <Play size={12} strokeWidth={2} /> : <Pause size={12} strokeWidth={2} />}
          <span className={styles.pauseLabel}>{paused ? "Play" : "Pause"}</span>
        </button>
      </header>

      <div className={styles.content}>
        <p className={styles.eyebrow}>159 skills · 10 domains · 193 prerequisite edges</p>
        <h2 id="stream-title" className={styles.h2}>
          Every skill, mapped.
        </h2>
        <div className={styles.cta}>
          <Button size="lg" asChild>
            <Link href={appHref}>
              View a sample path <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
