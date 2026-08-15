import type { Profile } from "@/schemas";

const basePrefs: Profile["preferences"] = {
  hoursPerWeek: 6,
  formats: [],
  budget: "any",
  pace: "standard",
};

function skills(levels: Record<string, 0 | 1 | 2 | 3>): Profile["skills"] {
  return Object.fromEntries(
    Object.entries(levels).map(([id, level]) => [id, { level, source: "stated" as const }]),
  );
}

/** Five seeded learners (§5.6). Names double as snapshot keys, so keep them stable. */
export const FIXTURE_LEARNERS: Record<string, Profile> = {
  "beginner-frontend": {
    goals: [{ type: "role", templateId: "frontend-developer" }],
    skills: {},
    preferences: basePrefs,
  },
  "career-switcher-to-ds": {
    goals: [{ type: "role", templateId: "data-scientist" }],
    skills: skills({ spreadsheets: 2, "statistics-fundamentals": 1 }),
    preferences: { ...basePrefs, hoursPerWeek: 10, formats: ["video", "interactive"] },
  },
  "partial-skills-ml": {
    goals: [{ type: "role", templateId: "machine-learning-engineer" }],
    skills: skills({
      "programming-basics": 3,
      python: 3,
      "version-control-git": 2,
      "python-data-analysis": 2,
      "statistics-fundamentals": 2,
      "ml-fundamentals": 1,
    }),
    preferences: { ...basePrefs, hoursPerWeek: 8, budget: "free-only" },
  },
  "time-poor-cloud": {
    goals: [{ type: "role", templateId: "cloud-engineer" }],
    skills: skills({ "programming-basics": 2, python: 2, "command-line": 2, "version-control-git": 2 }),
    preferences: { ...basePrefs, hoursPerWeek: 3, pace: "intense" },
  },
  "custom-goal": {
    goals: [
      {
        type: "custom",
        text: "Build a chatbot over my company's docs",
        mappedSkills: [
          { skillId: "llm-apis", level: 2 },
          { skillId: "prompt-engineering", level: 2 },
          { skillId: "rag", level: 2 },
          { skillId: "embeddings-vector-search", level: 1 },
        ],
      },
    ],
    skills: skills({ "programming-basics": 2, python: 2 }),
    preferences: { ...basePrefs, pace: "relaxed" },
  },
};
