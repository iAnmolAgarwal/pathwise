import { describe, expect, it } from "vitest";
import { ProfileCardAnswerSchema, ProfileCardSchema, type Profile } from "@/schemas";
import { buildProfileCard, profileCardAnswerToOps, profileCardFollowUp, relevantSkillsForGoal } from "@/lib/profileCard";
import { loadEngineData } from "@/lib/engineData";
import { FIXTURE_LEARNERS } from "./fixtures/learners";

const data = loadEngineData();
const beginner: Profile = FIXTURE_LEARNERS["beginner-frontend"];

describe("relevantSkillsForGoal", () => {
  it("returns the goal's skills plus their prerequisite closure, sorted by domain then name", () => {
    const template = data.goals.find((g) => g.id === "frontend-developer")!;
    const skills = relevantSkillsForGoal(template.requiredSkills, data.skills);
    const ids = new Set(skills.map((s) => s.id));
    for (const r of template.requiredSkills) expect(ids.has(r.skillId)).toBe(true);
    for (const s of skills) for (const p of s.prereqs) expect(ids.has(p)).toBe(true);
    const keys = skills.map((s) => `${s.domain}|${s.name}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("ignores unknown skill ids", () => {
    expect(relevantSkillsForGoal([{ skillId: "nope" }], data.skills)).toEqual([]);
  });
});

describe("buildProfileCard", () => {
  it("builds a schema-valid card for a role goal, seeded with current levels", () => {
    const profile: Profile = { ...beginner, skills: { html: { level: 1, source: "inferred" } } };
    const card = buildProfileCard("card-1", profile, data);
    expect("error" in card).toBe(false);
    if ("error" in card) return;
    expect(ProfileCardSchema.parse(card)).toEqual(card);
    expect(card.goal).toEqual({ label: "Frontend Developer", templateId: "frontend-developer" });
    expect(card.skills.find((s) => s.skillId === "html")?.current).toBe(1);
    expect(card.skills.find((s) => s.skillId === "css")?.current).toBe(0);
    expect(card.preferences).toEqual(beginner.preferences);
  });

  it("builds from a custom goal's mapped skills", () => {
    const profile: Profile = {
      ...beginner,
      goals: [{ type: "custom", text: "ship a small web app", mappedSkills: [{ skillId: "react", level: 2 }] }],
    };
    const card = buildProfileCard("card-2", profile, data);
    if ("error" in card) throw new Error(card.error);
    expect(card.goal.label).toBe("ship a small web app");
    expect(card.skills.some((s) => s.skillId === "react")).toBe(true);
    expect(card.skills.some((s) => s.skillId === "html")).toBe(true); // a prerequisite of react
  });

  it("refuses without a goal", () => {
    expect(buildProfileCard("x", { ...beginner, goals: [] }, data)).toEqual({
      error: "The profile has no goal yet; record one with apply_profile_ops first.",
    });
  });
});

describe("profileCardAnswerToOps", () => {
  const card = buildProfileCard("card-3", beginner, data);
  if ("error" in card) throw new Error(card.error);

  it("emits stated skill ops only for changed, known skills, and preference ops only for changes", () => {
    const answer = ProfileCardAnswerSchema.parse({
      cardId: card.id,
      skills: { html: 2, css: 0, "not-a-skill": 3 },
      hoursPerWeek: 10,
      pace: beginner.preferences.pace,
      budget: "free-only",
      formats: [],
    });
    const ops = profileCardAnswerToOps(answer, card);
    expect(ops).toEqual([
      { op: "set_skill", skillId: "html", level: 2, source: "stated" },
      { op: "set_preference", key: "hoursPerWeek", value: 10 },
      { op: "set_preference", key: "budget", value: "free-only" },
    ]);
  });

  it("emits nothing when the answer matches the card", () => {
    const answer = ProfileCardAnswerSchema.parse({
      cardId: card.id,
      skills: {},
      hoursPerWeek: beginner.preferences.hoursPerWeek,
      pace: beginner.preferences.pace,
      budget: beginner.preferences.budget,
      formats: [...beginner.preferences.formats],
    });
    expect(profileCardAnswerToOps(answer, card)).toEqual([]);
  });

  it("writes a follow-up Nova can act on", () => {
    const answer = ProfileCardAnswerSchema.parse({ cardId: card.id, skills: { html: 2 }, hoursPerWeek: 6, pace: "standard", budget: "any", formats: [] });
    expect(profileCardFollowUp(answer, card, false)).toContain("HTML (level 2)");
    expect(profileCardFollowUp(answer, card, false)).toMatch(/Build my path\.$/);
    expect(profileCardFollowUp(answer, card, true)).toMatch(/^Skip/);
  });
});

describe("schemas", () => {
  it("rejects a card with no skills", () => {
    expect(() => ProfileCardSchema.parse({ id: "x", goal: { label: "g" }, skills: [], preferences: beginner.preferences })).toThrow();
  });
});
