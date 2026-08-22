import type { Domain, Path, Profile } from "../schemas";
import { computeGap, requiredSkillsForGoals } from "./gap";
import type { EngineData, Gap } from "./types";

export type SkillStatus = "acquired" | "in-progress" | "gap" | "unrelated";

export type NextAction = {
  catalogId: string | null;
  title: string | null;
  kind: string | null;
  hours: number | null;
  phase: string | null;
  why: string;
};

export type DashboardSummary = {
  progress: {
    /** Level-weighted attainment over goal-required skills, 0–100. */
    percent: number;
    attainedLevels: number;
    requiredLevels: number;
    itemsDone: number;
    itemsTotal: number;
  };
  radar: { domain: Domain; label: string; known: number; required: number }[];
  timeline: { title: string; milestone: string; itemsDone: number; itemsTotal: number; complete: boolean; active: boolean }[];
  nextAction: NextAction;
  streak: Streak;
  /** Easy / medium / hard split of the path's items by catalog difficulty (1–2 / 3 / 4–5). */
  difficulty: DifficultySplit;
  /** Calendar of active days over the last 52 weeks. */
  activity: ActivityCalendar;
  gap: Pick<Gap, "skillId" | "targetLevel" | "currentLevel" | "reason">[];
  skillStatus: Record<string, SkillStatus>;
  /** The UTC date the summary was computed for. */
  today: string;
};

export type Streak = { current: number; longest: number; activeDays: string[] };

export type DifficultyBucket = "easy" | "medium" | "hard";
export type DifficultySplit = Record<DifficultyBucket, { done: number; total: number }>;

export type ActivityCell = { day: string; active: boolean };
export type ActivityCalendar = {
  /** Columns of up to seven cells, Sunday first, ending on today; 53 columns cover 52 weeks plus the partial current one. */
  weeks: ActivityCell[][];
  /** Month labels at the column where each month starts. */
  months: { label: string; week: number }[];
  activeDays: number;
};

export type MilestoneBadge = { phase: string; milestone: string; earned: boolean };

export type DashboardInput = {
  profile: Profile;
  path: Path | null;
  data: EngineData;
  /** UTC dates (YYYY-MM-DD) with at least one feedback event or chat message. */
  eventDays: string[];
  /** UTC date (YYYY-MM-DD) the summary is computed for; injected so this stays pure. */
  today: string;
};

const DOMAIN_LABEL: Record<Domain, string> = {
  foundations: "Foundations",
  "web-frontend": "Frontend",
  "web-backend": "Backend",
  "data-engineering": "Data Eng",
  "data-analysis": "Data Analysis",
  "machine-learning": "ML",
  "ai-engineering": "AI Eng",
  cloud: "Cloud",
  devops: "DevOps",
  security: "Security",
};

const DAY_MS = 86_400_000;
const dayIndex = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** Activity streak from feedback days: current run must reach today or yesterday. */
export function streakFromDays(days: string[], today: string): Streak {
  const unique = [...new Set(days)].sort();
  const indices = unique.map(dayIndex);
  let longest = 0;
  let run = 0;
  for (let i = 0; i < indices.length; i++) {
    run = i > 0 && indices[i] === indices[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const todayIdx = dayIndex(today);
  let current = 0;
  const last = indices.at(-1);
  if (last !== undefined && todayIdx - last <= 1) {
    current = 1;
    for (let i = indices.length - 1; i > 0 && indices[i] === indices[i - 1] + 1; i--) current++;
  }
  const activeDays = unique.filter((d) => todayIdx - dayIndex(d) < 14);
  return { current, longest, activeDays };
}

const OPEN = new Set(["todo", "in_progress"]);

const BUCKET_OF = (difficulty: number): DifficultyBucket => (difficulty <= 2 ? "easy" : difficulty === 3 ? "medium" : "hard");

/** Items done / total per difficulty bucket: catalog difficulty 1–2 easy, 3 medium, 4–5 hard. */
export function difficultySplit(path: Path | null, data: EngineData): DifficultySplit {
  const split: DifficultySplit = { easy: { done: 0, total: 0 }, medium: { done: 0, total: 0 }, hard: { done: 0, total: 0 } };
  const catalog = new Map(data.catalog.map((c) => [c.id, c.difficulty]));
  for (const item of path?.phases.flatMap((p) => p.items) ?? []) {
    const d = catalog.get(item.catalogId);
    if (d === undefined) continue;
    const row = split[BUCKET_OF(d)];
    row.total++;
    if (item.status === "done") row.done++;
  }
  return split;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayOf = (index: number) => new Date(index * DAY_MS).toISOString().slice(0, 10);

/**
 * The activity heatmap's grid: WEEKS full weeks before the current one, columns Sunday-first,
 * ending on today. Active days come from stored feedback events and chat messages only — an
 * empty input yields an empty grid, never a fill.
 */
export function activityCalendar(days: string[], today: string, weeks = 52): ActivityCalendar {
  const active = new Set(days);
  const todayIdx = dayIndex(today);
  const todayDow = new Date(todayIdx * DAY_MS).getUTCDay();
  const start = todayIdx - todayDow - weeks * 7;
  const columns: ActivityCell[][] = [];
  const months: ActivityCalendar["months"] = [];
  let lastMonth = -1;
  for (let idx = start; idx <= todayIdx; idx++) {
    const day = dayOf(idx);
    const dow = new Date(idx * DAY_MS).getUTCDay();
    if (dow === 0 || columns.length === 0) columns.push([]);
    columns[columns.length - 1].push({ day, active: active.has(day) });
    const month = new Date(idx * DAY_MS).getUTCMonth();
    if (month !== lastMonth) {
      if (lastMonth !== -1 || idx === start) months.push({ label: MONTH[month], week: columns.length - 1 });
      lastMonth = month;
    }
  }
  // A label on the very first, usually partial, column would overlap the next one.
  if (months.length > 1 && months[1].week - months[0].week < 2) months.shift();
  const activeDays = columns.flat().filter((c) => c.active).length;
  return { weeks: columns, months, activeDays };
}

/** One badge per phase: earned when the phase's items are all settled, otherwise locked under its milestone name. */
export function milestoneBadges(timeline: DashboardSummary["timeline"]): MilestoneBadge[] {
  return timeline.map((p) => ({ phase: p.title, milestone: p.milestone, earned: p.complete }));
}

/** Everything the dashboard tab and the get_dashboard_summary tool show, computed from state alone. */
export function dashboardSummary(input: DashboardInput): DashboardSummary {
  const { profile, path, data } = input;
  const skillById = new Map(data.skills.map((s) => [s.id, s]));
  const catalog = new Map(data.catalog.map((c) => [c.id, c]));
  const level = (id: string) => profile.skills[id]?.level ?? 0;

  const required = requiredSkillsForGoals(profile.goals, data.goals);
  const gap = computeGap(profile, required, data.skillEdges);
  const gapIds = new Set(gap.map((g) => g.skillId));

  // Progress and radar: level-weighted over goal-required skills, grouped by domain.
  let attained = 0;
  let requiredLevels = 0;
  const byDomain = new Map<Domain, { known: number; required: number }>();
  for (const { skillId, level: target } of required) {
    const known = Math.min(level(skillId), target);
    attained += known;
    requiredLevels += target;
    const domain = skillById.get(skillId)?.domain;
    if (!domain) continue;
    const row = byDomain.get(domain) ?? { known: 0, required: 0 };
    row.known += known;
    row.required += target;
    byDomain.set(domain, row);
  }
  const radar = [...byDomain].map(([domain, r]) => ({ domain, label: DOMAIN_LABEL[domain], ...r }));

  const phases = path?.phases ?? [];
  const items = phases.flatMap((p) => p.items);
  const settled = (status: string) => !OPEN.has(status);
  const activeIndex = phases.findIndex((p) => p.items.some((i) => OPEN.has(i.status)));
  const timeline = phases.map((p, i) => {
    const itemsDone = p.items.filter((it) => it.status === "done").length;
    return {
      title: p.title,
      milestone: p.milestone,
      itemsDone,
      itemsTotal: p.items.length,
      complete: p.items.length > 0 && p.items.every((it) => settled(it.status)),
      active: i === activeIndex,
    };
  });

  // Skill status for the graph: acquired / in-progress (taught in the active phase or by a
  // started item) / gap / unrelated.
  const inProgress = new Set<string>();
  phases.forEach((p, i) => {
    for (const it of p.items) {
      if (it.status !== "in_progress" && !(i === activeIndex && OPEN.has(it.status))) continue;
      for (const t of catalog.get(it.catalogId)?.skillsTaught ?? []) inProgress.add(t.skillId);
    }
  });
  const skillStatus: Record<string, SkillStatus> = {};
  for (const s of data.skills) {
    if (gapIds.has(s.id)) skillStatus[s.id] = inProgress.has(s.id) ? "in-progress" : "gap";
    else if (level(s.id) > 0) skillStatus[s.id] = "acquired";
    else skillStatus[s.id] = "unrelated";
  }

  return {
    progress: {
      percent: requiredLevels === 0 ? 0 : Math.round((attained / requiredLevels) * 100),
      attainedLevels: attained,
      requiredLevels,
      itemsDone: items.filter((i) => i.status === "done").length,
      itemsTotal: items.length,
    },
    radar,
    timeline,
    nextAction: nextAction(path, data, profile),
    streak: streakFromDays(input.eventDays, input.today),
    difficulty: difficultySplit(path, data),
    activity: activityCalendar(input.eventDays, input.today),
    gap: gap.map(({ skillId, targetLevel, currentLevel, reason }) => ({ skillId, targetLevel, currentLevel, reason })),
    skillStatus,
    today: input.today,
  };
}

function nextAction(path: Path | null, data: EngineData, profile: Profile): NextAction {
  const none = { catalogId: null, title: null, kind: null, hours: null, phase: null };
  if (profile.goals.length === 0) return { ...none, why: "Tell Nova what you want to become — a goal is where a path starts." };
  if (!path || path.phases.length === 0) return { ...none, why: "Generate your path: your goal is set but nothing is planned yet." };
  const catalog = new Map(data.catalog.map((c) => [c.id, c]));
  const skillName = (id: string) => data.skills.find((s) => s.id === id)?.name ?? id;
  const status = new Map(path.phases.flatMap((p) => p.items.map((i) => [i.catalogId, i.status] as const)));
  const open = path.phases.flatMap((p) => p.items.filter((i) => OPEN.has(i.status)).map((i) => ({ item: i, phase: p.title })));
  if (open.length === 0) return { ...none, why: "Every item is done or skipped — set a new goal to keep going." };
  const unblocked = open.find(({ item }) => item.evidence.sequencedAfter.every((s) => !OPEN.has(status.get(s.catalogId) ?? "done")));
  const pick = unblocked ?? open[0];
  const c = catalog.get(pick.item.catalogId);
  const closes = pick.item.evidence.gapSkillsCovered.map((g) => skillName(g.skillId));
  const reasons: string[] = [];
  if (pick.item.status === "in_progress") reasons.push("you have already started it");
  else if (unblocked) reasons.push(pick.item.evidence.sequencedAfter.length ? "everything it builds on is done" : "nothing stands before it");
  else reasons.push("it is the earliest open step");
  if (closes.length) reasons.push(`it closes ${closes.slice(0, 3).join(", ")}${closes.length > 3 ? " and more" : ""}`);
  return {
    catalogId: pick.item.catalogId,
    title: c?.title ?? pick.item.catalogId,
    kind: c?.kind ?? null,
    hours: c?.durationHours ?? null,
    phase: pick.phase,
    why: `Next in ${pick.phase}: ${reasons.join("; ")}.`,
  };
}
