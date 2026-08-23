import { z } from "zod";

// "goal" = directly required by the goal; "prereq-of:<skillId>" = transitive prerequisite.
export const GapReasonSchema = z.union([
  z.literal("goal"),
  z.string().regex(/^prereq-of:.+$/),
]);

export const ScoreBreakdownSchema = z.object({
  coverage: z.number(),
  levelFit: z.number(),
  preferenceFit: z.number(),
  quality: z.number(),
  similarity: z.number(),
  total: z.number(),
});

export const EvidenceSourceSchema = z.enum(["stackoverflow", "coursera"]);

/**
 * One source's numbers for one path-driving edge a covered gap skill sits on (§7 rendering 3).
 * Copied from skill_edges.json at generation time; every number travels with its caveat (N-2).
 */
export const LearnerEvidenceEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  source: EvidenceSourceSchema,
  support: z.number().int().nonnegative(),
  reverse: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  n: z.number().int().positive(),
  caveat: z.string().min(1),
});

/**
 * "What learners did next" for the item's primary gap skill (§15.8, D-18): from a skill the
 * learner already has, the transition share into this skill — per source, shrunk, shown only
 * above the floors (nTotal ≥ 50, toThis ≥ 5). A transition share, never satisfaction (N-5).
 */
export const LearnerEvidenceBranchSchema = z.object({
  from: z.string().min(1),
  /** Learners who went from → this item's primary gap skill next. */
  toThis: z.number().int().min(5),
  nTotal: z.number().int().min(50),
  shareShrunk: z.number().gt(0).max(1),
  source: EvidenceSourceSchema,
  caveat: z.string().min(1),
});

export const EvidenceSchema = z.object({
  catalogId: z.string().min(1),
  gapSkillsCovered: z.array(
    z.object({
      skillId: z.string().min(1),
      reason: GapReasonSchema,
      graphPath: z.array(z.string()),
    }),
  ),
  scoreBreakdown: ScoreBreakdownSchema,
  sequencedAfter: z.array(
    z.object({ catalogId: z.string().min(1), becauseSkill: z.string().min(1) }),
  ),
  provenance: z.url(),
  /** Present only when there is learner-sequence data to show: an edge a covered skill sits on, or a branch into the primary skill. */
  learnerEvidence: z
    .object({ edges: z.array(LearnerEvidenceEdgeSchema), branch: LearnerEvidenceBranchSchema.optional() })
    .refine((le) => le.edges.length > 0 || le.branch !== undefined, { message: "learnerEvidence without edges or branch" })
    .optional(),
});

export type GapReason = z.infer<typeof GapReasonSchema>;
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;
export type LearnerEvidenceEdge = z.infer<typeof LearnerEvidenceEdgeSchema>;
export type LearnerEvidenceBranch = z.infer<typeof LearnerEvidenceBranchSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;

// ---------------------------------------------------------------------------
// Learner-sequence evidence (pipeline-generated; src/data/skill_edges.json,
// src/data/branches.json, pipeline/evidence/course_skill_tags.json,
// pipeline/sources/tag_skill_map.json). Percentages are transition shares only;
// every rendered number carries its source caveat.

export const SourceStatSchema = z.object({
  support: z.number().int().nonnegative(),
  reverse: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  n: z.number().int().positive(),
  detail: z
    .object({
      nCoursePairs: z.number().int().positive().optional(),
      coursePairs: z
        .array(
          z.object({
            fromCourseId: z.string().min(1),
            toCourseId: z.string().min(1),
            support: z.number().int().positive(),
            fromItem: z.string().min(1).optional(),
            toItem: z.string().min(1).optional(),
          }),
        )
        .optional(),
      tagsFrom: z.array(z.string()).optional(),
      tagsTo: z.array(z.string()).optional(),
      cohortRule: z.string().optional(),
      sample: z.string().optional(),
    })
    .optional(),
  caveat: z.string().min(1),
});

export const EdgeStatusSchema = z.enum([
  "confirmed-both",
  "confirmed-one-source",
  "contradicted-in-review",
  "no-data",
  "candidate",
  "promoted",
]);

export const EdgeResolutionSchema = z.object({
  by: z.literal("human"),
  decision: z.enum([
    "keep-authored",
    "flip",
    "remove",
    "both-valid-drop-edge",
    "promote",
    "keep-candidate",
  ]),
  note: z.string().min(1),
  date: z.string().min(1),
});

export const SkillEdgeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    origin: z.enum(["authored", "mined"]),
    status: EdgeStatusSchema,
    drivesPath: z.boolean(),
    sources: z.partialRecord(EvidenceSourceSchema, SourceStatSchema),
    resolution: EdgeResolutionSchema.optional(),
  })
  .refine((e) => e.from !== e.to, { message: "self edge" })
  .refine(
    (e) =>
      e.origin === "authored"
        ? e.drivesPath &&
          ["confirmed-both", "confirmed-one-source", "contradicted-in-review", "no-data"].includes(e.status)
        : ["candidate", "promoted"].includes(e.status) && e.drivesPath === (e.status === "promoted"),
    { message: "origin/status/drivesPath inconsistent" },
  );

export const BranchSchema = z.object({
  from: z.string().min(1),
  source: EvidenceSourceSchema,
  sample: z.string().optional(),
  next: z.array(
    z.object({
      to: z.string().min(1),
      n: z.number().int().min(5),
      shareRaw: z.number().gt(0).max(1),
      shareShrunk: z.number().gt(0).max(1),
      inCatalog: z.boolean(),
    }),
  ),
  nTotal: z.number().int().positive(),
  nNextObserved: z.number().int().positive(),
  minSupportMet: z.boolean(),
  caveat: z.string().min(1),
});

export const CourseTagSchema = z.object({
  courseId: z.string().min(1),
  name: z.string().min(1),
  skillsTaught: z.array(z.object({ skillId: z.string().min(1), level: z.union([z.literal(1), z.literal(2), z.literal(3)]) })),
  confidence: z.enum(["high", "medium", "low"]),
  spotChecked: z.boolean(),
  checkedBy: z.string().optional(),
  catalogItemId: z.string().optional(),
});

export const TagSkillMapEntrySchema = z.object({
  tag: z.string().min(1),
  skillId: z.string().min(1),
  note: z.string().optional(),
});

export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;
export type SourceStat = z.infer<typeof SourceStatSchema>;
export type SkillEdge = z.infer<typeof SkillEdgeSchema>;
export type Branch = z.infer<typeof BranchSchema>;
export type CourseTag = z.infer<typeof CourseTagSchema>;
export type TagSkillMapEntry = z.infer<typeof TagSkillMapEntrySchema>;

/** The prompt-facing rendering of an Evidence object (`describeEvidence`), as `/api/explain` returns it. */
export const DescribedEvidenceSchema = z.object({
  item: z.union([
    z.object({
      catalogId: z.string(),
      title: z.string(),
      provider: z.string(),
      kind: z.string(),
      hours: z.number(),
      difficulty: z.number(),
      url: z.string(),
    }),
    z.object({ catalogId: z.string() }),
  ]),
  closesGapIn: z.array(z.object({ skill: z.string(), why: z.string(), graphPath: z.array(z.string()) })),
  sequencedAfter: z.array(z.object({ title: z.string(), becauseSkill: z.string() })),
  scoreBreakdown: ScoreBreakdownSchema,
  learnerEvidence: z
    .object({
      links: z
        .array(
          z.object({
            link: z.string(),
            source: z.string(),
            tookInThisOrder: z.number(),
            tookTheOtherWay: z.number(),
            percentInThisOrder: z.number(),
            n: z.number(),
            caveat: z.string(),
          }),
        )
        .optional(),
      whatLearnersDidNext: z
        .object({
          fromSkillTheLearnerHas: z.string(),
          source: z.string(),
          ofLearnersWhoLearnedIt: z.number(),
          wentToThisSkillNext: z.number(),
          percentWentHereNext: z.union([z.number(), z.string()]),
          caveat: z.string(),
        })
        .optional(),
    })
    .optional(),
});
