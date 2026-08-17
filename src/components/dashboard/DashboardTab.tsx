"use client";

import { ArrowRight, Check, Flame } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";

import type { DashboardSummary } from "@/engine/dashboard";
import { Badge } from "@/components/ui/badge";
import { Orb } from "@/components/ui/orb";
import { cn } from "@/lib/utils";

import styles from "./dashboard.module.css";

// Emphasis form: one hue for "you", the de-emphasis gray for "the goal" (validated on surface-1).
const VIZ = { known: "#8f7cff", required: "#6b6b70", grid: "rgba(255,255,255,0.09)", tick: "rgba(255,255,255,0.6)" };

type Props = {
  summary: DashboardSummary | null;
  onOpenItem?: (catalogId: string) => void;
};

const ENTER = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const };

/** Dashboard tab (§9.3): hero progress, stat tiles, radar, timeline, streak, next-best-action — all engine-computed. */
export function DashboardTab({ summary, onOpenItem }: Props) {
  const reduce = useReducedMotion() ?? false;
  if (!summary) {
    return (
      <div className={styles.loading}>
        <Orb state="working" size={20} label="Computing your dashboard" />
        Computing your dashboard…
      </div>
    );
  }
  const { progress, radar, timeline, nextAction, streak } = summary;
  const skillsKnown = radar.reduce((n, r) => n + r.known, 0);
  const skillsRequired = radar.reduce((n, r) => n + r.required, 0);
  const rise = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { ...ENTER, delay: reduce ? 0 : i * 0.06 },
  });

  return (
    <div className={styles.grid} data-testid="dashboard">
      {/* Hero: the one number the view leads with. */}
      <motion.section className={cn(styles.card, styles.hero)} {...rise(0)}>
        <div className={styles.heroText}>
          <p className={styles.label}>Progress toward your goal</p>
          <p className={styles.heroValue} data-testid="progress-percent">
            {progress.percent}
            <span className={styles.heroUnit}>%</span>
          </p>
          <p className={styles.heroSub}>
            {progress.attainedLevels} of {progress.requiredLevels} required skill levels reached
          </p>
        </div>
        <div className={styles.meter} role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress toward your goal">
          <motion.span className={styles.meterFill} initial={reduce ? false : { width: 0 }} animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} />
        </div>
      </motion.section>

      {/* KPI row */}
      <motion.ul className={styles.tiles} aria-label="Key figures" {...rise(1)}>
        <Tile label="Items done" value={progress.itemsDone} of={progress.itemsTotal} testId="tile-items" />
        <Tile label="Skill levels" value={progress.attainedLevels} of={progress.requiredLevels} />
        <Tile label="Domains touched" value={radar.filter((r) => r.known > 0).length} of={radar.length} />
        <li className={cn(styles.tile, streak.current > 0 && styles.tileHot)} data-testid="streak">
          <p className={styles.label}>Streak</p>
          <p className={styles.tileValue}>
            {streak.current > 0 && <Flame className={styles.flame} aria-hidden />}
            {streak.current}
            <span className={styles.tileOf}> {streak.current === 1 ? "day" : "days"} · best {streak.longest}</span>
          </p>
          <StreakDots activeDays={streak.activeDays} today={summary.today} />
        </li>
      </motion.ul>

      {/* Radar */}
      <motion.section className={styles.card} data-testid="skill-radar" {...rise(2)}>
        <header className={styles.cardHead}>
          <div>
            <p className={styles.label}>Skills by domain</p>
            <p className={styles.cardHint}>
              {skillsKnown} of {skillsRequired} required levels — the outer ring is the goal, the filled shape is you.
            </p>
          </div>
          <ul className={styles.legend} aria-label="Legend">
            <li>
              <i style={{ background: VIZ.known }} /> You
            </li>
            <li>
              <i style={{ borderColor: VIZ.required }} className={styles.legendRing} /> Goal
            </li>
          </ul>
        </header>
        {radar.length === 0 ? (
          <p className={styles.empty}>Add a goal to see which domains it needs.</p>
        ) : radar.length < 3 ? (
          <DomainBars radar={radar} />
        ) : (
          <div className={styles.radar}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar.map((r) => ({ ...r, requiredPct: 100, knownPct: Math.round((r.known / r.required) * 100) }))} outerRadius="66%">
                <PolarGrid stroke={VIZ.grid} />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: VIZ.tick, fontFamily: "inherit" }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Goal" dataKey="requiredPct" stroke={VIZ.required} fill={VIZ.required} fillOpacity={0.06} strokeWidth={1.5} strokeDasharray="4 4" isAnimationActive={!reduce} />
                <Radar name="You" dataKey="knownPct" stroke={VIZ.known} fill={VIZ.known} fillOpacity={0.28} strokeWidth={2} dot={{ r: 3, fill: VIZ.known, strokeWidth: 0 }} isAnimationActive={!reduce} />
                <Tooltip
                  cursor={false}
                  contentStyle={{ background: "rgb(8 8 10 / 88%)", border: "1px solid rgb(255 255 255 / 18%)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#f5f5f7", backdropFilter: "blur(14px)" }}
                  itemStyle={{ color: "#f5f5f7" }}
                  labelStyle={{ color: "rgb(255 255 255 / 60%)", marginBottom: 4 }}
                  formatter={(value, name, entry) => {
                    const r = entry.payload as { known: number; required: number };
                    return [name === "You" ? `${value}% (${r.known} of ${r.required} levels)` : `${r.required} levels`, name];
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
        {radar.length > 0 && (
          <details className={styles.table}>
            <summary>Table view</summary>
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>You</th>
                  <th>Goal</th>
                </tr>
              </thead>
              <tbody>
                {radar.map((r) => (
                  <tr key={r.domain}>
                    <td>{r.label}</td>
                    <td>{r.known}</td>
                    <td>{r.required}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </motion.section>

      {/* Next best action */}
      <motion.section className={cn(styles.card, styles.next)} data-testid="next-action" {...rise(3)}>
        <p className={styles.label}>Next best action</p>
        {nextAction.catalogId ? (
          <>
            <div className={styles.nextMeta}>
              {nextAction.kind && <Badge variant="kind">{nextAction.kind}</Badge>}
              {nextAction.hours ? <span className={styles.mono}>{nextAction.hours}h</span> : null}
              {nextAction.phase && <span className={styles.nextPhase}>{nextAction.phase}</span>}
            </div>
            <h3 className={styles.nextTitle}>{nextAction.title}</h3>
            <p className={styles.nextWhy}>{nextAction.why}</p>
            {onOpenItem && (
              <button type="button" className={styles.nextButton} onClick={() => onOpenItem(nextAction.catalogId!)}>
                Open on path <ArrowRight aria-hidden />
              </button>
            )}
          </>
        ) : (
          <p className={styles.nextWhy}>{nextAction.why}</p>
        )}
      </motion.section>

      {/* Timeline */}
      <motion.section className={cn(styles.card, styles.timelineCard)} data-testid="timeline" {...rise(4)}>
        <p className={styles.label}>Path timeline</p>
        {timeline.length === 0 ? (
          <p className={styles.empty}>No path yet.</p>
        ) : (
          <ol className={styles.timeline}>
            {timeline.map((t, i) => (
              <li key={t.title} className={cn(styles.step, t.complete && styles.stepDone, t.active && styles.stepActive)} data-complete={t.complete} data-active={t.active}>
                <div className={styles.stepRail}>
                  <span className={styles.stepNode} aria-label={t.complete ? "complete" : t.active ? "current" : "upcoming"}>
                    {t.complete ? <Check aria-hidden /> : <span>{i + 1}</span>}
                  </span>
                  {i < timeline.length - 1 && <span className={styles.stepLine} aria-hidden />}
                </div>
                <p className={styles.stepTitle}>{t.title}</p>
                <p className={styles.stepMilestone}>{t.milestone}</p>
                <div className={styles.stepBar} aria-hidden>
                  <span style={{ width: `${t.itemsTotal ? (t.itemsDone / t.itemsTotal) * 100 : 0}%` }} />
                </div>
                <p className={styles.stepCount}>
                  {t.itemsDone}/{t.itemsTotal} done
                </p>
              </li>
            ))}
          </ol>
        )}
      </motion.section>
    </div>
  );
}

function Tile({ label, value, of, testId }: { label: string; value: number; of: number; testId?: string }) {
  return (
    <li className={styles.tile} data-testid={testId}>
      <p className={styles.label}>{label}</p>
      <p className={styles.tileValue}>
        {value}
        <span className={styles.tileOf}> / {of}</span>
      </p>
      <div className={styles.tileBar} aria-hidden>
        <span style={{ width: `${of ? (value / of) * 100 : 0}%` }} />
      </div>
    </li>
  );
}

function DomainBars({ radar }: { radar: DashboardSummary["radar"] }) {
  const max = Math.max(...radar.map((r) => r.required));
  return (
    <div className={styles.bars}>
      {radar.map((r) => (
        <div key={r.domain} className={styles.barRow}>
          <p className={styles.barLabel}>{r.label}</p>
          <div className={styles.barTrack}>
            <span className={styles.barGoal} style={{ width: `${(r.required / max) * 100}%` }} />
            <span className={styles.barYou} style={{ width: `${(r.known / max) * 100}%` }} />
          </div>
          <p className={styles.barValue}>
            {r.known} / {r.required}
          </p>
        </div>
      ))}
    </div>
  );
}

function StreakDots({ activeDays, today }: { activeDays: string[]; today: string }) {
  const active = new Set(activeDays);
  const end = Date.parse(`${today}T00:00:00Z`);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(end - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    return { d, on: active.has(d) };
  });
  return (
    <div className={styles.dots} aria-label="Last fourteen days">
      {days.map(({ d, on }, i) => (
        <span key={d} title={d} className={cn(styles.dot, on && styles.dotOn, i === 13 && styles.dotToday)} />
      ))}
    </div>
  );
}
