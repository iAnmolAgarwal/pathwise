import type { ProfileCard } from "@/schemas/profileCard";
import { and, desc, eq, sql } from "drizzle-orm";
import { chatMessages, db, feedbackEvents, learners, paths, profiles, tokenUsage } from "./index";
import type { FeedbackEvent, Path, PathDiff, Profile } from "../schemas";

export async function createLearner(userId: string, displayName: string, profile: Profile) {
  const avatarSeed = Math.random().toString(36).slice(2, 10);
  const [learner] = await db()
    .insert(learners)
    .values({ userId, displayName, avatarSeed })
    .returning();
  await db().insert(profiles).values({ learnerId: learner.id, data: profile });
  return learner;
}

/** The learners one user owns, newest first — the picker's list. */
export async function listLearners(userId: string) {
  return db().select().from(learners).where(eq(learners.userId, userId)).orderBy(desc(learners.createdAt));
}

/**
 * A learner only if this user owns it. A learner that exists but belongs to someone else
 * comes back null, exactly like a missing one, so callers cannot tell the two apart (§19).
 */
export async function getOwnedLearner(userId: string, learnerId: string) {
  const [learner] = await db()
    .select()
    .from(learners)
    .where(and(eq(learners.id, learnerId), eq(learners.userId, userId)));
  return learner ?? null;
}

export async function getProfile(learnerId: string): Promise<Profile | null> {
  const [row] = await db().select().from(profiles).where(eq(profiles.learnerId, learnerId));
  return row?.data ?? null;
}

export async function saveProfile(learnerId: string, data: Profile) {
  await db()
    .update(profiles)
    .set({ data, updatedAt: new Date() })
    .where(eq(profiles.learnerId, learnerId));
}

export async function getLatestPath(
  learnerId: string,
): Promise<{ id: string; version: number; data: Path; diff: PathDiff | null; createdAt: Date } | null> {
  const [row] = await db()
    .select()
    .from(paths)
    .where(eq(paths.learnerId, learnerId))
    .orderBy(desc(paths.version))
    .limit(1);
  return row ?? null;
}

export async function insertPath(learnerId: string, data: Path, diff: PathDiff | null) {
  const latest = await getLatestPath(learnerId);
  const version = (latest?.version ?? 0) + 1;
  const [row] = await db()
    .insert(paths)
    .values({ learnerId, version, data, diff })
    .returning();
  return row;
}

/** Item status changes that did not trigger a new version are written onto the current one. */
export async function updatePathData(pathId: string, data: Path) {
  await db().update(paths).set({ data }).where(eq(paths.id, pathId));
}

/** Append-only feedback stream (§4.2); the row id becomes the PathDiff cause.eventId. */
export async function insertFeedbackEvent(learnerId: string, event: FeedbackEvent) {
  const [row] = await db()
    .insert(feedbackEvents)
    .values({ learnerId, type: event.type, payload: event })
    .returning();
  return row;
}

/** Distinct UTC days with feedback activity, oldest first — the streak's raw material. */
export async function listFeedbackDays(learnerId: string): Promise<string[]> {
  const rows = await db()
    .select({ day: sql<string>`to_char(${feedbackEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')` })
    .from(feedbackEvents)
    .where(eq(feedbackEvents.learnerId, learnerId));
  return [...new Set(rows.map((r) => r.day))].sort();
}

/** UTC dates with at least one chat message — the dashboard's activity calendar counts talking to Nova as a day worked. */
export async function listChatDays(learnerId: string): Promise<string[]> {
  const rows = await db()
    .select({ day: sql<string>`to_char(${chatMessages.createdAt} at time zone 'UTC', 'YYYY-MM-DD')` })
    .from(chatMessages)
    .where(eq(chatMessages.learnerId, learnerId));
  return [...new Set(rows.map((r) => r.day))].sort();
}

/** Feedback days ∪ chat days, sorted, for the streak and the activity calendar. */
export async function listActivityDays(learnerId: string): Promise<string[]> {
  const [feedback, chat] = await Promise.all([listFeedbackDays(learnerId), listChatDays(learnerId)]);
  return [...new Set([...feedback, ...chat])].sort();
}

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: { text: string; toolCalls?: string[]; degraded?: boolean; card?: ProfileCard };
  createdAt: Date;
};

/** Oldest-first list of the most recent `limit` messages. */
export async function listChatMessages(learnerId: string, limit = 40): Promise<StoredChatMessage[]> {
  const rows = await db()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.learnerId, learnerId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse().map((r) => ({
    id: r.id,
    role: r.role as StoredChatMessage["role"],
    content: r.content as StoredChatMessage["content"],
    createdAt: r.createdAt,
  }));
}

export async function insertChatMessage(
  learnerId: string,
  role: StoredChatMessage["role"],
  content: StoredChatMessage["content"],
) {
  const [row] = await db().insert(chatMessages).values({ learnerId, role, content }).returning();
  return row;
}

/** Judge-mode metering (§8.4): one row per learner per UTC day, incremented per response, stamped with the owner. */
export async function addTokenUsage(learnerId: string, userId: string, inputTokens: number, outputTokens: number) {
  const day = new Date().toISOString().slice(0, 10);
  await db()
    .insert(tokenUsage)
    .values({ learnerId, userId, day, inputTokens, outputTokens })
    .onConflictDoUpdate({
      target: [tokenUsage.learnerId, tokenUsage.day],
      set: {
        inputTokens: sql`${tokenUsage.inputTokens} + ${inputTokens}`,
        outputTokens: sql`${tokenUsage.outputTokens} + ${outputTokens}`,
        userId,
      },
    });
}
