"use client";

import {
  ArrowRight,
  Award,
  Calendar,
  Check,
  Clock,
  Flame,
  Gauge,
  Lock,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  milestoneBadges,
  type DashboardSummary,
  type DifficultyBucket,
} from "@/engine/dashboard";
import type { Profile } from "@/schemas";
import { BadgeMedal } from "./BadgeMedal";
import { Badge } from "@/components/ui/badge";
import { Orb } from "@/components/ui/orb";
import { cn } from "@/lib/utils";

import styles from "./dashboard.module.css";

// Emphasis form: one hue for "you", the de-emphasis gray for "the goal" (validated on surface-1).
const VIZ = {
  known: "#8f7cff",
  required: "#6b6b70",
  grid: "rgba(255,255,255,0.09)",
  tick: "rgba(255,255,255,0.6)",
};

type Props = {
  summary: DashboardSummary | null;
  /** The learner this dashboard belongs to (identity header). */
  displayName?: string;
  goalTitle?: string | null;
  /** ISO timestamp of the learner row, for the "Joined" line. */
  joinedAt?: string;
  /** Hours per week and pace, straight from the stored profile. */
  preferences?: Profile["preferences"];
  onOpenItem?: (catalogId: string) => void;
  /** Opens the profile drawer. */
  onEditProfile?: () => void;
  /** Switches to the Nova tab — the dashboard hides the chat column, so this is the one-click way back. */
  onAskNova?: () => void;
};

const ENTER = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const };
const GROW = { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const, delay: 0.2 };
const PACE_LABEL: Record<Profile["preferences"]["pace"], string> = {
  relaxed: "Relaxed",
  standard: "Standard",
  intense: "Intense",
};
const BUCKETS: { key: DifficultyBucket; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

/**
 * Full-width dashboard (§9.3, M5.12 item 7). A profile rail on the left (identity, badges, next
 * action) and a stats column on the right: items done as a ring with the easy / medium / hard
 * split, progress toward the goal as the hero figure, four tiles, a year of activity as a
 * heatmap, skills by domain and the phases as a vertical timeline. Every figure comes from
 * DashboardSummary, which is computed from stored rows — nothing here is invented or filled in.
 */
export function DashboardTab({
  summary,
  displayName,
  goalTitle,
  joinedAt,
  preferences,
  onOpenItem,
  onEditProfile,
  onAskNova,
}: Props) {
  const reduce = useReducedMotion() ?? false;
  if (!summary) {
    return (
      <div className={styles.loading}>
        <Orb state="working" size={20} label="Computing your dashboard" />
        Computing your dashboard…
      </div>
    );
  }
  const {
    progress,
    radar,
    timeline,
    nextAction,
    streak,
    difficulty,
    activity,
  } = summary;
  const milestones = milestoneBadges(timeline);
  const earnedList = summary.achievements.filter((a) => a.earned);
  const nextBadge = summary.achievements.find((a) => !a.earned) ?? null;
  const rise = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { ...ENTER, delay: reduce ? 0 : i * 0.06 },
  });

  const domainsTouched = radar.filter((r) => r.known > 0).length;
  const spark = lastDays(activity, 14);
  const initials = (displayName ?? "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className={styles.layout} data-testid="dashboard">
      {/* One grid: each rail card shares its row with the card beside it, so the two columns line up. */}
      {displayName && (
        <motion.section
          className={cn(styles.card, styles.identity)}
          data-testid="identity"
          {...rise(0)}
        >
          <div className={styles.who}>
            <span className={styles.avatar} aria-hidden>
              {initials}
            </span>
            <div className={styles.whoText}>
              <p className={styles.whoName}>{displayName}</p>
              <p className={styles.whoGoal}>
                {goalTitle ? `Becoming a ${goalTitle}` : "No goal yet"}
              </p>
            </div>
          </div>
          {onEditProfile && (
            <button
              type="button"
              className={styles.editButton}
              onClick={onEditProfile}
              data-testid="edit-profile"
            >
              <Pencil aria-hidden /> Edit profile
            </button>
          )}
          <dl className={styles.facts}>
            <div>
              <dt>
                <Clock aria-hidden /> Hours / week
              </dt>
              <dd>
                {preferences ? (
                  `${preferences.hoursPerWeek} h`
                ) : (
                  <em>Not set</em>
                )}
              </dd>
            </div>
            <div>
              <dt>
                <Gauge aria-hidden /> Pace
              </dt>
              <dd>
                {preferences ? PACE_LABEL[preferences.pace] : <em>Not set</em>}
              </dd>
            </div>
            <div>
              <dt>
                <Calendar aria-hidden /> Joined
              </dt>
              <dd>{joinedAt ? formatMonth(joinedAt) : <em>Not set</em>}</dd>
            </div>
          </dl>
        </motion.section>
      )}

      {/* Next action. */}
      <motion.section
        className={cn(styles.card, styles.next)}
        data-testid="next-action"
        {...rise(1)}
      >
        <p className={styles.label}>Next best action</p>
        {nextAction.catalogId ? (
          <>
            <div className={styles.nextMeta}>
              {nextAction.kind && (
                <Badge variant="kind">{nextAction.kind}</Badge>
              )}
              {nextAction.hours ? (
                <span className={styles.mono}>{nextAction.hours}h</span>
              ) : null}
              {nextAction.phase && (
                <span className={styles.nextPhase}>{nextAction.phase}</span>
              )}
            </div>
            <h3 className={styles.nextTitle}>{nextAction.title}</h3>
            <p className={styles.nextWhy}>{nextAction.why}</p>
          </>
        ) : (
          <p className={styles.nextWhy}>{nextAction.why}</p>
        )}
        <div className={styles.heroActions}>
          {nextAction.catalogId && onOpenItem && (
            <button
              type="button"
              className={styles.nextButton}
              onClick={() => onOpenItem(nextAction.catalogId!)}
            >
              Open on path <ArrowRight aria-hidden />
            </button>
          )}
          {onAskNova && (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={onAskNova}
              data-testid="ask-nova"
            >
              <MessageSquare aria-hidden /> Ask Nova
            </button>
          )}
        </div>
      </motion.section>
      {/* Badges: achievements derived from stored state, the next one to chase first; then one per completed phase. */}
      <motion.section
        className={cn(styles.card, styles.badges)}
        data-testid="badges"
        {...rise(2)}
      >
        <div className={styles.cardHead}>
          <p className={styles.label}>Badges</p>
          <p className={styles.count}>
            {earnedList.length}{" "}
            <span className={styles.countOf}>
              / {summary.achievements.length}
            </span>
          </p>
        </div>
        {nextBadge && (
          <div className={styles.nextBadge} data-testid="next-badge">
            <BadgeMedal
              id={nextBadge.id}
              earned={false}
              title={nextBadge.name}
              size={40}
            />
            <div className={styles.nextBadgeText}>
              <p className={styles.nextBadgeName}>{nextBadge.name}</p>
              <p className={styles.nextBadgeHint}>
                Next up · {nextBadge.hint.toLowerCase()}
              </p>
            </div>
          </div>
        )}
        <ul className={styles.medals} aria-label="Achievements">
          {summary.achievements
            .filter((a) => a.id !== nextBadge?.id)
            .map((a) => (
              <li
                key={a.id}
                className={cn(
                  styles.medalItem,
                  !a.earned && styles.medalItemLocked,
                )}
                title={a.hint}
                data-earned={a.earned}
                data-badge={a.id}
              >
                <BadgeMedal id={a.id} earned={a.earned} title={a.name} />
                <span className={styles.medalName}>{a.name}</span>
              </li>
            ))}
        </ul>
        {milestones.length > 0 && (
          <ul className={styles.badgeList} aria-label="Phase milestones">
            {milestones.map((b, i) => (
              <li
                key={b.phase}
                className={cn(
                  styles.badge,
                  b.earned ? styles.badgeEarned : styles.badgeLocked,
                )}
                data-earned={b.earned}
                title={b.milestone}
              >
                <span className={styles.badgeIcon} aria-hidden>
                  {b.earned ? <Award /> : <Lock />}
                  <span className={styles.badgeIndex}>{i + 1}</span>
                </span>
                <span className={styles.badgeText}>
                  <span className={styles.badgeName}>{b.milestone}</span>
                  <span className={styles.badgePhase}>
                    {b.earned ? "Earned" : "Locked"} · {b.phase}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* Items done as a ring, with the easy / medium / hard split as bars. */}
      <motion.section
        className={cn(styles.card, styles.difficultyCard)}
        data-testid="difficulty"
        {...rise(0)}
      >
        <div>
          <p className={styles.label}>Items by difficulty</p>
          <p className={styles.cardHint}>
            Bands come from each item&apos;s difficulty, counted against what
            your path holds.
          </p>
        </div>
        <div className={styles.difficultyBody}>
          <Ring
            done={progress.itemsDone}
            total={progress.itemsTotal}
            reduce={reduce}
          />
          <ul
            className={styles.buckets}
            aria-label="Items by difficulty"
            data-testid="difficulty-split"
          >
            {BUCKETS.map((b, i) => {
              const { done, total } = difficulty[b.key];
              return (
                <li
                  key={b.key}
                  className={cn(styles.bucket, styles[`bucket_${b.key}`])}
                  data-bucket={b.key}
                >
                  <span className={styles.bucketLabel}>{b.label}</span>
                  <span className={styles.bucketValue}>
                    {done}
                    <span className={styles.bucketOf}> / {total}</span>
                  </span>
                  <Meter
                    share={total ? done / total : 0}
                    reduce={reduce}
                    delay={0.2 + i * 0.08}
                    className={styles.bucketBar}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </motion.section>

      {/* Progress toward the goal: the hero figure. */}
      <motion.section
        className={cn(styles.card, styles.progress)}
        data-testid="progress"
        {...rise(1)}
      >
        <p className={styles.label}>Progress toward your goal</p>
        <p className={styles.progressValue}>
          {progress.percent}
          <span className={styles.progressUnit}>%</span>
        </p>
        <p className={styles.progressHint}>
          {progress.attainedLevels} of {progress.requiredLevels} required skill
          levels reached
        </p>
        <Meter
          share={progress.percent / 100}
          reduce={reduce}
          delay={0.25}
          className={styles.progressBar}
          label="Progress toward your goal"
          value={progress.percent}
        />
      </motion.section>

      {/* Four tiles. */}
      <div className={styles.tiles}>
        <Tile
          label="Items done"
          value={progress.itemsDone}
          of={progress.itemsTotal}
          i={2}
          reduce={reduce}
          testId="tile-items-done"
        />
        <Tile
          label="Skill levels"
          value={progress.attainedLevels}
          of={progress.requiredLevels}
          i={3}
          reduce={reduce}
          testId="tile-levels"
        />
        <Tile
          label="Domains"
          value={domainsTouched}
          of={radar.length}
          i={4}
          reduce={reduce}
          testId="tile-domains"
        />
        <motion.div
          className={cn(styles.card, styles.tile)}
          data-testid="streak"
          {...rise(5)}
        >
          <p className={styles.label}>Streak</p>
          <p className={styles.tileValue}>
            {streak.current > 0 && (
              <Flame aria-hidden className={styles.flame} />
            )}
            <span className={cn(streak.current > 0 && styles.streakHot)}>
              {streak.current}
            </span>
            <span className={styles.tileOf}>
              {" "}
              {streak.current === 1 ? "day" : "days"} · best {streak.longest}
            </span>
          </p>
          <ul className={styles.spark} aria-label="Last 14 days">
            {spark.map((d) => (
              <li
                key={d.day}
                className={cn(
                  styles.sparkDay,
                  d.active && styles.sparkOn,
                  d.day === summary.today && styles.sparkToday,
                )}
                title={d.day}
                data-active={d.active}
              />
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Activity: a year of days, from stored feedback events and chat messages. */}
      <motion.section
        className={cn(styles.card, styles.activity)}
        data-testid="activity"
        {...rise(3)}
      >
        <div className={styles.cardHead}>
          <div>
            <p className={styles.label}>Activity</p>
            <p className={styles.cardHint}>
              <span className={styles.activityCount}>
                {activity.activeDays}
              </span>{" "}
              active {activity.activeDays === 1 ? "day" : "days"} in the past
              year — marking an item or talking to Nova lights one up.
            </p>
          </div>
        </div>
        <Heatmap activity={activity} today={summary.today} />
      </motion.section>

      <div className={styles.bottom}>
        {/* Skills by domain */}
        <motion.section
          className={cn(styles.card, styles.skills)}
          data-testid="skill-radar"
          {...rise(4)}
        >
          <header className={styles.cardHead}>
            <div>
              <p className={styles.label}>Skills by domain</p>
              <p className={styles.cardHint}>
                Outer ring is the goal, filled shape is you.
              </p>
            </div>
          </header>
          {radar.length === 0 ? (
            <p className={styles.empty}>
              Add a goal to see which domains it needs.
            </p>
          ) : radar.length < 3 ? (
            <DomainBars radar={radar} />
          ) : (
            <div className={styles.radar}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={radar.map((r) => ({
                    ...r,
                    requiredPct: 100,
                    knownPct: r.required
                      ? Math.round((r.known / r.required) * 100)
                      : 0,
                  }))}
                  outerRadius="66%"
                >
                  <PolarGrid stroke={VIZ.grid} />
                  <PolarAngleAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: VIZ.tick,
                      fontFamily: "inherit",
                    }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Goal"
                    dataKey="requiredPct"
                    stroke={VIZ.required}
                    fill={VIZ.required}
                    fillOpacity={0.06}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    isAnimationActive={false}
                  />
                  <Radar
                    name="You"
                    dataKey="knownPct"
                    stroke={VIZ.known}
                    fill={VIZ.known}
                    fillOpacity={0.28}
                    strokeWidth={2}
                    dot={{ r: 3, fill: VIZ.known, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      background: "rgb(8 8 10 / 88%)",
                      border: "1px solid rgb(255 255 255 / 18%)",
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "#f5f5f7",
                      backdropFilter: "blur(14px)",
                    }}
                    itemStyle={{ color: "#f5f5f7" }}
                    labelStyle={{
                      color: "rgb(255 255 255 / 60%)",
                      marginBottom: 4,
                    }}
                    formatter={(value, name, entry) => {
                      const r = entry.payload as {
                        known: number;
                        required: number;
                      };
                      return [
                        name === "You"
                          ? `${value}% (${r.known} of ${r.required} levels)`
                          : `${r.required} levels`,
                        name,
                      ];
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className={styles.legend} aria-label="Legend">
            <li>
              <i style={{ background: VIZ.known }} /> You
            </li>
            <li>
              <i
                style={{ borderColor: VIZ.required }}
                className={styles.legendRing}
              />{" "}
              Goal
            </li>
          </ul>
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

        {/* Phases as a vertical timeline. */}
        <motion.section
          className={cn(styles.card, styles.phases)}
          data-testid="timeline"
          {...rise(5)}
        >
          <p className={styles.label}>Path timeline</p>
          {timeline.length === 0 ? (
            <p className={styles.empty}>No path yet.</p>
          ) : (
            <ol className={styles.timeline}>
              {timeline.map((t, i) => (
                <li
                  key={t.title}
                  className={cn(
                    styles.phase,
                    t.complete && styles.phaseDone,
                    t.active && styles.phaseActive,
                  )}
                  data-complete={t.complete}
                  data-active={t.active}
                >
                  <span
                    className={styles.phaseNode}
                    aria-label={
                      t.complete
                        ? "complete"
                        : t.active
                          ? "current"
                          : "upcoming"
                    }
                  >
                    {t.complete ? <Check aria-hidden /> : i + 1}
                  </span>
                  <div className={styles.phaseBody}>
                    <p className={styles.phaseTitle}>{t.title}</p>
                    <p className={styles.phaseMilestone}>{t.milestone}</p>
                    <Meter
                      share={t.itemsTotal ? t.itemsDone / t.itemsTotal : 0}
                      reduce={reduce}
                      delay={0.3 + i * 0.08}
                      className={styles.phaseBar}
                    />
                    <p className={styles.phaseCount}>
                      {t.itemsDone}/{t.itemsTotal} done
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </motion.section>
      </div>
    </div>
  );
}

/** A count out of a total with a thin meter under it. */
function Tile({
  label,
  value,
  of,
  i,
  reduce,
  testId,
}: {
  label: string;
  value: number;
  of: number;
  i: number;
  reduce: boolean;
  testId: string;
}) {
  return (
    <motion.div
      className={cn(styles.card, styles.tile)}
      data-testid={testId}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ENTER, delay: reduce ? 0 : i * 0.06 }}
    >
      <p className={styles.label}>{label}</p>
      <p className={styles.tileValue}>
        {value}
        <span className={styles.tileOf}> / {of}</span>
      </p>
      <Meter
        share={of ? value / of : 0}
        reduce={reduce}
        delay={0.25 + i * 0.05}
        className={styles.tileBar}
      />
    </motion.div>
  );
}

/** A horizontal meter whose fill grows in on mount. With `label` it is a progressbar; otherwise decorative. */
function Meter({
  share,
  reduce,
  delay,
  className,
  label,
  value,
}: {
  share: number;
  reduce: boolean;
  delay: number;
  className?: string;
  label?: string;
  value?: number;
}) {
  const pct = Math.max(0, Math.min(100, share * 100));
  const a11y = label
    ? {
        role: "progressbar",
        "aria-label": label,
        "aria-valuenow": value ?? Math.round(pct),
        "aria-valuemin": 0,
        "aria-valuemax": 100,
      }
    : { "aria-hidden": true };
  return (
    <div className={cn(styles.meter, className)} {...a11y}>
      <motion.span
        className={styles.meterFill}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={reduce ? { duration: 0 } : { ...GROW, delay }}
      />
    </div>
  );
}

function formatMonth(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** The last `n` calendar cells of the activity year, oldest first. */
function lastDays(activity: DashboardSummary["activity"], n: number) {
  return activity.weeks.flat().slice(-n);
}

/** Items done out of total as a ring; the number in the middle is the count, not a percentage. */
function Ring({
  done,
  total,
  reduce,
}: {
  done: number;
  total: number;
  reduce: boolean;
}) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const share = total ? done / total : 0;
  return (
    <div
      className={styles.ring}
      role="img"
      aria-label={`${done} of ${total} items done`}
      data-testid="tile-items"
    >
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
function Heatmap({
  activity,
  today,
}: {
  activity: DashboardSummary["activity"];
  today: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // The year overflows its column on narrow screens: open on today, not on the oldest week.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [activity]);
  return (
    <div className={styles.heatWrap}>
      <div
        ref={scroller}
        className={styles.heat}
        data-testid="activity-heatmap"
        data-empty={activity.activeDays === 0}
      >
        <div className={styles.heatMonths} aria-hidden>
          {activity.months.map((m) => (
            <span
              key={`${m.label}-${m.week}`}
              style={{ gridColumnStart: m.week + 1 }}
            >
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
                  className={cn(
                    styles.heatCell,
                    cell.active && styles.heatOn,
                    cell.day === today && styles.heatToday,
                  )}
                  title={`${cell.day}${cell.active ? " · active" : ""}`}
                  data-day={cell.day}
                  data-active={cell.active}
                  style={{
                    gridRowStart:
                      new Date(`${cell.day}T00:00:00Z`).getUTCDay() + 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <span className="sr-only">
          {DOW.join(", ")} rows, one column per week
        </span>
      </div>
      {activity.activeDays === 0 && (
        <p className={styles.heatEmpty} data-testid="activity-empty">
          No activity yet — marking an item done or talking to Nova lights up a
          day.
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
            <span
              className={styles.barGoal}
              style={{ width: `${(r.required / max) * 100}%` }}
            />
            <span
              className={styles.barYou}
              style={{ width: `${(r.known / max) * 100}%` }}
            />
          </div>
          <p className={styles.barValue}>
            {r.known} / {r.required}
          </p>
        </div>
      ))}
    </div>
  );
}
