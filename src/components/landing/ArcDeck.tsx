"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./arcdeck.module.css";

type Theme = "ink" | "paper" | "signal";
type Art = "count" | "process" | "portal" | "pulse" | "statement" | "brief" | "orbit";

interface CardData {
  theme: Theme;
  type: Art;
  kicker: string;
  title: string;
}

/** The seven steps from a sentence to a sequenced, adaptive plan. */
const CARDS: CardData[] = [
  { theme: "signal", type: "count", kicker: "HOW IT WORKS · 2026", title: "Seven steps" },
  { theme: "ink", type: "process", kicker: "STEP / 01", title: "Say your goal" },
  { theme: "paper", type: "portal", kicker: "STEP / 02", title: "Map the gap" },
  { theme: "ink", type: "pulse", kicker: "STEP / 03", title: "Score it all" },
  { theme: "signal", type: "statement", kicker: "STEP / 04", title: "Fewest steps" },
  { theme: "paper", type: "brief", kicker: "STEP / 05", title: "Explain picks" },
  { theme: "ink", type: "orbit", kicker: "STEP / 06", title: "Adapt on feedback" },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CardArt({ card }: { card: CardData }) {
  switch (card.type) {
    case "count":
      return (
        <>
          <div className={styles.micro}>
            FROM ONE SENTENCE TO A<br />SEQUENCED, EVIDENCED PLAN
          </div>
          <strong className={styles.giant}>7</strong>
          <i className={styles.rule} />
        </>
      );
    case "process":
      return (
        <>
          <div className={styles.steps}>
            <span>1</span>GOAL<br />
            <span>2</span>LEVEL<br />
            <span>3</span>TIME<br />
            <span>4</span>STYLE
          </div>
          <div className={styles.bars}>
            <i />
            <i />
            <i />
            <i />
          </div>
        </>
      );
    case "portal":
      return (
        <>
          <div className={styles.rows}>
            <p>
              THE GAP <b>159 SKILLS</b>
            </p>
            <p>
              THE TARGET <b>LEVEL 0 → 3</b>
            </p>
          </div>
          <div className={styles.portalArt}>
            <i />
            <b>+</b>
          </div>
        </>
      );
    case "pulse":
      return (
        <>
          <div className={styles.metrics}>
            <b>246</b>
            <b>0.82</b>
            <b>04</b>
          </div>
          <div className={styles.portrait}>
            <i />
          </div>
          <div className={styles.swatches}>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className={styles.cities}>
            FOUR SIGNALS
            <br />
            RELEVANCE
            <br />
            LEVEL FIT
            <br />
            TIME &amp; STYLE
          </div>
        </>
      );
    case "statement":
      return (
        <>
          <div className={styles.edgeNote}>
            SET-COVER, THEN
            <br />
            PREREQUISITE ORDER
          </div>
          <div className={styles.word}>sequence</div>
        </>
      );
    case "brief":
      return (
        <>
          <div className={styles.briefNo}>why?</div>
          <div className={styles.columns}>
            <p>
              EVIDENCE
              <br />
              <b>SCORE BARS</b>
            </p>
            <p>
              NARRATION
              <br />
              <b>NOVA EXPLAINS</b>
            </p>
            <p>
              ONE CLICK
              <br />
              <b>“WHY THIS?”</b>
            </p>
          </div>
        </>
      );
    default:
      return (
        <>
          <div className={styles.orbitArt}>
            <i />
            <i />
            <i />
            <b />
          </div>
          <div className={styles.route}>DONE&nbsp;&nbsp;—&nbsp;&nbsp;TOO HARD&nbsp;&nbsp;—&nbsp;&nbsp;TOO EASY&nbsp;&nbsp;—&nbsp;&nbsp;REPLAN</div>
        </>
      );
  }
}

function ArcCard({
  card,
  index,
  slot,
  width,
  motion,
  isHovered,
  onHoverChange,
  onChoose,
}: {
  card: CardData;
  index: number;
  slot: number;
  width: number;
  motion: number;
  isHovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  onChoose: () => void;
}) {
  // Every card sits on one shared circle; no card animates independently.
  const theta = ((-20 + slot * 10.5) * Math.PI) / 180;
  const radius = width * 1.868;
  const centerX = -width * 1.322;
  const centerY = width * 0.812;
  const x = centerX + radius * Math.cos(theta);
  const y = centerY + radius * Math.sin(theta);
  const edge = Math.max(0, Math.abs(slot - 2) - 3.15);
  const visible = slot > -2.2 && slot < 6.2;

  const side = clamp(Math.abs(slot - 2) / 2.6, 0, 1);
  const travel = clamp(motion, -1, 1);
  const travelStrength = Math.abs(travel) * (0.34 + side * 0.66);
  const slipX = travel * width * 0.009 * side;
  const peelY = -travelStrength * width * 0.014;
  const counterRotation = travel * (slot < 2 ? -1 : 1) * (0.7 + side * 1.8);
  const travelScale = 1 + travelStrength * 0.012;

  return (
    <article
      className={`${styles.card} ${styles[card.theme]}`}
      aria-label={card.title}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onClick={onChoose}
      style={{
        opacity: visible ? clamp(1 - edge * 0.52, 0, 1) : 0,
        filter: `blur(${edge * (2.5 + Math.abs(travel) * 1.4)}px)`,
        pointerEvents: visible ? "auto" : "none",
        zIndex: isHovered ? 1000 : Math.round((slot + 3) * 10),
        transform: `translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${theta}rad)`,
      }}
    >
      <div
        className={styles.cardMotion}
        style={{
          transform: `translate3d(${slipX}px,${peelY}px,0) rotate(${counterRotation}deg) scale(${travelScale})`,
        }}
      >
        <div className={styles.cardSurface}>
          <header>
            <span>{card.kicker}</span>
            <span>{String(index + 1).padStart(2, "0")} / {String(CARDS.length).padStart(2, "0")}</span>
          </header>
          <h3>{card.title}</h3>
          <CardArt card={card} />
        </div>
      </div>
    </article>
  );
}

export function ArcDeck({ id }: { id?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const value = useRef(-1);
  const target = useRef(-1);
  const velocity = useRef(0);
  const visualMotion = useRef(0);
  const lastFrameValue = useRef(-1);
  const manual = useRef(false);
  const dragging = useRef(false);
  const dragged = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  const [position, setPosition] = useState(-1);
  const [motion, setMotion] = useState(0);
  const [stageWidth, setStageWidth] = useState(234);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => setStageWidth(stageRef.current?.clientWidth || 234);
    measure();
    const observer = new ResizeObserver(measure);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      if (!manual.current) {
        const time = ((now - started) % 5300) / 1000;
        let next = -1;
        if (time < 2.1) next = -1 + easeInOutCubic(time / 2.1);
        else if (time < 3.72) next = 0;
        else next = -easeInOutCubic((time - 3.72) / 1.58);
        value.current = next;
      } else if (!dragging.current) {
        const delta = target.current - value.current;
        velocity.current = (velocity.current + delta * 0.105) * 0.72;
        value.current += velocity.current;
        if (Math.abs(delta) < 0.0005 && Math.abs(velocity.current) < 0.0005) {
          value.current = target.current;
          velocity.current = 0;
        }
        if (Math.abs(value.current) > CARDS.length) {
          const cycle = Math.round(value.current / CARDS.length) * CARDS.length;
          value.current -= cycle;
          target.current -= cycle;
        }
      }

      let frameDelta = value.current - lastFrameValue.current;
      frameDelta -= Math.round(frameDelta / CARDS.length) * CARDS.length;
      lastFrameValue.current = value.current;
      const requestedMotion = clamp(frameDelta * 28, -1, 1);
      const motionResponse = Math.abs(requestedMotion) > Math.abs(visualMotion.current) ? 0.38 : 0.115;
      visualMotion.current += (requestedMotion - visualMotion.current) * motionResponse;
      if (Math.abs(visualMotion.current) < 0.0005) visualMotion.current = 0;
      setPosition(value.current);
      setMotion(visualMotion.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const takeControl = useCallback(() => {
    manual.current = true;
    target.current = value.current;
  }, []);

  const moveOne = useCallback(
    (direction: number) => {
      takeControl();
      target.current = Math.round(target.current) + direction;
    },
    [takeControl],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    takeControl();
    dragging.current = true;
    dragged.current = false;
    startY.current = event.clientY;
    startValue.current = value.current;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = event.clientY - startY.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    value.current = startValue.current + delta / (stageWidth * 0.34);
    target.current = value.current;
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    target.current = Math.round(value.current);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const logicalCards = Array.from({ length: 19 }, (_, index) => index - 7);

  return (
    <section id={id} className={styles.section} aria-label="How Pathwise works">
      <div className={styles.header}>
        <div>
          <p className={styles.label}>How it works</p>
          <h2 className={styles.title}>Drag the deck — from a sentence to a plan in six moves.</h2>
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.control} onClick={() => moveOne(1)} aria-label="Previous step">
            <ArrowLeft size={16} strokeWidth={1.8} />
          </button>
          <button type="button" className={styles.control} onClick={() => moveOne(-1)} aria-label="Next step">
            <ArrowRight size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {logicalCards.map((logical) => {
          const dataIndex = ((logical % CARDS.length) + CARDS.length) % CARDS.length;
          const slot = logical + position;
          return (
            <ArcCard
              key={logical}
              card={CARDS[dataIndex]}
              index={dataIndex}
              slot={slot}
              width={stageWidth}
              motion={motion}
              isHovered={hoveredCard === logical}
              onHoverChange={(hovered) => setHoveredCard(hovered ? logical : null)}
              onChoose={() => {
                if (!dragged.current) moveOne(2 - Math.round(slot));
              }}
            />
          );
        })}
      </div>
      <div className={styles.hint} aria-hidden>
        <span>DRAG</span>
        <i />
        <span>CLICK A CARD</span>
      </div>
    </section>
  );
}
