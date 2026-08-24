import { describe, expect, it } from "vitest";
import {
  ChatProfileOpSchema,
  CatalogItemSchema,
  EvidenceSchema,
  GapReasonSchema,
  GoalTemplateSchema,
  PathDiffSchema,
  PathSchema,
  ProfileOpSchema,
  ProfileSchema,
  ScoreBreakdownSchema,
  SkillSchema,
  mappedGoalSchema,
} from "@/schemas";

const evidence = {
  catalogId: "fcc-responsive-web",
  gapSkillsCovered: [
    { skillId: "html", reason: "goal", graphPath: ["html"] },
    { skillId: "css", reason: "prereq-of:react", graphPath: ["css", "react"] },
  ],
  scoreBreakdown: {
    coverage: 0.8,
    levelFit: 0.9,
    preferenceFit: 1,
    quality: 0.85,
    similarity: 0.7,
    total: 0.83,
  },
  sequencedAfter: [{ catalogId: "mdn-html-basics", becauseSkill: "html" }],
  provenance: "https://www.freecodecamp.org/learn/2022/responsive-web-design/",
};

describe("SkillSchema", () => {
  it("accepts a valid skill", () => {
    expect(
      SkillSchema.safeParse({
        id: "react",
        name: "React",
        domain: "web-frontend",
        description: "Component-based UI library for the web.",
        levelBand: 2,
        prereqs: ["javascript"],
      }).success,
    ).toBe(true);
  });

  it("rejects a levelBand outside 1-3", () => {
    expect(
      SkillSchema.safeParse({
        id: "react",
        name: "React",
        domain: "web-frontend",
        description: "x",
        levelBand: 4,
        prereqs: [],
      }).success,
    ).toBe(false);
  });
});

describe("GoalTemplateSchema", () => {
  it("accepts a valid template", () => {
    expect(
      GoalTemplateSchema.safeParse({
        id: "frontend-developer",
        title: "Frontend Developer",
        description: "Build interactive web interfaces.",
        requiredSkills: [{ skillId: "react", level: 2 }],
      }).success,
    ).toBe(true);
  });
});

describe("CatalogItemSchema", () => {
  const item = {
    id: "fcc-responsive-web",
    kind: "course",
    title: "Responsive Web Design",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/2022/responsive-web-design/",
    description: "HTML and CSS from scratch through responsive layouts.",
    skillsTaught: [
      { skillId: "html", level: 2 },
      { skillId: "css", level: 2 },
    ],
    skillsRequired: [],
    difficulty: 1,
    durationHours: 60,
    format: "interactive",
    cost: "free",
    qualityPrior: 0.9,
  };

  it("accepts a valid item", () => {
    expect(CatalogItemSchema.safeParse(item).success).toBe(true);
  });

  it("rejects qualityPrior above 1", () => {
    expect(
      CatalogItemSchema.safeParse({ ...item, qualityPrior: 1.2 }).success,
    ).toBe(false);
  });

  it("rejects a non-URL url", () => {
    expect(CatalogItemSchema.safeParse({ ...item, url: "not a url" }).success).toBe(
      false,
    );
  });
});

describe("ProfileSchema", () => {
  it("accepts both goal shapes", () => {
    expect(
      ProfileSchema.safeParse({
        goals: [
          { type: "role", templateId: "frontend-developer" },
          {
            type: "custom",
            text: "learn enough ML to build a recommender",
            mappedSkills: [{ skillId: "python", level: 2 }],
          },
        ],
        skills: { javascript: { level: 2, source: "stated" } },
        preferences: {
          hoursPerWeek: 6,
          formats: [],
          budget: "free-only",
          pace: "standard",
        },
      }).success,
    ).toBe(true);
  });
});

describe("ProfileOpSchema", () => {
  it("accepts each op variant", () => {
    const ops = [
      { op: "add_goal", goal: { type: "role", templateId: "frontend-developer" } },
      { op: "remove_goal", index: 0 },
      { op: "set_skill", skillId: "css", level: 1, source: "inferred" },
      { op: "set_preference", key: "pace", value: "intense" },
    ];
    for (const op of ops) {
      expect(ProfileOpSchema.safeParse(op).success).toBe(true);
    }
  });

  it("rejects an unknown op", () => {
    expect(ProfileOpSchema.safeParse({ op: "drop_table" }).success).toBe(false);
  });

  it("rejects set_skill with level 4", () => {
    expect(
      ProfileOpSchema.safeParse({
        op: "set_skill",
        skillId: "css",
        level: 4,
        source: "stated",
      }).success,
    ).toBe(false);
  });

  it("chat ops reject assessed as a set_skill source", () => {
    expect(
      ChatProfileOpSchema.safeParse({
        op: "set_skill",
        skillId: "css",
        level: 2,
        source: "assessed",
      }).success,
    ).toBe(false);
  });
});

describe("GapReasonSchema", () => {
  it("accepts goal and prereq-of:<skillId>", () => {
    expect(GapReasonSchema.safeParse("goal").success).toBe(true);
    expect(GapReasonSchema.safeParse("prereq-of:react").success).toBe(true);
  });

  it("rejects a bare prereq-of", () => {
    expect(GapReasonSchema.safeParse("prereq-of:").success).toBe(false);
    expect(GapReasonSchema.safeParse("because").success).toBe(false);
  });
});

describe("PathSchema", () => {
  const path = {
    phases: [
      {
        title: "Phase 1 — Web Foundations",
        milestone: "Publish a hand-built responsive site",
        items: [{ catalogId: "fcc-responsive-web", status: "todo", evidence }],
      },
    ],
    meta: {
      generatedAt: "2026-08-14T12:00:00Z",
      engineVersion: "0.1.0",
      trigger: "initial",
    },
  };

  it("accepts a valid path with evidence attached", () => {
    expect(PathSchema.safeParse(path).success).toBe(true);
  });

  it("rejects an invalid item status", () => {
    const bad = structuredClone(path);
    bad.phases[0].items[0].status = "paused";
    expect(PathSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a non-ISO generatedAt", () => {
    const bad = structuredClone(path);
    bad.meta.generatedAt = "yesterday";
    expect(PathSchema.safeParse(bad).success).toBe(false);
  });
});

describe("PathDiffSchema", () => {
  it("accepts a valid diff", () => {
    expect(
      PathDiffSchema.safeParse({
        added: [{ catalogId: "css-grid-course", reason: "gap reopened on css" }],
        removed: [],
        reordered: true,
        cause: {
          eventId: "evt-123",
          humanReadable: "You marked Responsive Web Design as too hard",
        },
      }).success,
    ).toBe(true);
  });
});

describe("EvidenceSchema", () => {
  it("accepts a valid evidence object", () => {
    expect(EvidenceSchema.safeParse(evidence).success).toBe(true);
  });

  it("rejects a non-URL provenance", () => {
    expect(
      EvidenceSchema.safeParse({ ...evidence, provenance: "trust me" }).success,
    ).toBe(false);
  });

  it("parses a stored breakdown written before transitionPrior existed (D-27)", () => {
    // Paths live in Postgres as JSON and are re-parsed on read. Every path generated before
    // the prior — including the seeded demo learner's six weeks of history — has a five-part
    // breakdown, and must keep loading as "this path predates the prior".
    const legacy = {
      coverage: 0.5, levelFit: 0.5, preferenceFit: 0.5, quality: 0.5, similarity: 0.5, total: 0.5,
    };
    const parsed = ScoreBreakdownSchema.parse(legacy);
    expect(parsed.transitionPrior).toBe(0);
    expect(EvidenceSchema.parse({ ...evidence, scoreBreakdown: legacy }).scoreBreakdown.transitionPrior).toBe(0);
  });
});

describe("ProfileOpSchema set_preference", () => {
  it("types the value per preference key", () => {
    expect(ProfileOpSchema.safeParse({ op: "set_preference", key: "hoursPerWeek", value: 8 }).success).toBe(true);
    expect(ProfileOpSchema.safeParse({ op: "set_preference", key: "hoursPerWeek", value: "eight" }).success).toBe(false);
    expect(ProfileOpSchema.safeParse({ op: "set_preference", key: "pace", value: "warp" }).success).toBe(false);
    expect(ProfileOpSchema.safeParse({ op: "set_preference", key: "formats", value: ["video", "text"] }).success).toBe(true);
  });
});

describe("mappedGoalSchema", () => {
  it("only accepts skill ids from the closed vocabulary", () => {
    const schema = mappedGoalSchema(["python", "sql"]);
    const ok = { text: "analyse sales data", matchesTemplateId: null, mappedSkills: [{ skillId: "sql", level: 2 }], rationale: "SQL is how you query it." };
    expect(schema.safeParse(ok).success).toBe(true);
    expect(schema.safeParse({ ...ok, mappedSkills: [{ skillId: "excel", level: 2 }] }).success).toBe(false);
  });
});
