/**
 * Seed one demo learner whose history exercises every part of the workspace: a goal, an intake
 * card, a path that has been replanned by real feedback of every kind, activity spread over
 * weeks (heatmap, streaks, badges), and a chat log that reads like a real conversation.
 *
 * Everything goes through the engine — the path versions and their diffs are what the feedback
 * rules produce, back-dated; nothing is hand-written. Re-running replaces the previous copy.
 *
 *   npx tsx --env-file=.env.local scripts/seed-demo.ts <owner-email> [display name]
 */
import { eq } from "drizzle-orm";
import { db, chatMessages, feedbackEvents, learners, paths, profiles, users } from "../src/db";
import { generatePath } from "../src/engine";
import { applyProfileOps } from "../src/engine/profile";
import { applyFeedback } from "../src/engine/replan";
import { loadEngineData } from "../src/lib/engineData";
import { buildProfileCard } from "../src/lib/profileCard";
import type { FeedbackEvent, Path, PathDiff, Profile, ProfileOp } from "../src/schemas";

const DISPLAY_NAME = process.argv[3] ?? "Maya Iyer";
const OWNER_EMAIL = process.argv[2];
if (!OWNER_EMAIL) {
  console.error("usage: seed-demo.ts <owner-email> [display name]");
  process.exit(1);
}

const DAY = 86_400_000;
/** Days ago → ISO timestamp at a plausible evening hour. */
function at(daysAgo: number, hour = 20, minute = 0): Date {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  return new Date(d.getTime() - daysAgo * DAY);
}

type Step =
  | { kind: "chat"; day: number; role: "user" | "assistant"; text: string; toolCalls?: string[]; card?: true; minute?: number }
  | { kind: "feedback"; day: number; event: FeedbackEvent; minute?: number };

/**
 * Forty-one days in the life of a learner going from "knows some Python" to mid-path ML engineer.
 * Chat-only days keep the streak alive; feedback days move the path. The last seven days are all
 * active so the 7-day badge is earned and the current streak is live today.
 */
const STORY: Step[] = [
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

async function main() {
  const data = loadEngineData();
  const catalogIds = new Set(data.catalog.map((c) => c.id));
  const conn = db();

  const [owner] = await conn.select().from(users).where(eq(users.email, OWNER_EMAIL));
  if (!owner) throw new Error(`No user with email ${OWNER_EMAIL} — sign in once first`);

  // Replace any previous copy so the script is safe to re-run.
  const existing = await conn.select().from(learners).where(eq(learners.displayName, DISPLAY_NAME));
  for (const row of existing.filter((l) => l.userId === owner.id)) {
    await conn.delete(chatMessages).where(eq(chatMessages.learnerId, row.id));
    await conn.delete(feedbackEvents).where(eq(feedbackEvents.learnerId, row.id));
    await conn.delete(paths).where(eq(paths.learnerId, row.id));
    await conn.delete(profiles).where(eq(profiles.learnerId, row.id));
    await conn.delete(learners).where(eq(learners.id, row.id));
  }

  // Day 41: goal + the levels Nova inferred from the first message, then the levels the learner corrected on the card.
  let profile: Profile = applyProfileOps(
    { goals: [], skills: {}, preferences: { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" } },
    [
      { op: "add_goal", goal: { type: "role", templateId: "machine-learning-engineer" } },
      { op: "set_skill", skillId: "python", level: 3, source: "inferred" },
      { op: "set_skill", skillId: "programming-basics", level: 3, source: "inferred" },
      { op: "set_skill", skillId: "statistics-fundamentals", level: 1, source: "inferred" },
    ],
  );
  const card = buildProfileCard("seed-card", profile, data);
  if ("error" in card) throw new Error(card.error);
  const cardAnswer: ProfileOp[] = [
    { op: "set_skill", skillId: "python-data-analysis", level: 2, source: "stated" },
    { op: "set_preference", key: "hoursPerWeek", value: 8 },
  ];
  profile = applyProfileOps(profile, cardAnswer);

  const [learner] = await conn
    .insert(learners)
    .values({ userId: owner.id, displayName: DISPLAY_NAME, avatarSeed: "demo-maya", createdAt: at(41, 19) })
    .returning();
  await conn.insert(profiles).values({ learnerId: learner.id, data: profile, updatedAt: at(41, 19, 6) });

  const first = generatePath(profile, data, { now: at(41, 19, 7).toISOString(), trigger: "initial" });
  let path: Path = first.path;
  let version = 1;
  let latestPathId = (await conn.insert(paths).values({ learnerId: learner.id, version, data: path, diff: null, createdAt: at(41, 19, 7) }).returning())[0].id;

  const counts = { chat: 0, feedback: 0, replans: 0, skippedEvents: [] as string[] };
  for (const step of STORY) {
    const when = at(step.day, 20, step.minute ?? 0);
    if (step.kind === "chat") {
      const content: { text: string; toolCalls?: string[]; card?: typeof card } = { text: step.text };
      if (step.toolCalls) content.toolCalls = step.toolCalls;
      if (step.card) content.card = card;
      await conn.insert(chatMessages).values({ learnerId: learner.id, role: step.role, content, createdAt: when });
      counts.chat += 1;
      // The hours change on day 5 is a real profile op, applied where the conversation says it happened.
      if (step.toolCalls?.includes("apply_profile_ops") && step.day === 5) {
        profile = applyProfileOps(profile, [{ op: "set_preference", key: "hoursPerWeek", value: 10 }]);
        await conn.update(profiles).set({ data: profile, updatedAt: when }).where(eq(profiles.learnerId, learner.id));
      }
      continue;
    }
    const { event } = step;
    // Only events the live route would accept: items must be on the current path, skills must exist.
    if ("catalogId" in event) {
      const onPath = path.phases.some((p) => p.items.some((i) => i.catalogId === event.catalogId));
      if (!catalogIds.has(event.catalogId) || !onPath) {
        counts.skippedEvents.push(`${event.type}:${event.catalogId}`);
        continue;
      }
    } else if (!data.skills.some((s) => s.id === event.skillId)) {
      counts.skippedEvents.push(`${event.type}:${event.skillId}`);
      continue;
    }
    const [stored] = await conn.insert(feedbackEvents).values({ learnerId: learner.id, type: event.type, payload: event, createdAt: when }).returning();
    const result = applyFeedback(event, { profile, path, data, now: when.toISOString(), eventId: stored.id });
    profile = result.profile;
    path = result.path;
    await conn.update(profiles).set({ data: profile, updatedAt: when }).where(eq(profiles.learnerId, learner.id));
    if (result.replanned) {
      version += 1;
      latestPathId = (await conn.insert(paths).values({ learnerId: learner.id, version, data: path, diff: result.diff as PathDiff, createdAt: when }).returning())[0].id;
      counts.replans += 1;
    } else {
      await conn.update(paths).set({ data: path }).where(eq(paths.id, latestPathId));
    }
    counts.feedback += 1;
  }

  const items = path.phases.flatMap((p) => p.items);
  console.log(`Seeded "${DISPLAY_NAME}" for ${OWNER_EMAIL}`);
  console.log(`  learner  ${learner.id}`);
  console.log(`  chat     ${counts.chat} messages`);
  console.log(`  feedback ${counts.feedback} events, ${counts.replans} replans → path v${version}`);
  console.log(`  path     ${path.phases.length} phases, ${items.length} items, ${items.filter((i) => i.status === "done").length} done`);
  if (counts.skippedEvents.length) console.log(`  skipped  ${counts.skippedEvents.join(", ")} (not on the path at that point — adjust STORY)`);
  console.log(`  open     /learn/${learner.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
