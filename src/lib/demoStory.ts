import { generatePath } from "@/engine";
import { dashboardSummary } from "@/engine/dashboard";
import { applyProfileOps } from "@/engine/profile";
import { applyFeedback } from "@/engine/replan";
import type { EngineData } from "@/engine/types";
import { loadEngineData } from "@/lib/engineData";
import { buildProfileCard } from "@/lib/profileCard";
import type { FeedbackEvent, Path, PathDiff, Profile, ProfileOp } from "@/schemas";

/**
 * The demo learner's forty-one days, shared by `scripts/seed-demo.ts` (which writes it to the
 * database) and the landing page (which replays it in memory so every number on the benefits
 * wall is one the engine produced for this learner). Nothing here is hand-written output: the
 * path versions and their diffs come from the feedback rules (§5.5), back-dated.
 */

export type DemoStep =
  | { kind: "chat"; day: number; role: "user" | "assistant"; text: string; toolCalls?: string[]; card?: true; minute?: number }
  | { kind: "feedback"; day: number; event: FeedbackEvent; minute?: number };

const DAY = 86_400_000;

/** Days ago → timestamp at a plausible evening hour, relative to `now`. */
export function demoAt(daysAgo: number, hour = 20, minute = 0, now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(hour, minute, 0, 0);
  return new Date(d.getTime() - daysAgo * DAY);
}

/** Goal + the levels Nova inferred from the first message (day 41). */
export const DEMO_OPENING_OPS: ProfileOp[] = [
  { op: "add_goal", goal: { type: "role", templateId: "machine-learning-engineer" } },
  { op: "set_skill", skillId: "python", level: 3, source: "inferred" },
  { op: "set_skill", skillId: "programming-basics", level: 3, source: "inferred" },
  { op: "set_skill", skillId: "statistics-fundamentals", level: 1, source: "inferred" },
];

/** What the learner corrected on the intake card. */
export const DEMO_CARD_ANSWER: ProfileOp[] = [
  { op: "set_skill", skillId: "python-data-analysis", level: 2, source: "stated" },
  { op: "set_preference", key: "hoursPerWeek", value: 8 },
];

/** The hours change the day-5 conversation records. */
export const DEMO_HOURS_OPS: ProfileOp[] = [{ op: "set_preference", key: "hoursPerWeek", value: 10 }];

/**
 * Forty-one days in the life of a learner going from "knows some Python" to mid-path ML engineer.
 * Chat-only days keep the streak alive; feedback days move the path. The last seven days are all
 * active so the 7-day badge is earned and the current streak is live today.
 */
export const DEMO_STORY: DemoStep[] = [
  { kind: "chat", day: 41, role: "user", text: "I want to become a machine learning engineer. I write Python every day at work and did a statistics course at uni, but I've never trained a real model." },
  { kind: "chat", day: 41, role: "assistant", text: "Got it — Machine Learning Engineer it is, with Python and statistics marked as things you already hold. Before I build the path, let me check a few levels with you so it starts in the right place.", toolCalls: ["apply_profile_ops"], minute: 1 },
  { kind: "chat", day: 41, role: "assistant", text: "Tap anything I got wrong, and tell me how your week looks.", card: true, minute: 2 },
  { kind: "chat", day: 41, role: "user", text: "That's about right — I'm comfortable with pandas already, and I can do 8 hours a week. Build it.", minute: 6 },
  { kind: "chat", day: 41, role: "assistant", text: "Your path is ready: five phases from programming foundations through core machine learning to deployment. The first milestone is a tested, version-controlled analysis. Start with the statistics primer — most of phase one assumes its vocabulary.", toolCalls: ["apply_profile_ops", "generate_path"], minute: 7 },
  { kind: "feedback", day: 38, event: { type: "completed", catalogId: "seeing-theory" } },
  { kind: "chat", day: 36, role: "user", text: "Is the SQL item really necessary? I mostly work from CSV exports." },
  { kind: "chat", day: 36, role: "assistant", text: "For the goal, yes — later items pull from a warehouse, and the engine keeps SQL because they build on it. If you already know it, mark it too easy and the path will drop what it was covering.", minute: 1 },
  { kind: "feedback", day: 35, event: { type: "too_easy", catalogId: "sqlbolt" } },
  { kind: "feedback", day: 33, event: { type: "completed", catalogId: "linux-journey" } },
  { kind: "feedback", day: 31, event: { type: "quiz_result", skillId: "statistics-fundamentals", score: 82 } },
  { kind: "chat", day: 27, role: "user", text: "The StatQuest series is huge. Is there a lighter way in?" },
  { kind: "chat", day: 27, role: "assistant", text: "Mark it too hard and the engine will put a gentler prerequisite in front of it rather than just swapping it out — you'll see the reason on the diff banner.", minute: 1 },
  { kind: "feedback", day: 27, event: { type: "too_hard", catalogId: "statquest" }, minute: 3 },
  { kind: "feedback", day: 24, event: { type: "completed", catalogId: "real-python-testing" } },
  { kind: "feedback", day: 20, event: { type: "not_interested", catalogId: "kaggle-titanic" } },
  { kind: "feedback", day: 18, event: { type: "completed", catalogId: "fcc-git-video" } },
  { kind: "chat", day: 14, role: "user", text: "Been travelling, back now. Where was I?" },
  { kind: "chat", day: 14, role: "assistant", text: "Welcome back. Phase 2 is in progress — the open items are the ones before the classical-ML milestone. Nothing on the path expired while you were away; it only changes when you tell it something.", minute: 1 },
  { kind: "feedback", day: 12, event: { type: "completed", catalogId: "deep-ml" } },
  { kind: "feedback", day: 6, event: { type: "completed", catalogId: "kaggle-digit-recognizer" } },
  { kind: "chat", day: 5, role: "user", text: "Can I bump to 10 hours a week? I want to reach deployment faster." },
  { kind: "chat", day: 5, role: "assistant", text: "Done — 10 hours a week. The path keeps the same items; the plan just covers them in fewer weeks. You can change this yourself any time from Edit profile on the dashboard.", toolCalls: ["apply_profile_ops"], minute: 1 },
  { kind: "feedback", day: 4, event: { type: "quiz_result", skillId: "ml-fundamentals", score: 74 } },
  { kind: "feedback", day: 3, event: { type: "completed", catalogId: "kaggle-intermediate-ml" } },
  { kind: "chat", day: 2, role: "user", text: "What's the single most useful thing I can do this week?" },
  { kind: "chat", day: 2, role: "assistant", text: "Finish the open item in your current phase — it's the one the deployment phase builds on. After that the path opens up into MLOps, which is where your work experience starts paying off.", minute: 1 },
  { kind: "feedback", day: 1, event: { type: "completed", catalogId: "kaggle-house-prices" } },
  { kind: "chat", day: 0, role: "user", text: "Show me where I stand." },
  { kind: "chat", day: 0, role: "assistant", text: "You're well into the path — open the Dashboard tab for the full picture: progress toward the goal, what's next, and your streak.", minute: 1 },
];

export type DemoReplay = {
  profile: Profile;
  path: Path;
  /** Every replan, oldest first, with the event that caused it. */
  replans: { day: number; event: FeedbackEvent; diff: PathDiff }[];
  /** Distinct activity days (chat or feedback), ISO dates, sorted — what `listActivityDays` would return. */
  eventDays: string[];
  /** Events the live route would have rejected (item not on the path at that point). */
  skippedEvents: string[];
};

/** Replays the story through the engine with no database. The seed script mirrors this loop with writes. */
export function replayDemoStory(data: EngineData = loadEngineData(), now = new Date()): DemoReplay {
  const catalogIds = new Set(data.catalog.map((c) => c.id));
  let profile = applyProfileOps({ goals: [], skills: {}, preferences: { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" } }, DEMO_OPENING_OPS);
  const card = buildProfileCard("seed-card", profile, data);
  if ("error" in card) throw new Error(card.error);
  profile = applyProfileOps(profile, DEMO_CARD_ANSWER);

  let path: Path = generatePath(profile, data, { now: demoAt(41, 19, 7, now).toISOString(), trigger: "initial" }).path;
  const replans: DemoReplay["replans"] = [];
  const eventDays = new Set<string>();
  const skippedEvents: string[] = [];

  for (const step of DEMO_STORY) {
    const when = demoAt(step.day, 20, step.minute ?? 0, now);
    eventDays.add(when.toISOString().slice(0, 10));
    if (step.kind === "chat") {
      if (step.toolCalls?.includes("apply_profile_ops") && step.day === 5) profile = applyProfileOps(profile, DEMO_HOURS_OPS);
      continue;
    }
    const { event } = step;
    if ("catalogId" in event) {
      const onPath = path.phases.some((p) => p.items.some((i) => i.catalogId === event.catalogId));
      if (!catalogIds.has(event.catalogId) || !onPath) {
        skippedEvents.push(`${event.type}:${event.catalogId}`);
        continue;
      }
    } else if (!data.skills.some((s) => s.id === event.skillId)) {
      skippedEvents.push(`${event.type}:${event.skillId}`);
      continue;
    }
    const result = applyFeedback(event, { profile, path, data, now: when.toISOString(), eventId: `demo-${step.day}-${event.type}` });
    profile = result.profile;
    path = result.path;
    if (result.replanned && result.diff) replans.push({ day: step.day, event, diff: result.diff });
  }

  return { profile, path, replans, eventDays: [...eventDays].sort(), skippedEvents };
}

/** The values the benefits wall shows, all produced by the engine for the demo learner. */
export type DemoNumbers = {
  /** Score parts of the first open item on the path, in engine order (§5.2). */
  score: { coverage: number; levelFit: number; preferenceFit: number; quality: number; similarity: number };
  /** Current activity streak in days and progress toward the goal in whole percent. */
  streakDays: number;
  progressPct: number;
  /**
   * A `too_hard` event run through the engine on the demo learner's current path: the first open
   * item whose remediation adds something. `cause` and the row reasons are the engine's own words.
   */
  tooHard: { cause: string; added: { title: string; reason: string }[]; removed: { title: string; reason: string }[] };
};

export function demoNumbers(data: EngineData = loadEngineData(), now = new Date()): DemoNumbers {
  const replay = replayDemoStory(data, now);
  const items = replay.path.phases.flatMap((p) => p.items);
  const openItems = items.filter((i) => i.status === "todo" || i.status === "in_progress");
  const open = openItems[0] ?? items[0];
  const b = open.evidence.scoreBreakdown;
  const summary = dashboardSummary({ profile: replay.profile, path: replay.path, data, eventDays: replay.eventDays, today: now.toISOString().slice(0, 10) });
  const titles = new Map<string, string>(data.catalog.map((c) => [c.id, c.title]));
  const name = (id: string) => titles.get(id) ?? id;

  let tooHard: DemoNumbers["tooHard"] | null = null;
  for (const item of openItems) {
    const result = applyFeedback({ type: "too_hard", catalogId: item.catalogId }, { profile: replay.profile, path: replay.path, data, now: now.toISOString(), eventId: "demo-too-hard" });
    if (!result.replanned || !result.diff || result.diff.added.length === 0) continue;
    tooHard = {
      cause: result.diff.cause.humanReadable,
      added: result.diff.added.map((a) => ({ title: name(a.catalogId), reason: a.reason })),
      removed: result.diff.removed.map((r) => ({ title: name(r.catalogId), reason: r.reason })),
    };
    break;
  }
  if (!tooHard) throw new Error("demoNumbers: no open item on the demo path produces a too_hard remediation");

  return {
    score: { coverage: b.coverage, levelFit: b.levelFit, preferenceFit: b.preferenceFit, quality: b.quality, similarity: b.similarity },
    streakDays: summary.streak.current,
    progressPct: summary.progress.percent,
    tooHard,
  };
}
