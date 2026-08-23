import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/schemas";

/**
 * Judge mode at the route boundary (§8.4): once a user's daily budget is spent, /api/chat
 * streams a degradation and parks Nova without calling the model, and /api/explain still
 * returns the structural evidence with `narration: null`.
 */

const OWNER: SessionUser = { id: "11111111-1111-4111-8111-111111111111", name: "Owner", email: "owner@example.com", image: null };
const LEARNER_ID = "33333333-3333-4333-8333-333333333333";
const learnerRow = { id: LEARNER_ID, userId: OWNER.id, displayName: "Priya", avatarSeed: "abc", createdAt: new Date("2026-08-01T00:00:00Z") };

const meter = vi.hoisted(() => ({ userUsed: 0, globalUsed: 0, recorded: [] as number[], chatInserts: 0 }));
const model = vi.hoisted(() => ({ calls: 0 }));

vi.mock("@/auth", () => ({
  currentUser: async () => OWNER,
  auth: async () => null,
  signIn: async () => undefined,
  signOut: async () => undefined,
  handlers: {},
}));

vi.mock("@/db/queries", async () => {
  const { defaultProfile } = await import("@/engine/profile");
  return {
    getOwnedLearner: async (userId: string, learnerId: string) => (learnerId === learnerRow.id && userId === learnerRow.userId ? learnerRow : null),
    getProfile: async () => defaultProfile(),
    getLatestPath: async () => null,
    listActivityDays: async () => [],
    listChatMessages: async () => [],
    insertChatMessage: async () => {
      meter.chatInserts += 1;
      return { id: "m" };
    },
    addTokenUsage: async (_l: string, _u: string, input: number, output: number) => {
      meter.recorded.push(input + output);
    },
    sumTokenUsageForUser: async () => meter.userUsed,
    sumTokenUsageGlobal: async () => meter.globalUsed,
  };
});

vi.mock("@/llm/client", () => ({
  llm: () => {
    model.calls += 1;
    throw new Error("the model must not be called when the budget is spent");
  },
}));

function json(body: unknown) {
  return new Request("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function readEvents(res: Response) {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((chunk) => chunk.includes("data:"))
    .map((chunk) => JSON.parse(chunk.split("\n").find((l) => l.startsWith("data:"))!.slice(5)));
}

beforeEach(() => {
  meter.userUsed = 0;
  meter.globalUsed = 0;
  meter.recorded = [];
  meter.chatInserts = 0;
  model.calls = 0;
  process.env.JUDGE_USER_DAILY_TOKENS = "1000";
  process.env.JUDGE_GLOBAL_DAILY_TOKENS = "5000";
});

describe("/api/chat over budget", () => {
  it("streams the budget degradation and rests Nova without calling the model", async () => {
    vi.resetModules();
    meter.userUsed = 1000;
    const route = await import("@/../app/api/chat/route");
    const res = await route.POST(json({ learnerId: LEARNER_ID, message: "hello" }));
    expect(res.status).toBe(200);
    const events = await readEvents(res);
    expect(events.map((e) => e.type)).toEqual(["degraded", "nova_state", "done"]);
    expect(events[0].degradation.reason).toBe("budget");
    expect(events[1].state).toBe("resting");
    expect(model.calls).toBe(0);
    expect(meter.recorded).toEqual([]);
  });

  it("parks everyone when the global cap is reached, whatever the user has spent", async () => {
    vi.resetModules();
    meter.globalUsed = 5000;
    const route = await import("@/../app/api/chat/route");
    const events = await readEvents(await route.POST(json({ learnerId: LEARNER_ID, message: "hello" })));
    expect(events[0].type).toBe("degraded");
    expect(model.calls).toBe(0);
  });
});

describe("/api/explain over budget", () => {
  it("returns the evidence with no narration", async () => {
    vi.resetModules();
    meter.userUsed = 1000;
    // A path with one item is needed for the lookup; stub the latest path for this case.
    const queries = await import("@/db/queries");
    const { generatePath } = await import("@/engine");
    const { loadEngineData } = await import("@/lib/engineData");
    const { defaultProfile } = await import("@/engine/profile");
    const profile = { ...defaultProfile(), goals: [{ type: "role" as const, templateId: "frontend-developer" }] };
    const { path } = generatePath(profile, loadEngineData(), { now: "2026-08-23T00:00:00Z", trigger: "initial" });
    vi.spyOn(queries, "getLatestPath").mockResolvedValue({ version: 1, data: path } as never);
    const catalogId = path.phases[0].items[0].catalogId;

    const route = await import("@/../app/api/explain/route");
    const res = await route.POST(json({ learnerId: LEARNER_ID, catalogId }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.narration).toBeNull();
    expect(body.degraded.reason).toBe("budget");
    expect(body.evidence.catalogId).toBe(catalogId);
    expect(model.calls).toBe(0);
  });
});
