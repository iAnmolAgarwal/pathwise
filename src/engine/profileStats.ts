import type { Path, Profile } from "../schemas";
import { streakFromDays } from "./dashboard";
import { requiredSkillsForGoals } from "./gap";
import type { EngineData } from "./types";

/**
 * Profile-rail statistics: the difficulty split, badges and the activity calendar.
 *
 * Deliberately separate from `dashboardSummary` so `DashboardSummary` — which the
 * get_dashboard_summary chat tool and the dashboard route both depend on — keeps its
 * exact shape. Same inputs, same purity: no I/O, `today` injected by the caller.
 */

export const DIFFICULTY_BANDS = ["easy", "medium", "hard"] as const;
export type DifficultyBand = (typeof DIFFICULTY_BANDS)[number];

/** A skill's levelBand (1–3) is its depth tier; we surface it as easy / medium / hard. */
const BAND_OF: Record<number, DifficultyBand> = { 1: "easy", 2: "medium", 3: "hard" };

export type DifficultyRow = {
  band: DifficultyBand;
  /** Goal-required skills in this band whose target level the learner has reached. */
  attained: number;
  /** Goal-required skills in this band. Zero when the goal needs nothing at that depth. */
  required: number;
};

export type BadgeId =
  | "first-path"
  | "foundations"
  | "explorer"
  | "streak-7"
  | "streak-30"
  | "depth"
  | "hard-mode"
  | "goal-complete";

export type EarnedBadge = {
  id: BadgeId;
  name: string;
  /** What earning it means, phrased for the learner. */
  hint: string;
  earned: boolean;
};

export type ActivityDay = {
  /** UTC date, YYYY-MM-DD. */
  day: string;
  /** Events recorded that day. */
  count: number;
};

export type Activity = {
  /** Runs from a Sunday up to and including today, so a 7-row grid aligns by weekday. */
  days: ActivityDay[];
  activeDays: number;
  from: string;
  to: string;
};

export type ProfileStats = {
  difficulty: DifficultyRow[];
  /** Goal-required skills reached, across every band. */
  totals: { attained: number; required: number };
  badges: EarnedBadge[];
  activity: Activity;
};

export type ProfileStatsInput = {
  profile: Profile;
  path: Path | null;
  data: EngineData;
  /**
   * UTC days (YYYY-MM-DD) with at least one feedback event. `listFeedbackDays` returns
   * these distinct today, so every active day weighs 1; if it is ever changed to return
   * one row per event, the counts here become a real intensity ramp with no other change.
   */
  eventDays: string[];
  /** UTC date (YYYY-MM-DD) the stats are computed for; injected so this stays pure. */
  today: string;
  /** Calendar width. 53 weeks matches a year-long contribution grid. */
  weeks?: number;
};

const DAY_MS = 86_400_000;
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const parseDay = (day: string) => Date.parse(`${day}T00:00:00Z`);

/**
 * Roughly `weeks` columns ending on `today`, back-shifted to the preceding Sunday so a
 * 7-row grid starts at the top of a column. The final column is partial unless today is
 * a Saturday, which is what a contribution grid should look like.
 */
export function activityCalendar(eventDays: string[], today: string, weeks = 53): Activity {
  const counts = new Map<string, number>();
  for (const day of eventDays) counts.set(day, (counts.get(day) ?? 0) + 1);

  const end = parseDay(today);
  const span = weeks * 7 - 1;
  // getUTCDay(): 0 = Sunday.
  const start = end - (span + new Date(end - span * DAY_MS).getUTCDay()) * DAY_MS;

  const days: ActivityDay[] = [];
  for (let ms = start; ms <= end; ms += DAY_MS) {
    const day = toDay(ms);
    days.push({ day, count: counts.get(day) ?? 0 });
  }
  return {
    days,
    activeDays: days.filter((d) => d.count > 0).length,
    from: days[0]?.day ?? today,
    to: today,
  };
}

/** Easy / medium / hard split over the skills the learner's goals require. */
export function difficultyRows(profile: Profile, data: EngineData): DifficultyRow[] {
  const bandOfSkill = new Map(data.skills.map((s) => [s.id, BAND_OF[s.levelBand]]));
  const rows: Record<DifficultyBand, DifficultyRow> = {
    easy: { band: "easy", attained: 0, required: 0 },
    medium: { band: "medium", attained: 0, required: 0 },
    hard: { band: "hard", attained: 0, required: 0 },
  };
  for (const { skillId, level: target } of requiredSkillsForGoals(profile.goals, data.goals)) {
    const band = bandOfSkill.get(skillId);
    if (!band) continue;
    rows[band].required++;
    if ((profile.skills[skillId]?.level ?? 0) >= target) rows[band].attained++;
  }
  // Always all three, in order, so the row layout never reflows between learners.
  return DIFFICULTY_BANDS.map((b) => rows[b]);
}

/**
 * Badges are derived on read from state already stored — there is no badges table and
 * nothing is written when one is earned.
 */
export function badgesFor(
  profile: Profile,
  path: Path | null,
  data: EngineData,
  difficulty: DifficultyRow[],
  longestStreak: number,
): EarnedBadge[] {
  const by = (band: DifficultyBand) => difficulty.find((d) => d.band === band)!;
  const easy = by("easy");
  const levels = Object.values(profile.skills).map((s) => s.level);
  const domains = new Set(
    data.skills.filter((s) => (profile.skills[s.id]?.level ?? 0) > 0).map((s) => s.domain),
  );
  const required = difficulty.reduce((n, d) => n + d.required, 0);
  const attained = difficulty.reduce((n, d) => n + d.attained, 0);

  return [
    { id: "first-path", name: "First Path", hint: "Generate your first learning path", earned: (path?.phases.length ?? 0) > 0 },
    { id: "streak-7", name: "7-Day Streak", hint: "Seven days of activity in a row", earned: longestStreak >= 7 },
    { id: "foundations", name: "Foundations", hint: "Reach every Easy skill your goal needs", earned: easy.required > 0 && easy.attained === easy.required },
    { id: "explorer", name: "Explorer", hint: "Pick up skills in five different domains", earned: domains.size >= 5 },
    { id: "streak-30", name: "30-Day Streak", hint: "Thirty days of activity in a row", earned: longestStreak >= 30 },
    { id: "hard-mode", name: "Hard Mode", hint: "Reach three Hard skills", earned: by("hard").attained >= 3 },
    { id: "depth", name: "Depth", hint: "Reach level 3 in any skill", earned: levels.some((l) => l === 3) },
    { id: "goal-complete", name: "Goal Complete", hint: "Reach every skill your goal requires", earned: required > 0 && attained === required },
  ];
}

/** Everything the profile rail shows, computed from stored state alone. */
export function profileStats(input: ProfileStatsInput): ProfileStats {
  const { profile, path, data } = input;
  const difficulty = difficultyRows(profile, data);
  const { longest } = streakFromDays(input.eventDays, input.today);
  return {
    difficulty,
    totals: {
      attained: difficulty.reduce((n, d) => n + d.attained, 0),
      required: difficulty.reduce((n, d) => n + d.required, 0),
    },
    badges: badgesFor(profile, path, data, difficulty, longest),
    activity: activityCalendar(input.eventDays, input.today, input.weeks),
  };
}
