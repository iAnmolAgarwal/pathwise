import { desc, eq, sql } from "drizzle-orm";
import { chatMessages, db, learners, paths, profiles, tokenUsage } from "./index";
import type { Path, PathDiff, Profile } from "../schemas";

export async function createLearner(displayName: string, profile: Profile) {
  const avatarSeed = Math.random().toString(36).slice(2, 10);
  const [learner] = await db()
    .insert(learners)
    .values({ displayName, avatarSeed })
    .returning();
  await db().insert(profiles).values({ learnerId: learner.id, data: profile });
  return learner;
}

export async function listLearners() {
  return db().select().from(learners).orderBy(desc(learners.createdAt));
}

export async function getLearner(learnerId: string) {
  const [learner] = await db().select().from(learners).where(eq(learners.id, learnerId));
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
): Promise<{ version: number; data: Path; diff: PathDiff | null; createdAt: Date } | null> {
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

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: { text: string; toolCalls?: string[]; degraded?: boolean };
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

/** Judge-mode metering (§8.4): one row per learner per UTC day, incremented per response. */
export async function addTokenUsage(learnerId: string, inputTokens: number, outputTokens: number) {
  const day = new Date().toISOString().slice(0, 10);
  await db()
    .insert(tokenUsage)
    .values({ learnerId, day, inputTokens, outputTokens })
    .onConflictDoUpdate({
      target: [tokenUsage.learnerId, tokenUsage.day],
      set: {
        inputTokens: sql`${tokenUsage.inputTokens} + ${inputTokens}`,
        outputTokens: sql`${tokenUsage.outputTokens} + ${outputTokens}`,
      },
    });
}
