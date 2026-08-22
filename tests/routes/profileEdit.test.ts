import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Path, PathDiff, Profile, SessionUser } from "@/schemas";
import { FIXTURE_LEARNERS } from "../fixtures/learners";

/**
 * PATCH /api/learners/:id/profile — the learner corrects their own profile from the drawer.
 * Ops apply through the same rules as Nova's; when a path exists it is redone against the
 * new profile and the diff says why, so the path view can explain the change.
 */

const OWNER: SessionUser = { id: "11111111-1111-4111-8111-111111111111", name: "Owner", email: "owner@example.com", image: null };
const LEARNER_ID = "33333333-3333-4333-8333-333333333333";
const learnerRow = { id: LEARNER_ID, userId: OWNER.id, displayName: "Priya", avatarSeed: "abc", createdAt: new Date("2026-08-01T00:00:00Z") };

const store = vi.hoisted(() => ({
  profile: null as Profile | null,
  paths: [] as { version: number; data: Path; diff: PathDiff | null }[],
}));

vi.mock("@/auth", () => ({ currentUser: async () => OWNER, auth: async () => null, signIn: async () => undefined, signOut: async () => undefined, handlers: {} }));

vi.mock("@/db/queries", () => ({
  getOwnedLearner: async (userId: string, learnerId: string) => (learnerId === learnerRow.id && userId === learnerRow.userId ? learnerRow : null),
  getProfile: async (learnerId: string) => (learnerId === LEARNER_ID ? store.profile : null),
  saveProfile: async (_id: string, data: Profile) => {
    store.profile = data;
  },
  getLatestPath: async () => {
    const last = store.paths.at(-1);
    return last ? { id: "p", version: last.version, data: last.data, diff: last.diff, createdAt: new Date() } : null;
  },
  insertPath: async (_id: string, data: Path, diff: PathDiff | null) => {
    const version = (store.paths.at(-1)?.version ?? 0) + 1;
    store.paths.push({ version, data, diff });
    return { id: `p${version}`, version };
  },
}));

async function patch(body: unknown) {
  const { PATCH } = await import("@/../app/api/learners/[learnerId]/profile/route");
  const req = new Request(`http://test/api/learners/${LEARNER_ID}/profile`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const res = await PATCH(req, { params: Promise.resolve({ learnerId: LEARNER_ID }) });
  return { status: res.status, body: await res.json() };
}

describe("PATCH /api/learners/:id/profile", () => {
  beforeEach(() => {
    store.profile = structuredClone(FIXTURE_LEARNERS["partial-skills-ml"]);
    store.paths = [];
  });

  it("applies the ops and returns no replan when the learner has no path yet", async () => {
    const { status, body } = await patch({ ops: [{ op: "set_preference", key: "hoursPerWeek", value: 12 }] });
    expect(status).toBe(200);
    expect(body.profile.preferences.hoursPerWeek).toBe(12);
    expect(body.replan).toBeNull();
    expect(store.paths).toHaveLength(0);
  });

  it("redoes the path against the edited profile and explains the change in the diff", async () => {
    const { generatePath } = await import("@/engine");
    const { loadEngineData } = await import("@/lib/engineData");
    const first = generatePath(store.profile!, loadEngineData(), { now: "2026-08-01T00:00:00Z", trigger: "initial" }).path;
    store.paths.push({ version: 1, data: first, diff: null });

    const { status, body } = await patch({
      ops: [
        { op: "set_skill", skillId: "ml-fundamentals", level: 3, source: "stated" },
        { op: "set_preference", key: "pace", value: "intense" },
      ],
    });
    expect(status).toBe(200);
    expect(body.profile.skills["ml-fundamentals"]).toEqual({ level: 3, source: "stated" });
    expect(body.replan.version).toBe(2);
    expect(body.replan.diff.cause.eventId).toMatch(/^profile-edit:/);
    expect(body.replan.diff.cause.humanReadable).toContain("1 skill level");
    expect(body.replan.diff.cause.humanReadable).toContain("pace");
    // The stored row carries the same diff, so the path history explains itself later.
    expect(store.paths.at(-1)?.diff).toEqual(body.replan.diff);
    // A skill raised to Strong drops what taught it.
    const items = (p: Path) => p.phases.flatMap((ph) => ph.items.map((i) => i.catalogId));
    expect(items(body.replan.path).length).toBeLessThan(items(first).length);
    expect(body.replan.diff.removed.length).toBeGreaterThan(0);
    expect(body.replan.diff.removed[0].reason).toContain("profile update");
  });

  it("rejects an empty batch", async () => {
    const { status } = await patch({ ops: [] });
    expect(status).toBe(400);
  });
});
