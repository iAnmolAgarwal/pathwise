import {
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Path, PathDiff, Profile } from "../schemas";

// Learner ids are capability-style: unguessable UUIDs stand in for auth (D-07).
export const learners = pgTable("learners", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  avatarSeed: text("avatar_seed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  learnerId: uuid("learner_id")
    .primaryKey()
    .references(() => learners.id),
  data: jsonb("data").$type<Profile>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const paths = pgTable("paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  version: integer("version").notNull(),
  data: jsonb("data").$type<Path>().notNull(),
  diff: jsonb("diff").$type<PathDiff>(), // null on the initial version
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Append-only: rows are never updated or deleted; replans consume the event stream.
export const feedbackEvents = pgTable("feedback_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  role: text("role").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tokenUsage = pgTable(
  "token_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learnerId: uuid("learner_id")
      .references(() => learners.id)
      .notNull(),
    day: date("day").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
  },
  (table) => [uniqueIndex("token_usage_learner_day").on(table.learnerId, table.day)],
);
