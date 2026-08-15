import { desc, eq } from "drizzle-orm";
import { db, learners, paths, profiles } from "./index";
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
