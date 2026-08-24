"use client";

import { motion, useInView as useMotionInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useHydrated } from "@/lib/hydrated";
import type { TrustNumbers } from "@/lib/trustFormat";

import styles from "./proofstrip.module.css";

/**
 * Proof strip — the agreement report's headline numbers (§15.7). Each cell rests dark; on hover,
 * focus or touch a liquid colour field rises behind the number. Palettes are the system tokens
 * (violet, viz, sky, coral, brand) read from the document at mount, so the canvas can never
 * drift from app/globals.css.
 */

type Palette = "map" | "links" | "confirmed" | "disputed";

const PALETTE_TOKENS: Record<Palette, [string, string, string]> = {
  map: ["--color-violet", "--color-viz", "--color-aurora-sky"],
  links: ["--color-aurora-sky", "--color-violet", "--color-viz"],
  confirmed: ["--color-violet", "--color-brand", "--color-viz"],
  disputed: ["--color-coral", "--color-violet", "--color-viz"],
};

function readTokens(names: readonly string[]): string[] {
  const root = getComputedStyle(document.documentElement);
  return names.map((name) => root.getPropertyValue(name).trim() || "#a78bfa");
}

function LiquidCanvas({ palette, active }: { palette: Palette; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The loop reads `active` through a ref so hovering never tears down the observers or re-reads tokens.
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !host || !context) return;

    const colors = readTokens(PALETTE_TOKENS[palette]);
    const base = readTokens(["--color-surface-1"])[0];
    const mouse = { x: 0.36, y: 0.44 };
    const smooth = { ...mouse };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let raf = 0;
    let visible = true;
    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.35);
      width = Math.max(1, Math.round(rect.width * ratio));
      height = Math.max(1, Math.round(rect.height * ratio));
      canvas.width = width;
      canvas.height = height;
    };

    const blob = (x: number, y: number, radius: number, color: string, opacity: number) => {
      const gradient = context.createRadialGradient(x, y, radius * 0.05, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.42, `${color}b0`);
      gradient.addColorStop(1, `${color}00`);
      context.globalAlpha = opacity;
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(x, y, radius * 1.25, radius * 0.82, Math.sin(frame * 0.008) * 0.75, 0, Math.PI * 2);
      context.fill();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 1;
      context.fillStyle = base;
      context.fillRect(0, 0, width, height);

      smooth.x += (mouse.x - smooth.x) * 0.045;
      smooth.y += (mouse.y - smooth.y) * 0.045;

      const t = frame * 0.012;
      const radius = Math.max(width, height) * 0.55;

      context.save();
      context.globalCompositeOperation = "screen";
      context.filter = `blur(${Math.max(24, width * 0.075)}px)`;
      blob(smooth.x * width, smooth.y * height, radius, colors[0], 0.55);
      blob(width * (0.72 + Math.sin(t * 0.7) * 0.16), height * (0.3 + Math.cos(t * 0.5) * 0.18), radius * 0.85, colors[1], 0.42);
      blob(width * (0.28 + Math.cos(t * 0.55) * 0.18), height * (0.76 + Math.sin(t * 0.8) * 0.13), radius * 0.9, colors[2], 0.38);
      context.restore();

      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = 0.16;
      context.filter = `blur(${Math.max(18, width * 0.04)}px)`;
      for (let index = 0; index < 5; index++) {
        const y = height * (0.15 + index * 0.2 + Math.sin(t * 0.65 + index * 1.4) * 0.09);
        context.beginPath();
        context.lineWidth = Math.max(28, height * 0.11);
        context.strokeStyle = index % 2 ? colors[1] : colors[0];
        context.moveTo(-width * 0.15, y);
        context.bezierCurveTo(
          width * 0.2,
          y + Math.sin(t + index) * height * 0.28,
          width * 0.75,
          y - Math.cos(t * 0.7 + index) * height * 0.3,
          width * 1.15,
          y + Math.sin(t * 0.5 + index) * height * 0.15,
        );
        context.stroke();
      }
      context.restore();

      const vignette = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.8);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.45)");
      context.globalAlpha = 1;
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
    };

    const animate = () => {
      if (!visible) {
        raf = 0;
        return;
      }
      if (activeRef.current) {
        frame += reducedMotion ? 0 : 1;
        draw();
      }
      raf = requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      mouse.x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      mouse.y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    };
    const handlePointerLeave = () => {
      mouse.x = 0.36;
      mouse.y = 0.44;
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
    });
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      // The loop parks itself when off-screen, so it has to be restarted here.
      if (visible && !raf) raf = requestAnimationFrame(animate);
    });

    resize();
    draw();
    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    host.addEventListener("pointermove", handlePointerMove);
    host.addEventListener("pointerleave", handlePointerLeave);
    raf = requestAnimationFrame(animate);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      host.removeEventListener("pointermove", handlePointerMove);
      host.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [palette]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}

/** Counts up from 0 to `value` once the strip scrolls into view. */
function Count({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useMotionInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduce, value]);

  // Reduced motion skips the count-up entirely: the final value is what renders. The preference
  // is only readable in the browser (`reduce` is null on the server), so the count-up's starting
  // value is what the server and the hydration render both emit; the jump to the final number
  // happens on the render right after hydration.
  return <span ref={ref}>{hydrated && reduce ? value : shown}</span>;
}

type Cell = { label: string; value: number; of?: number; note: string; palette: Palette };

export function ProofStrip({ id, numbers }: { id?: string; numbers: TrustNumbers }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const reduce = useReducedMotion();
  // Touch/pen taps toggle and must survive the pointerleave that follows a tap.
  const pointerTypeRef = useRef<string>("mouse");

  const cells: Cell[] = [
    { label: "Skills", value: numbers.skills, note: "the skills we cover, ordered by hand.", palette: "map" },
    {
      label: "Checkable",
      value: numbers.observable,
      of: numbers.authoredEdges,
      note: "\u201clearn this before that\u201d tested against real learners.",
      palette: "links",
    },
    { label: "Confirmed", value: numbers.confirmedAny, of: numbers.observable, note: "the order held.", palette: "confirmed" },
    {
      label: "Disputed",
      value: numbers.contradicted,
      of: numbers.observable,
      note: numbers.resolved === numbers.contradicted ? "the order didn\u2019t. A person read each one and decided." : "the order didn\u2019t. A person is reading each one.",
      palette: "disputed",
    },
  ];

  const release = (index: number) => setActiveIndex((current) => (current === index ? 0 : current));

  return (
    <section id={id} className={styles.section} aria-labelledby="proof-title">
      <header className={styles.kicker}>
        <h2 id="proof-title" className={styles.title}>
          Why trust the order we give you?
        </h2>
      </header>

      <motion.div
        className={styles.row}
        initial={reduce ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {cells.map((cell, index) => {
          const active = activeIndex === index || focusIndex === index;
          const labelId = `proof-${index}-label`;
          return (
            <article
              key={cell.label}
              className={`${styles.cell} ${active ? styles.active : ""}`}
              tabIndex={0}
              aria-labelledby={labelId}
              onPointerEnter={(event) => {
                pointerTypeRef.current = event.pointerType;
                if (event.pointerType === "mouse") setActiveIndex(index);
              }}
              onPointerLeave={() => {
                if (pointerTypeRef.current === "mouse") release(index);
              }}
              onFocus={() => setFocusIndex(index)}
              onBlur={() => setFocusIndex((current) => (current === index ? null : current))}
              onPointerDown={(event) => {
                pointerTypeRef.current = event.pointerType;
                if (event.pointerType === "mouse") {
                  setActiveIndex(index);
                  return;
                }
                setActiveIndex((current) => (current === index ? null : index));
              }}
            >
              <div className={styles.backdrop} aria-hidden="true">
                <LiquidCanvas palette={cell.palette} active={active} />
              </div>
              <div className={styles.content}>
                <p id={labelId} className={`${styles.label} label-caps`}>
                  {cell.label}
                </p>
                <p className={styles.value}>
                  <Count value={cell.value} />
                  {cell.of !== undefined && <span className={styles.suffix}>of {cell.of}</span>}
                </p>
                <p className={styles.note}>{cell.note}</p>
              </div>
            </article>
          );
        })}
      </motion.div>
    </section>
  );
}
