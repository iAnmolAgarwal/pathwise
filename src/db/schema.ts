import type { AdapterAccountType } from "next-auth/adapters";
import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Path, PathDiff, Profile } from "../schemas";

// Auth.js tables (§19). Column names follow the Drizzle adapter's defaults so the adapter
// can read and write them without a mapping layer. Sessions are database-backed (D-26).
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date", withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

// Learner ids stay capability-style UUIDs in URLs; authorisation is ownership by the
// signed-in user (§19). Rows created before sign-in existed keep a null user_id and are
// unreachable from any account.
export const learners = pgTable("learners", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
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
    // Stamped so the per-user cap (M6) can sum across a user's learners.
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    day: date("day").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
  },
  (table) => [uniqueIndex("token_usage_learner_day").on(table.learnerId, table.day)],
);
