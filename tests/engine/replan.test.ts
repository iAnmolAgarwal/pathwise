import { describe, expect, it } from "vitest";
import { generatePath } from "@/engine";
import { applyFeedback, diffPaths, feedbackRule, levelFromScore } from "@/engine/replan";
import { loadEngineData } from "@/lib/engineData";
import type { FeedbackEvent, Path, Profile } from "@/schemas";
import { FIXTURE_LEARNERS } from "../fixtures/learners";

const NOW = "2026-08-15T00:00:00.000Z";
const data = loadEngineData();
const catalog = new Map(data.catalog.map((c) => [c.id, c]));

function pathFor(profile: Profile): Path {
  return generatePath(profile, data, { now: NOW, trigger: "initial" }).path;
}
const items = (path: Path) => path.phases.flatMap((p) => p.items);
const ids = (path: Path) => items(path).map((i) => i.catalogId);
const statusOf = (path: Path, id: string) => items(path).find((i) => i.catalogId === id)?.status;

function feedback(profile: Profile, path: Path, event: FeedbackEvent) {
  return applyFeedback(event, { profile, path, data, now: NOW, eventId: "evt-1" });
}

describe("feedbackRule (§5.5 event table)", () => {
  const profile = FIXTURE_LEARNERS["beginner-frontend"];
  const path = pathFor(profile);

  it("completed: taught skills become inferred at the taught level, item done, replan only if changed", () => {
    const rule = feedbackRule({ type: "completed", catalogId: "mdn-learn" }, profile, path, data);
    const taught = catalog.get("mdn-learn")!.skillsTaught;
    expect(rule.ops).toEqual(taught.map((t) => ({ op: "set_skill", skillId: t.skillId, level: t.level, source: "inferred" })));
    expect(rule.statusUpdates).toEqual([{ catalogId: "mdn-learn", status: "done" }]);
    expect(rule.policy).toBe("if-shortcut");
    expect(rule.cause).toBe("You completed MDN Learn Web Development");
  });

  it("completed never lowers a level the learner already has", () => {
    // Same path, but the learner has since claimed html at 3 — completing the item must not pull it down.
    const p: Profile = { ...profile, skills: { html: { level: 3, source: "stated" } } };
    const rule = feedbackRule({ type: "completed", catalogId: "mdn-learn" }, p, path, data);
    expect(rule.ops.find((o) => o.op === "set_skill" && o.skillId === "html")).toBeUndefined();
  });

  it("too_hard: each required skill drops one inferred level (floor 0), always replans", () => {
    const p = FIXTURE_LEARNERS["partial-skills-ml"]; // ml-fundamentals: 1
    const rule = feedbackRule({ type: "too_hard", catalogId: "kaggle-intermediate-ml" }, p, pathFor(p), data);
    expect(rule.ops).toEqual([{ op: "set_skill", skillId: "ml-fundamentals", level: 0, source: "inferred" }]);
    expect(rule.statusUpdates).toEqual([]);
    expect(rule.policy).toBe("always");
    expect(rule.cause).toMatch(/too hard$/);
  });

  it("too_hard on an item whose requirements are already at 0 changes nothing but still explains", () => {
    // Picked from the generated path, so the case survives catalog growth: every required skill absent from the profile.
    const zeroed = items(path).find((i) => {
      const item = data.catalog.find((c) => c.id === i.catalogId)!;
      return item.skillsRequired.length > 0 && item.skillsRequired.every((r) => (profile.skills[r.skillId]?.level ?? 0) === 0);
    });
    expect(zeroed).toBeDefined();
    const rule = feedbackRule({ type: "too_hard", catalogId: zeroed!.catalogId }, profile, path, data);
    expect(rule.ops).toEqual([]);
    expect(rule.policy).toBe("always");
  });

  it("too_easy: taught skills gain one inferred level (cap 3), item skipped, always replans", () => {
    const p: Profile = { ...profile, skills: { css: { level: 3, source: "stated" } } };
    const rule = feedbackRule({ type: "too_easy", catalogId: "mdn-learn" }, p, pathFor(p), data);
    const bySkill = Object.fromEntries(rule.ops.map((o) => (o.op === "set_skill" ? [o.skillId, o.level] : ["?", 0])));
    expect(bySkill.html).toBe(3); // taught 2 → +1
    expect(bySkill.css).toBeUndefined(); // already at cap
    expect(bySkill["programming-basics"]).toBe(2);
    expect(rule.statusUpdates).toEqual([{ catalogId: "mdn-learn", status: "skipped" }]);
    expect(rule.policy).toBe("always");
    expect(rule.cause).toBe("You found MDN Learn Web Development too easy");
  });

  it("not_interested: avoid memo with provider and format, always replans", () => {
    const rule = feedbackRule({ type: "not_interested", catalogId: "mdn-learn" }, profile, path, data);
    expect(rule.ops).toEqual([{ op: "avoid", catalogId: "mdn-learn", provider: "MDN (Mozilla)", format: "text" }]);
    expect(rule.policy).toBe("always");
    expect(rule.cause).toBe("You're not interested in MDN Learn Web Development");
  });

  it("quiz_result: assessed level from score, replan only if the gap changed", () => {
    const rule = feedbackRule({ type: "quiz_result", skillId: "javascript", score: 90 }, profile, path, data);
    expect(rule.ops).toEqual([{ op: "set_skill", skillId: "javascript", level: 3, source: "assessed" }]);
    expect(rule.policy).toBe("if-gap-changed");
    expect(rule.cause).toBe("You scored 90% on the JavaScript check");
  });

  it("maps quiz scores onto levels 0-3 in fixed bands", () => {
    expect([0, 34, 35, 59, 60, 84, 85, 100].map(levelFromScore)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("rejects an item that is not on the path", () => {
    expect(() => feedbackRule({ type: "completed", catalogId: "nope" }, profile, path, data)).toThrow(/not on the current path/);
  });
});

describe("applyFeedback end to end", () => {
  const profile = FIXTURE_LEARNERS["beginner-frontend"];
  const path = pathFor(profile);

  it("too_easy skips the item, keeps it on the path as skipped, and drops now-covered items from the diff", () => {
    const r = feedback(profile, path, { type: "too_easy", catalogId: "mdn-learn" });
    expect(r.replanned).toBe(true);
    expect(r.profile.skills.html).toEqual({ level: 3, source: "inferred" });
    expect(statusOf(r.path, "mdn-learn")).toBe("skipped");
    expect(r.diff!.removed.map((d) => d.catalogId)).not.toContain("mdn-learn");
    expect(r.diff!.cause).toEqual({ eventId: "evt-1", humanReadable: "You found MDN Learn Web Development too easy" });
    expect(r.path.meta.trigger).toBe("replan");
  });

  it("not_interested removes the item and replaces it with something else", () => {
    const r = feedback(profile, path, { type: "not_interested", catalogId: "mdn-learn" });
    expect(r.replanned).toBe(true);
    expect(ids(r.path)).not.toContain("mdn-learn");
    expect(r.diff!.removed.map((d) => d.catalogId)).toContain("mdn-learn");
    expect(r.diff!.added.length).toBeGreaterThan(0);
    for (const a of r.diff!.added) expect(a.reason).toMatch(/\w/);
  });

  it("too_hard reopens the gap and inserts remediation for the dropped skill", () => {
    const p = FIXTURE_LEARNERS["partial-skills-ml"];
    const before = pathFor(p);
    const r = feedback(p, before, { type: "too_hard", catalogId: "kaggle-intermediate-ml" });
    expect(r.replanned).toBe(true);
    expect(r.profile.skills["ml-fundamentals"]).toEqual({ level: 0, source: "inferred" });
    expect(statusOf(r.path, "kaggle-intermediate-ml")).toBe("todo");
    expect(r.diff!.cause.humanReadable).toBe("You found Kaggle Learn: Intermediate Machine Learning too hard");
    // The reopened skill must now be taught before the item that assumed it.
    const item = items(r.path).find((i) => i.catalogId === "kaggle-intermediate-ml")!;
    expect(item.evidence.sequencedAfter.some((s) => s.becauseSkill === "ml-fundamentals")).toBe(true);
  });

  it("completed marks the item done and replans only when it unlocks a shortcut (something dropped)", () => {
    const r = feedback(profile, path, { type: "completed", catalogId: "linux-journey" });
    expect(statusOf(r.path, "linux-journey")).toBe("done");
    expect(r.profile.skills["command-line"]).toEqual({ level: 2, source: "inferred" });
    if (r.replanned) {
      expect(r.diff!.removed.map((d) => d.catalogId)).not.toContain("linux-journey");
      expect(r.diff!.removed.length).toBeGreaterThan(0);
    } else {
      expect(r.diff).toBeNull();
      expect(ids(r.path)).toEqual(ids(path));
    }
  });

  it("completed replans only when it drops a now-redundant open item; a full run ends all done", () => {
    let p = profile;
    let current = path;
    for (let guard = 0; guard < 60; guard++) {
      const next = items(current).find((i) => i.status === "todo");
      if (!next) break;
      const openBefore = new Set(items(current).filter((i) => i.status === "todo").map((i) => i.catalogId));
      const r = feedback(p, current, { type: "completed", catalogId: next.catalogId });
      if (r.replanned) {
        // A completion may only replan by removing open items its new levels made redundant.
        expect(r.diff!.removed.length).toBeGreaterThan(0);
        for (const removed of r.diff!.removed) expect(openBefore.has(removed.catalogId)).toBe(true);
      } else {
        expect(r.diff).toBeNull();
      }
      p = r.profile;
      current = r.path;
    }
    expect(items(current).every((i) => i.status === "done")).toBe(true);
  });

  it("quiz_result that does not change the gap updates the profile without replanning", () => {
    const p: Profile = { ...profile, skills: { javascript: { level: 2, source: "stated" } } };
    const before = pathFor(p);
    const r = feedback(p, before, { type: "quiz_result", skillId: "javascript", score: 70 });
    expect(r.profile.skills.javascript).toEqual({ level: 2, source: "assessed" });
    expect(r.replanned).toBe(false);
    expect(r.diff).toBeNull();
    expect(ids(r.path)).toEqual(ids(before));
  });

  it("quiz_result that closes a gap skill replans", () => {
    const r = feedback(profile, path, { type: "quiz_result", skillId: "javascript", score: 95 });
    expect(r.replanned).toBe(true);
    expect(r.diff!.cause.humanReadable).toBe("You scored 95% on the JavaScript check");
  });

  it("does not mutate its inputs", () => {
    const p0 = structuredClone(profile);
    const path0 = structuredClone(path);
    feedback(profile, path, { type: "too_easy", catalogId: "mdn-learn" });
    expect(profile).toEqual(p0);
    expect(path).toEqual(path0);
  });
});

describe("diffPaths", () => {
  const profile = FIXTURE_LEARNERS["beginner-frontend"];
  const a = pathFor(profile);
  const b = pathFor({ ...profile, dislikes: { catalogIds: ["mdn-learn"], providers: [], formats: [] } });
  const cause = { eventId: "e", humanReadable: "test" };
  const reasons = { added: () => "added", removed: () => "removed" };

  it("is symmetric: added one way is removed the other", () => {
    const ab = diffPaths(a, b, cause, reasons);
    const ba = diffPaths(b, a, cause, reasons);
    expect(ab.added.map((x) => x.catalogId).sort()).toEqual(ba.removed.map((x) => x.catalogId).sort());
    expect(ab.removed.map((x) => x.catalogId).sort()).toEqual(ba.added.map((x) => x.catalogId).sort());
    expect(ab.reordered).toBe(ba.reordered);
  });

  it("is empty against itself", () => {
    expect(diffPaths(a, a, cause, reasons)).toEqual({ added: [], removed: [], reordered: false, cause });
  });

  it("ignores done and skipped items and detects reordering of the rest", () => {
    const withDone: Path = structuredClone(a);
    withDone.phases[0].items[0].status = "done";
    expect(diffPaths(a, withDone, cause, reasons).removed).toEqual([]);
    const swapped: Path = structuredClone(a);
    const [x, y] = swapped.phases[0].items;
    swapped.phases[0].items = [y, x];
    expect(diffPaths(a, swapped, cause, reasons)).toMatchObject({ added: [], removed: [], reordered: true });
  });
});
