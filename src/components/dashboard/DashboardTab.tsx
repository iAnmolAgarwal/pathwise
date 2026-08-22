"use client";

import { ArrowRight, Award, Check, Flame, Lock, MessageSquare } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";

import { milestoneBadges, type DashboardSummary, type DifficultyBucket } from "@/engine/dashboard";
import { BadgeMedal } from "./BadgeMedal";
import { Badge } from "@/components/ui/badge";
import { Orb } from "@/components/ui/orb";
import { cn } from "@/lib/utils";

import styles from "./dashboard.module.css";

// Emphasis form: one hue for "you", the de-emphasis gray for "the goal" (validated on surface-1).
const VIZ = { known: "#8f7cff", required: "#6b6b70", grid: "rgba(255,255,255,0.09)", tick: "rgba(255,255,255,0.6)" };

type Props = {
  summary: DashboardSummary | null;
  /** The learner this dashboard belongs to (identity header). */
  displayName?: string;
  goalTitle?: string | null;
  onOpenItem?: (catalogId: string) => void;
  /** Switches to the Nova tab — the dashboard hides the chat column, so this is the one-click way back. */
  onAskNova?: () => void;
};

const ENTER = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const };
const BUCKETS: { key: DifficultyBucket; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

/**
 * Full-width dashboard (§9.3, M5.12 item 7): next action as the hero, items done as a ring with the
 * easy / medium / hard split beside it, milestone badges, a year of activity as a heatmap, the
 * phases as a horizontal strip, and skills by domain. Every figure comes from DashboardSummary,
 * which is computed from stored rows — nothing here is invented or filled in.
 */
export function DashboardTab({ summary, displayName, goalTitle, onOpenItem, onAskNova }: Props) {
  const reduce = useReducedMotion() ?? false;
  if (!summary) {
    return (
      <div className={styles.loading}>
        <Orb state="working" size={20} label="Computing your dashboard" />
        Computing your dashboard…
      </div>
    );
  }
  const { progress, radar, timeline, nextAction, streak, difficulty, activity } = summary;
  const milestones = milestoneBadges(timeline);
  const earnedList = summary.achievements.filter((a) => a.earned);
  const nextBadge = summary.achievements.find((a) => !a.earned) ?? null;
  const rise = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { ...ENTER, delay: reduce ? 0 : i * 0.06 },
  });

  return (
    <div className={styles.grid} data-testid="dashboard">
      {displayName && (
        <motion.header className={styles.identity} data-testid="identity" {...rise(0)}>
          <span className={styles.avatar} aria-hidden>
            {displayName
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("")}
          </span>
          <div className={styles.who}>
            <p className={styles.whoName}>{displayName}</p>
            <p className={styles.whoGoal}>{goalTitle ? `Becoming a ${goalTitle}` : "No goal yet"}</p>
          </div>
          <dl className={styles.whoStats}>
            <div>
              <dt>Items done</dt>
              <dd>{progress.itemsDone}</dd>
            </div>
            <div>
              <dt>Active days</dt>
              <dd>{activity.activeDays}</dd>
            </div>
            <div>
              <dt>Badges</dt>
              <dd>{earnedList.length}</dd>
            </div>
          </dl>
        </motion.header>
      )}

      {/* Hero: the next thing to do, with the done ring and the difficulty split beside it. */}
      <motion.section className={cn(styles.card, styles.hero)} data-testid="next-action" {...rise(0)}>
        <div className={styles.heroMain}>
          <p className={styles.label}>Next up</p>
          {nextAction.catalogId ? (
            <>
              <div className={styles.nextMeta}>
                {nextAction.kind && <Badge variant="kind">{nextAction.kind}</Badge>}
                {nextAction.hours ? <span className={styles.mono}>{nextAction.hours}h</span> : null}
                {nextAction.phase && <span className={styles.nextPhase}>{nextAction.phase}</span>}
              </div>
              <h3 className={styles.nextTitle}>{nextAction.title}</h3>
              <p className={styles.nextWhy}>{nextAction.why}</p>
            </>
          ) : (
            <p className={styles.nextWhy}>{nextAction.why}</p>
          )}
          <div className={styles.heroActions}>
            {nextAction.catalogId && onOpenItem && (
              <button type="button" className={styles.nextButton} onClick={() => onOpenItem(nextAction.catalogId!)}>
                Open on path <ArrowRight aria-hidden />
              </button>
            )}
            {onAskNova && (
              <button type="button" className={styles.ghostButton} onClick={onAskNova} data-testid="ask-nova">
                <MessageSquare aria-hidden /> Ask Nova
              </button>
            )}
          </div>
        </div>

        <div className={styles.heroStats}>
          <Ring done={progress.itemsDone} total={progress.itemsTotal} reduce={reduce} />
          <ul className={styles.buckets} aria-label="Items by difficulty" data-testid="difficulty-split">
            {BUCKETS.map((b) => (
              <li key={b.key} className={cn(styles.bucket, styles[`bucket_${b.key}`])} data-bucket={b.key}>
                <span className={styles.bucketLabel}>{b.label}</span>
                <span className={styles.bucketValue}>
                  {difficulty[b.key].done}
                  <span className={styles.bucketOf}>/{difficulty[b.key].total}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      {/* Badges: achievements derived from stored state, the next one to chase first; then one per completed phase. */}
      <motion.section className={cn(styles.card, styles.badges)} data-testid="badges" {...rise(1)}>
        <div className={styles.cardHead}>
          <div>
            <p className={styles.label}>Badges</p>
            <p className={styles.badgeCount}>
              {earnedList.length}
              <span className={styles.tileOf}> of {summary.achievements.length}</span>
            </p>
          </div>
        </div>
        {nextBadge && (
          <div className={styles.nextBadge} data-testid="next-badge">
            <BadgeMedal id={nextBadge.id} earned={false} title={nextBadge.name} size={40} />
            <div className={styles.nextBadgeText}>
              <p className={styles.nextBadgeName}>{nextBadge.name}</p>
              <p className={styles.nextBadgeHint}>Next up · {nextBadge.hint.toLowerCase()}</p>
            </div>
          </div>
        )}
        <ul className={styles.medals} aria-label="Achievements">
          {summary.achievements.map((a) => (
            <li key={a.id} className={cn(styles.medalItem, !a.earned && styles.medalItemLocked)} title={a.hint} data-earned={a.earned} data-badge={a.id}>
              <BadgeMedal id={a.id} earned={a.earned} title={a.name} />
              <span className={styles.medalName}>{a.name}</span>
            </li>
          ))}
        </ul>
        {milestones.length > 0 && (
          <ul className={styles.badgeList} aria-label="Phase milestones">
            {milestones.map((b, i) => (
              <li key={b.phase} className={cn(styles.badge, b.earned ? styles.badgeEarned : styles.badgeLocked)} data-earned={b.earned} title={b.milestone}>
                <span className={styles.badgeIcon} aria-hidden>
                  {b.earned ? <Award /> : <Lock />}
                  <span className={styles.badgeIndex}>{i + 1}</span>
                </span>
                <span className={styles.badgeText}>
                  <span className={styles.badgeName}>{b.milestone}</span>
                  <span className={styles.badgePhase}>{b.earned ? "Earned" : "Locked"} · {b.phase}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* Activity: a year of days, from stored feedback events and chat messages. */}
      <motion.section className={cn(styles.card, styles.activity)} data-testid="activity" {...rise(2)}>
        <div className={styles.cardHead}>
          <p className={styles.activityTitle}>
            <span className={styles.activityCount}>{activity.activeDays}</span> active {activity.activeDays === 1 ? "day" : "days"} in the past year
          </p>
          <div className={styles.streaks} data-testid="streak">
            <span>
              <span className={styles.streakLabel}>Current streak</span>
              <span className={cn(styles.streakValue, streak.current > 0 && styles.streakHot)}>
                {streak.current > 0 && <Flame aria-hidden className={styles.flame} />}
                {streak.current}
              </span>
            </span>
            <span>
              <span className={styles.streakLabel}>Longest</span>
              <span className={styles.streakValue}>{streak.longest}</span>
            </span>
          </div>
        </div>
        <Heatmap activity={activity} today={summary.today} />
      </motion.section>

      {/* Phases as a strip. */}
      <motion.section className={cn(styles.card, styles.phases)} data-testid="timeline" {...rise(3)}>
        <p className={styles.label}>Phases</p>
        {timeline.length === 0 ? (
          <p className={styles.empty}>No path yet.</p>
        ) : (
          <ol className={styles.strip}>
            {timeline.map((t, i) => (
              <li key={t.title} className={cn(styles.phase, t.complete && styles.phaseDone, t.active && styles.phaseActive)} data-complete={t.complete} data-active={t.active}>
                <span className={styles.phaseNode} aria-label={t.complete ? "complete" : t.active ? "current" : "upcoming"}>
                  {t.complete ? <Check aria-hidden /> : i + 1}
                </span>
                <p className={styles.phaseTitle}>{t.title}</p>
                <p className={styles.phaseMilestone}>{t.milestone}</p>
                <div className={styles.phaseBar} aria-hidden>
                  <span style={{ width: `${t.itemsTotal ? (t.itemsDone / t.itemsTotal) * 100 : 0}%` }} />
                </div>
                <p className={styles.phaseCount}>
                  {t.itemsDone}/{t.itemsTotal} done
                </p>
              </li>
            ))}
          </ol>
        )}
      </motion.section>

      {/* Skills by domain */}
      <motion.section className={cn(styles.card, styles.skills)} data-testid="skill-radar" {...rise(4)}>
        <header className={styles.cardHead}>
          <div>
            <p className={styles.label}>Skills</p>
            <p className={styles.cardHint}>
              {progress.attainedLevels} of {progress.requiredLevels} required levels ({progress.percent} %) — the outer ring is the goal, the filled shape is you.
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
    </div>
  );
}

/** Items done out of total as a ring; the number in the middle is the count, not a percentage. */
function Ring({ done, total, reduce }: { done: number; total: number; reduce: boolean }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const share = total ? done / total : 0;
  return (
    <div className={styles.ring} role="img" aria-label={`${done} of ${total} items done`} data-testid="tile-items">
      <svg viewBox="0 0 128 128" className={styles.ringSvg} aria-hidden>
        <circle cx="64" cy="64" r={R} className={styles.ringTrack} />
        <motion.circle
          cx="64"
          cy="64"
          r={R}
          className={styles.ringFill}
          strokeDasharray={C}
          initial={reduce ? false : { strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - share) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </svg>
      <div className={styles.ringText}>
        <span className={styles.ringValue}>{done}</span>
        <span className={styles.ringOf}>of {total}</span>
        <span className={styles.ringLabel}>items done</span>
      </div>
    </div>
  );
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Calendar heatmap of active days; an empty year is drawn empty and says so. */
function Heatmap({ activity, today }: { activity: DashboardSummary["activity"]; today: string }) {
  return (
    <div className={styles.heatWrap}>
      <div className={styles.heat} data-testid="activity-heatmap" data-empty={activity.activeDays === 0}>
        <div className={styles.heatMonths} aria-hidden>
          {activity.months.map((m) => (
            <span key={`${m.label}-${m.week}`} style={{ gridColumnStart: m.week + 1 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className={styles.heatGrid} aria-hidden>
          {activity.weeks.map((week, w) => (
            <div key={w} className={styles.heatWeek}>
              {week.map((cell) => (
                <span
                  key={cell.day}
                  className={cn(styles.heatCell, cell.active && styles.heatOn, cell.day === today && styles.heatToday)}
                  title={`${cell.day}${cell.active ? " · active" : ""}`}
                  data-day={cell.day}
                  data-active={cell.active}
                  style={{ gridRowStart: new Date(`${cell.day}T00:00:00Z`).getUTCDay() + 1 }}
                />
              ))}
            </div>
          ))}
        </div>
        <span className="sr-only">{DOW.join(", ")} rows, one column per week</span>
      </div>
      {activity.activeDays === 0 && (
        <p className={styles.heatEmpty} data-testid="activity-empty">
          No activity yet — marking an item done or talking to Nova lights up a day.
        </p>
      )}
    </div>
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
