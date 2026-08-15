"use client";

import { BarChart3, BookOpen, GitBranch, MessageSquare, Route, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

import { Badge } from "@/components/ui/badge";
import { Orb } from "@/components/ui/orb";

import styles from "./beams.module.css";
import { useInView } from "./useInView";

interface AnimatedBeamProps {
  containerRef: RefObject<HTMLDivElement | null>;
  fromRef: RefObject<HTMLDivElement | null>;
  toRef: RefObject<HTMLDivElement | null>;
  curvature?: number;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  endYOffset?: number;
  active?: boolean;
}

function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 4.5,
  delay = 0,
  gradientStartColor = "#ff9d3d",
  gradientStopColor = "#8b5cff",
  endYOffset = 0,
  active = true,
}: AnimatedBeamProps) {
  const gradientId = useId().replace(/:/g, "");
  const [path, setPath] = useState("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updatePath = () => {
      const container = containerRef.current;
      const from = fromRef.current;
      const to = toRef.current;
      if (!container || !from || !to) return;
      const c = container.getBoundingClientRect();
      const f = from.getBoundingClientRect();
      const t = to.getBoundingClientRect();
      const startX = f.left - c.left + f.width / 2;
      const startY = f.top - c.top + f.height / 2;
      const endX = t.left - c.left + t.width / 2;
      const endY = t.top - c.top + t.height / 2 + endYOffset;
      setDimensions({ width: c.width, height: c.height });
      setPath(`M ${startX},${startY} Q ${(startX + endX) / 2},${startY - curvature} ${endX},${endY}`);
    };
    const observer = new ResizeObserver(updatePath);
    [containerRef.current, fromRef.current, toRef.current].forEach((el) => el && observer.observe(el));
    updatePath();
    window.addEventListener("resize", updatePath);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePath);
    };
  }, [containerRef, fromRef, toRef, curvature, endYOffset]);

  const coords = reverse
    ? { x1: ["110%", "-20%"], x2: ["120%", "-10%"] }
    : { x1: ["-20%", "110%"], x2: ["-10%", "120%"] };

  return (
    <svg
      aria-hidden
      className={styles.beam}
      width={dimensions.width}
      height={dimensions.height}
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      fill="none"
    >
      <path d={path} stroke="rgba(255,255,255,0.16)" strokeWidth={2} strokeLinecap="round" />
      <path d={path} stroke={`url(#${gradientId})`} strokeWidth={2.7} strokeLinecap="round" />
      <defs>
        <motion.linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
          animate={active ? { x1: coords.x1, x2: coords.x2, y1: ["0%", "0%"], y2: ["0%", "0%"] } : { x1: "0%", x2: "0%" }}
          transition={active ? { delay, duration, ease: "linear", repeat: Infinity } : { duration: 0 }}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop offset="28%" stopColor={gradientStartColor} stopOpacity="1" />
          <stop offset="55%" stopColor={gradientStopColor} stopOpacity="1" />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
}

const Node = forwardRef<HTMLDivElement, { icon: ReactNode; name: string; large?: boolean }>(
  ({ icon, name, large = false }, ref) => (
    <div className={styles.nodeWrap}>
      <motion.div
        ref={ref}
        className={`${styles.node} ${large ? styles.nodeLarge : ""}`}
        whileHover={{ scale: 1.09, y: -4 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
      >
        <span className={styles.shine} />
        <div className={styles.icon}>{icon}</div>
      </motion.div>
      <span className={styles.nodeName}>{name}</span>
    </div>
  ),
);
Node.displayName = "Node";

/** "Under the hood" — what flows into and out of the engine. */
export function BeamNetwork({ id }: { id?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef);
  const profileRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const stroke = 1.6;

  return (
    <section ref={sectionRef} id={id} className={styles.section} aria-labelledby="beams-title">
      <div className={styles.orb} aria-hidden />
      <header className={styles.header}>
        <Badge variant="eyebrow" dot>
          Under the hood
        </Badge>
        <h2 id="beams-title" className={styles.title}>
          Everything flows through <span>one deterministic engine.</span>
        </h2>
        <p className={styles.description}>
          Your profile, the 159-skill graph and a 246-item catalog go in; a sequenced path, live
          feedback and a progress dashboard come out. Nova narrates — the numbers come from the engine.
        </p>
      </header>

      <div ref={containerRef} className={styles.network}>
        <div className={`${styles.column} ${styles.left}`}>
          <Node ref={profileRef} name="Profile" icon={<UserRound strokeWidth={stroke} />} />
          <Node ref={graphRef} name="Skill graph" icon={<GitBranch strokeWidth={stroke} />} />
          <Node ref={catalogRef} name="Catalog" icon={<BookOpen strokeWidth={stroke} />} />
        </div>
        <div className={styles.center}>
          <Node ref={centerRef} name="Nova · engine" large icon={<Orb state="connecting" size={64} label="Engine" paused={!inView} />} />
        </div>
        <div className={`${styles.column} ${styles.right}`}>
          <Node ref={pathRef} name="Path" icon={<Route strokeWidth={stroke} />} />
          <Node ref={feedbackRef} name="Feedback" icon={<MessageSquare strokeWidth={stroke} />} />
          <Node ref={dashboardRef} name="Dashboard" icon={<BarChart3 strokeWidth={stroke} />} />
        </div>

        <AnimatedBeam active={inView} containerRef={containerRef} fromRef={profileRef} toRef={centerRef} curvature={-88} endYOffset={-8} duration={4.8} />
        <AnimatedBeam active={inView} containerRef={containerRef} fromRef={graphRef} toRef={centerRef} duration={4} delay={0.3} gradientStartColor="#ff8c42" gradientStopColor="#c05cff" />
        <AnimatedBeam active={inView} containerRef={containerRef} fromRef={catalogRef} toRef={centerRef} curvature={88} endYOffset={8} duration={5.2} delay={0.7} gradientStartColor="#3ee18e" gradientStopColor="#8868ff" />
        <AnimatedBeam active={inView} containerRef={containerRef} fromRef={pathRef} toRef={centerRef} curvature={-88} endYOffset={-8} reverse duration={5} delay={0.2} gradientStartColor="#4aa8ff" gradientStopColor="#a45cff" />
        <AnimatedBeam active={inView} containerRef={containerRef} fromRef={feedbackRef} toRef={centerRef} reverse duration={4.2} delay={0.5} gradientStartColor="#ff5a24" gradientStopColor="#bd5cff" />
        <AnimatedBeam active={inView} containerRef={containerRef} fromRef={dashboardRef} toRef={centerRef} curvature={88} endYOffset={8} reverse duration={5.4} delay={0.9} gradientStartColor="#ff5f87" gradientStopColor="#5d83ff" />
      </div>

      <div className={styles.status}>
        <span className={styles.statusLight} />
        Pure engine · 230 tests green · every score reproducible
      </div>
    </section>
  );
}
