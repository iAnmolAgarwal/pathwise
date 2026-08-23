"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./arcdeck.module.css";
import { useInView } from "./useInView";

type Theme = "ink" | "paper" | "signal";
type Art =
  "count" | "process" | "portal" | "pulse" | "statement" | "brief" | "orbit";

interface CardData {
  theme: Theme;
  type: Art;
  kicker: string;
  title: string;
  /** One line that stays readable even when the next card overlaps this one. */
  sub: string;
}

/** A cover card plus the six steps from a sentence to a sequenced, adaptive plan. */
const CARDS: CardData[] = [
  {
    theme: "signal",
    type: "count",
    kicker: "OVERVIEW",
    title: "Six steps",
    sub: "How one prompt becomes an ordered plan",
  },
  {
    theme: "ink",
    type: "process",
    kicker: "STEP / 01",
    title: "Say your goal",
    sub: "The role you want, what you already know, and your hours a week.",
  },
  {
    theme: "paper",
    type: "portal",
    kicker: "STEP / 02",
    title: "Find what's missing",
    sub: "What the role needs, minus what you have, plus what those need first.",
  },
  {
    theme: "ink",
    type: "pulse",
    kicker: "STEP / 03",
    title: "Score every course",
    sub: "Five checks: gap closed, level fit, your preferences, quality, match to your goal.",
  },
  {
    theme: "signal",
    type: "brief",
    kicker: "STEP / 04",
    title: "Pick the fewest",
    sub: "The smallest set of courses that closes the gap inside your hours.",
  },
  {
    theme: "paper",
    type: "statement",
    kicker: "STEP / 05",
    title: "Put them in order",
    sub: "A topological sort over the prerequisites, then checked against real learners.",
  },
  {
    theme: "ink",
    type: "orbit",
    kicker: "STEP / 06",
    title: "Change it when you push back",
    sub: "Done, too hard, too easy. The plan is rebuilt and you see what changed and why.",
  },
];

const STEPS = CARDS.length - 1;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const r3 = (n: number) => Math.round(n * 1000) / 1000;
/** Card 01's example answers, in the same chip form the chat's profile drawer uses. */
const INTAKE = [
  { label: "GOAL", value: "Cloud Engineer" },
  { label: "LEVEL", value: "Python · comfortable" },
  { label: "TIME", value: "6 h / week" },
  { label: "STYLE", value: "videos · projects" },
];

/** Card 03's example breakdown, the same five components the explain panel shows for every pick. */
const SCORE_ROWS: { label: string; value: number; total?: boolean }[][] = [
  [
    { label: "Coverage", value: 0.04 },
    { label: "Level fit", value: 1 },
  ],
  [
    { label: "Preference fit", value: 1 },
    { label: "Quality", value: 0.7 },
  ],
  [{ label: "Similarity", value: 0.31 }],
  [{ label: "Total", value: 0.45, total: true }],
];

/** Card 05's mini skill graph: a slice of the real map in the Path tab's node style, prerequisites on top. */
const DAG = {
  nodes: [
    { label: "Programming", level: "L3", x: 96, y: 4 },
    { label: "Shell", level: "L3", x: 174, y: 4 },
    { label: "Python", level: "L3", x: 18, y: 48 },
    { label: "Networking", level: "L2", x: 96, y: 48 },
    { label: "Linux", level: "L3", x: 174, y: 48 },
    { label: "Git", level: "L3", x: 252, y: 48 },
    { label: "SQL", level: "L2", x: 18, y: 92 },
    { label: "Cloud", level: "L3", x: 96, y: 92 },
    { label: "DevOps", level: "L3", x: 174, y: 92 },
    { label: "Security", level: "L2", x: 252, y: 92 },
  ],
  edges: [
    [0, 2],
    [0, 3],
    [1, 4],
    [1, 5],
    [2, 6],
    [3, 7],
    [4, 8],
    [5, 8],
    [3, 9],
  ] as [number, number][],
};

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function CardArt({ card }: { card: CardData }) {
  switch (card.type) {
    case "count":
      return (
        <>
          <div className={styles.micro}>
            A DETERMINISTIC ENGINE PICKS THE ORDER.
            <br />
            THE AI ONLY EXPLAINS IT.
          </div>
          <strong className={styles.giant}>{STEPS}</strong>
          <i className={styles.rule} />
        </>
      );
    case "process":
      return (
        <>
          <div className={styles.intake}>
            {INTAKE.map((row, index) => (
              <p key={row.label}>
                <span>{index + 1}</span>
                <b>{row.label}</b>
                <em>{row.value}</em>
              </p>
            ))}
          </div>
        </>
      );
    case "portal":
      return (
        <>
          <svg className={styles.radar} viewBox="0 0 100 100" aria-hidden>
            <polygon
              className={styles.radarGrid}
              points="50,6 88,28 88,72 50,94 12,72 12,28"
            />
            <polygon
              className={styles.radarGrid}
              points="50,28 69,39 69,61 50,72 31,61 31,39"
            />
            <polygon
              className={styles.radarRequired}
              points="50,10 84,30 82,70 50,90 16,68 18,32"
            />
            <polygon
              className={styles.radarKnown}
              points="50,34 64,42 62,60 50,64 36,58 38,42"
            />
            <text className={styles.radarLabel} x="50" y="4" textAnchor="middle">
              REQUIRED
            </text>
            <text className={styles.radarLabel} x="50" y="51" textAnchor="middle">
              KNOWN
            </text>
          </svg>
        </>
      );
    case "pulse":
      return (
        <div className={styles.score}>
          {SCORE_ROWS.map((pair, index) => (
            <p key={index}>
              {pair.map((row) => (
                <span
                  key={row.label}
                  className={row.total ? styles.scoreTotal : undefined}
                >
                  <b>{row.label}</b>
                  <i
                    style={
                      { "--w": `${row.value * 100}%` } as React.CSSProperties
                    }
                  />
                  <em>{row.value.toFixed(2)}</em>
                </span>
              ))}
            </p>
          ))}
        </div>
      );
    case "statement":
      return (
        <>
          <svg className={styles.dag} viewBox="0 0 332 118" aria-hidden>
            <defs>
              <marker
                id="dagArrow"
                markerWidth="4"
                markerHeight="4"
                refX="3"
                refY="2"
                orient="auto"
              >
                <path d="M0 0 L4 2 L0 4 z" fill="rgb(0 0 0 / 42%)" />
              </marker>
            </defs>
            {DAG.edges.map(([from, to]) => {
              const a = DAG.nodes[from];
              const b = DAG.nodes[to];
              return (
                <path
                  key={`${from}-${to}`}
                  className={styles.dagEdge}
                  markerEnd="url(#dagArrow)"
                  d={`M ${a.x + 38} ${a.y + 20} C ${a.x + 38} ${a.y + 32}, ${b.x + 38} ${b.y - 12}, ${b.x + 38} ${b.y - 2}`}
                />
              );
            })}
            {DAG.nodes.map((node) => (
              <g key={node.label} transform={`translate(${node.x} ${node.y})`}>
                <rect
                  className={styles.dagNode}
                  width="76"
                  height="20"
                  rx="10"
                />
                <circle className={styles.dagTick} cx="10" cy="10" r="3.5" />
                <text className={styles.dagLabel} x="17" y="13.5">
                  {node.label}
                </text>
                <text className={styles.dagLevel} x="70" y="13.5">
                  {node.level}
                </text>
              </g>
            ))}
          </svg>
        </>
      );
    case "brief":
      return (
        <>
          <div className={styles.columns}>
            <p>
              EACH PICK
              <br />
              <b>MOST GAP PER HOUR</b>
            </p>
            <p>
              STOPS WHEN
              <br />
              <b>THE GAP IS CLOSED</b>
            </p>
            <p>
              OR WHEN
              <br />
              <b>YOUR HOURS RUN OUT</b>
            </p>
          </div>
        </>
      );
    default:
      return (
        <div className={styles.diff}>
          <p>
            <b>YOU SAID</b>
            <strong>too hard</strong>
          </p>
          <p>
            <b>SWAPPED</b>
            <em>
              <s>Confluent Kafka Tutorials</s>
            </em>
          </p>
          <p>
            <b>FOR</b>
            <em>Confluent Developer Kafka Courses</em>
          </p>
        </div>
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
  hiddenCopy,
  onHoverChange,
  onChoose,
}: {
  card: CardData;
  index: number;
  /** Looped duplicate — hidden from assistive tech so the deck reads as one set. */
  hiddenCopy: boolean;
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
      aria-hidden={hiddenCopy}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onClick={onChoose}
      style={{
        // Rounded so server and client serialise the same strings (the CSSOM trims long floats).
        opacity: visible ? r3(clamp(1 - edge * 0.52, 0, 1)) : 0,
        filter: `blur(${r3(edge * (2.5 + Math.abs(travel) * 1.4))}px)`,
        pointerEvents: visible ? "auto" : "none",
        zIndex: isHovered ? 1000 : Math.round((slot + 3) * 10),
        transform: `translate3d(${r3(x)}px,${r3(y)}px,0) translate(-50%,-50%) rotate(${r3(theta)}rad)`,
      }}
    >
      <div
        className={styles.cardMotion}
        style={{
          transform: `translate3d(${r3(slipX)}px,${r3(peelY)}px,0) rotate(${r3(counterRotation)}deg) scale(${r3(travelScale)})`,
        }}
      >
        <div className={styles.cardSurface}>
          <header>
            <span>{card.kicker}</span>
            <span>
              {index === 0
                ? "INTRO"
                : `${String(index).padStart(2, "0")} / ${String(STEPS).padStart(2, "0")}`}
            </span>
          </header>
          <h3>{card.title}</h3>
          <p className={styles.sub}>{card.sub}</p>
          <CardArt card={card} />
        </div>
      </div>
    </article>
  );
}

export function ArcDeck({ id }: { id?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef);
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
    if (!inView) return;
    let frame = 0;
    const started = performance.now() - (lastFrameValue.current + 1) * 2100;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      if (!manual.current) {
        const time = reduced ? 0 : ((now - started) % 5300) / 1000;
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
      const motionResponse =
        Math.abs(requestedMotion) > Math.abs(visualMotion.current)
          ? 0.38
          : 0.115;
      visualMotion.current +=
        (requestedMotion - visualMotion.current) * motionResponse;
      if (Math.abs(visualMotion.current) < 0.0005) visualMotion.current = 0;
      if (frameDelta !== 0 || visualMotion.current !== 0) {
        setPosition(value.current);
        setMotion(visualMotion.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView]);

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
    <section
      ref={sectionRef}
      id={id}
      className={styles.section}
      aria-label="How Pathwise works"
    >
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            From your goal to your first course, in six steps.
          </h2>
        </div>
        <div className={styles.controls}>
          <span className={styles.hint} aria-hidden>
            <span className={styles.dragWord}>DRAG</span>
            <i />
            <span>CLICK A CARD</span>
          </span>
          <button
            type="button"
            className={styles.control}
            onClick={() => moveOne(1)}
            aria-label="Previous step"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={() => moveOne(-1)}
            aria-label="Next step"
          >
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
          const dataIndex =
            ((logical % CARDS.length) + CARDS.length) % CARDS.length;
          const slot = logical + position;
          return (
            <ArcCard
              key={logical}
              card={CARDS[dataIndex]}
              index={dataIndex}
              hiddenCopy={logical < 0 || logical >= CARDS.length}
              slot={slot}
              width={stageWidth}
              motion={motion}
              isHovered={hoveredCard === logical}
              onHoverChange={(hovered) =>
                setHoveredCard(hovered ? logical : null)
              }
              onChoose={() => {
                if (!dragged.current) moveOne(2 - Math.round(slot));
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
