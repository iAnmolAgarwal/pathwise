import { eq } from "drizzle-orm";
import { db, chatMessages, feedbackEvents, learners, paths, profiles, tokenUsage, users } from "../src/db";
import { generatePath } from "../src/engine";
import { applyProfileOps } from "../src/engine/profile";
import { applyFeedback } from "../src/engine/replan";
import { DEMO_CARD_ANSWER, DEMO_HOURS_OPS, DEMO_OPENING_OPS, DEMO_STORY, demoAt } from "../src/lib/demoStory";
import { loadEngineData } from "../src/lib/engineData";
import { buildProfileCard } from "../src/lib/profileCard";
import type { Path, PathDiff, Profile } from "../src/schemas";

const DISPLAY_NAME = process.argv[3] ?? "Alex";
const OWNER_EMAIL = process.argv[2];
if (!OWNER_EMAIL) {
  console.error("usage: seed-demo.ts <owner-email> [display name]");
  process.exit(1);
}

/** The story itself lives in src/lib/demoStory.ts so the landing page can replay it without a database. */
const at = demoAt;

async function main() {
  const data = loadEngineData();
  const catalogIds = new Set(data.catalog.map((c) => c.id));
  const conn = db();

  const [owner] = await conn.select().from(users).where(eq(users.email, OWNER_EMAIL));
  if (!owner) throw new Error(`No user with email ${OWNER_EMAIL} — sign in once first`);

  // Replace any previous copy so the script is safe to re-run.
  const existing = await conn.select().from(learners).where(eq(learners.displayName, DISPLAY_NAME));
  for (const row of existing.filter((l) => l.userId === owner.id)) {
    await conn.delete(tokenUsage).where(eq(tokenUsage.learnerId, row.id));
    await conn.delete(chatMessages).where(eq(chatMessages.learnerId, row.id));
    await conn.delete(feedbackEvents).where(eq(feedbackEvents.learnerId, row.id));
    await conn.delete(paths).where(eq(paths.learnerId, row.id));
    await conn.delete(profiles).where(eq(profiles.learnerId, row.id));
    await conn.delete(learners).where(eq(learners.id, row.id));
  }

  // Day 41: goal + the levels Nova inferred from the first message, then the levels the learner corrected on the card.
  let profile: Profile = applyProfileOps({ goals: [], skills: {}, preferences: { hoursPerWeek: 6, formats: [], budget: "any", pace: "standard" } }, DEMO_OPENING_OPS);
  const card = buildProfileCard("seed-card", profile, data);
  if ("error" in card) throw new Error(card.error);
  profile = applyProfileOps(profile, DEMO_CARD_ANSWER);

  const [learner] = await conn
    .insert(learners)
    .values({ userId: owner.id, displayName: DISPLAY_NAME, avatarSeed: "demo-alex", createdAt: at(41, 19) })
    .returning();
  await conn.insert(profiles).values({ learnerId: learner.id, data: profile, updatedAt: at(41, 19, 6) });

  const first = generatePath(profile, data, { now: at(41, 19, 7).toISOString(), trigger: "initial" });
  let path: Path = first.path;
  let version = 1;
  let latestPathId = (await conn.insert(paths).values({ learnerId: learner.id, version, data: path, diff: null, createdAt: at(41, 19, 7) }).returning())[0].id;

  const counts = { chat: 0, feedback: 0, replans: 0, skippedEvents: [] as string[] };
  for (const step of DEMO_STORY) {
    const when = at(step.day, 20, step.minute ?? 0);
    if (step.kind === "chat") {
      const content: { text: string; toolCalls?: string[]; card?: typeof card } = { text: step.text };
      if (step.toolCalls) content.toolCalls = step.toolCalls;
      if (step.card) content.card = card;
      await conn.insert(chatMessages).values({ learnerId: learner.id, role: step.role, content, createdAt: when });
      counts.chat += 1;
      // The hours change on day 5 is a real profile op, applied where the conversation says it happened.
      if (step.toolCalls?.includes("apply_profile_ops") && step.day === 5) {
        profile = applyProfileOps(profile, DEMO_HOURS_OPS);
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
  if (counts.skippedEvents.length) console.log(`  skipped  ${counts.skippedEvents.join(", ")} (not on the path at that point — adjust DEMO_STORY)`);
  console.log(`  open     /learn/${learner.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
