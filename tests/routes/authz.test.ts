import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/schemas";

/**
 * Route-level authorisation (§19): no session → 401 on every learner-scoped route and a
 * redirect on every /learn page; another user's learner → 404 (never 403); the owner → 200.
 * Auth.js and the database are replaced at the module boundary so the handlers run as-is.
 */

const OWNER: SessionUser = { id: "11111111-1111-4111-8111-111111111111", name: "Owner", email: "owner@example.com", image: null };
const STRANGER: SessionUser = { id: "22222222-2222-4222-8222-222222222222", name: "Stranger", email: "stranger@example.com", image: null };
const LEARNER_ID = "33333333-3333-4333-8333-333333333333";
const learnerRow = { id: LEARNER_ID, userId: OWNER.id, displayName: "Priya", avatarSeed: "abc", createdAt: new Date("2026-08-01T00:00:00Z") };

const state = { user: null as SessionUser | null };

vi.mock("@/auth", () => ({
  currentUser: async () => state.user,
  auth: async () => null,
  signIn: async () => undefined,
  signOut: async () => undefined,
  handlers: {},
}));

const queries = vi.hoisted(() => ({
  created: [] as { userId: string; displayName: string }[],
}));

vi.mock("@/db/queries", async () => {
  const { defaultProfile } = await import("@/engine/profile");
  return {
    // Ownership is decided here, exactly as the real query does: the row must match both id and user.
    getOwnedLearner: async (userId: string, learnerId: string) =>
      learnerId === learnerRow.id && userId === learnerRow.userId ? learnerRow : null,
    listLearners: async (userId: string) => (userId === OWNER.id ? [learnerRow] : []),
    createLearner: async (userId: string, displayName: string) => {
      queries.created.push({ userId, displayName });
      return { ...learnerRow, id: "44444444-4444-4444-8444-444444444444", userId, displayName };
    },
    getProfile: async (learnerId: string) => (learnerId === LEARNER_ID ? defaultProfile() : null),
    getLatestPath: async () => null,
    listFeedbackDays: async () => [],
    listActivityDays: async () => [],
    listChatMessages: async () => [],
    insertChatMessage: async () => ({ id: "m" }),
    addTokenUsage: async () => undefined,
  };
});

const redirects: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirects.push(url);
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

function json(body: unknown, url = "http://localhost/api/x") {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
const ctx = (learnerId: string) => ({ params: Promise.resolve({ learnerId }) });

beforeEach(() => {
  state.user = null;
  redirects.length = 0;
  queries.created.length = 0;
});

describe("requireLearner", () => {
  it("answers 401 with nobody signed in, 404 for a stranger, and the learner for its owner", async () => {
    const { requireLearner } = await import("@/lib/authz");
    let r = await requireLearner(LEARNER_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);

    state.user = STRANGER;
    r = await requireLearner(LEARNER_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(404);

    state.user = OWNER;
    r = await requireLearner(LEARNER_ID);
    expect(r.ok && r.learner.id).toBe(LEARNER_ID);
  });

  it("treats a malformed id and an unknown id the same way as someone else's: 404", async () => {
    const { requireLearner } = await import("@/lib/authz");
    state.user = OWNER;
    for (const id of ["not-a-uuid", "55555555-5555-4555-8555-555555555555"]) {
      const r = await requireLearner(id);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.response.status).toBe(404);
    }
  });

  it("only returns same-origin paths as a sign-in callback", async () => {
    const { safeCallbackUrl, signInUrl } = await import("@/lib/authz");
    expect(safeCallbackUrl(undefined)).toBe("/learn");
    expect(safeCallbackUrl("https://evil.example")).toBe("/learn");
    expect(safeCallbackUrl("//evil.example")).toBe("/learn");
    expect(safeCallbackUrl(`/learn/${LEARNER_ID}`)).toBe(`/learn/${LEARNER_ID}`);
    expect(signInUrl("/learn/x?tab=path")).toBe("/sign-in?callbackUrl=%2Flearn%2Fx%3Ftab%3Dpath");
  });
});

describe("/api/learners", () => {
  it("lists nothing and creates nothing without a session", async () => {
    const route = await import("@/../app/api/learners/route");
    expect((await route.GET()).status).toBe(401);
    expect((await route.POST(json({ displayName: "Priya" }))).status).toBe(401);
    expect(queries.created).toEqual([]);
  });

  it("lists only the caller's learners and stamps new ones with the caller", async () => {
    const route = await import("@/../app/api/learners/route");
    state.user = STRANGER;
    expect(await (await route.GET()).json()).toEqual([]);
    state.user = OWNER;
    const list = await (await route.GET()).json();
    expect(list.map((l: { id: string }) => l.id)).toEqual([LEARNER_ID]);

    const created = await route.POST(json({ displayName: "Arjun" }));
    expect(created.status).toBe(201);
    expect(queries.created).toEqual([{ userId: OWNER.id, displayName: "Arjun" }]);
  });
});

describe("learner-scoped GET routes", () => {
  const cases = [
    ["profile", () => import("@/../app/api/learners/[learnerId]/profile/route")],
    ["path", () => import("@/../app/api/path/[learnerId]/route")],
    ["dashboard", () => import("@/../app/api/dashboard/[learnerId]/route")],
  ] as const;

  for (const [name, load] of cases) {
    it(`${name}: 401 signed out, 404 for a stranger, 2xx for the owner`, async () => {
      const route = await load();
      const req = new Request(`http://localhost/api/${name}/${LEARNER_ID}`);
      expect((await route.GET(req, ctx(LEARNER_ID))).status).toBe(401);
      state.user = STRANGER;
      expect((await route.GET(req, ctx(LEARNER_ID))).status).toBe(404);
      state.user = OWNER;
      const res = await route.GET(req, ctx(LEARNER_ID));
      // The path route legitimately 404s when no path exists yet; that is the owner's own 404.
      expect(name === "path" ? [200, 404] : [200]).toContain(res.status);
      if (name === "path") expect((await res.json()).error).toBe("No path generated yet");
    });
  }
});

describe("learner-scoped POST routes", () => {
  it("path/generate and feedback refuse signed-out and stranger calls before touching state", async () => {
    const generate = await import("@/../app/api/path/generate/route");
    const feedback = await import("@/../app/api/feedback/route");
    const event = { type: "not_interested", catalogId: "x" };
    expect((await generate.POST(json({ learnerId: LEARNER_ID }))).status).toBe(401);
    expect((await feedback.POST(json({ learnerId: LEARNER_ID, event }))).status).toBe(401);
    state.user = STRANGER;
    expect((await generate.POST(json({ learnerId: LEARNER_ID }))).status).toBe(404);
    expect((await feedback.POST(json({ learnerId: LEARNER_ID, event }))).status).toBe(404);
    state.user = OWNER;
    // Past the gate: the owner gets the route's own answer (no goal yet → 409; no path yet → 409).
    expect((await generate.POST(json({ learnerId: LEARNER_ID }))).status).toBe(409);
    expect((await feedback.POST(json({ learnerId: LEARNER_ID, event }))).status).toBe(409);
  });

  it("chat refuses before opening a stream", async () => {
    const chat = await import("@/../app/api/chat/route");
    expect((await chat.POST(json({ learnerId: LEARNER_ID, message: "hi" }))).status).toBe(401);
    state.user = STRANGER;
    expect((await chat.POST(json({ learnerId: LEARNER_ID, message: "hi" }))).status).toBe(404);
  });
});

describe("/learn pages", () => {
  it("send a signed-out visitor to sign-in and bring them back to the same URL", async () => {
    const picker = await import("@/../app/learn/page");
    await expect(picker.default()).rejects.toThrow("REDIRECT");
    expect(redirects.at(-1)).toBe("/sign-in?callbackUrl=%2Flearn");

    const workspace = await import("@/../app/learn/[learnerId]/page");
    await expect(workspace.default({ params: Promise.resolve({ learnerId: LEARNER_ID }), searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT");
    expect(redirects.at(-1)).toBe(`/sign-in?callbackUrl=%2Flearn%2F${LEARNER_ID}`);
  });

  it("hide another user's learner behind a 404 and open the owner's", async () => {
    const workspace = await import("@/../app/learn/[learnerId]/page");
    const props = { params: Promise.resolve({ learnerId: LEARNER_ID }), searchParams: Promise.resolve({}) };
    state.user = STRANGER;
    await expect(workspace.default(props)).rejects.toThrow("NOT_FOUND");
    state.user = OWNER;
    const element = await workspace.default(props);
    expect(element.props.learnerId).toBe(LEARNER_ID);
    expect(element.props.user).toEqual(OWNER);
  });

  it("jumps straight into the only learner from the picker", async () => {
    const picker = await import("@/../app/learn/page");
    state.user = OWNER;
    await expect(picker.default()).rejects.toThrow("REDIRECT");
    expect(redirects.at(-1)).toBe(`/learn/${LEARNER_ID}`);
  });
});
