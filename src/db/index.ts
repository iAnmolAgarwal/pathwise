import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

// Lazy so builds and tests run without DATABASE_URL; only route handlers touch the DB.
let cached: Db | null = null;

/**
 * The app talks to Neon through its connection pooler (§2): the pooled host is the direct
 * host with `-pooler` after the endpoint id. Migrations (drizzle-kit) keep the direct URL
 * because the pooler does not support every session-level statement they use.
 */
export function pooledUrl(url: string): string {
  try {
    const u = new URL(url);
    const [endpoint, ...rest] = u.hostname.split(".");
    if (!u.hostname.endsWith(".neon.tech") || endpoint.endsWith("-pooler")) return url;
    u.hostname = [`${endpoint}-pooler`, ...rest].join(".");
    return u.toString();
  } catch {
    return url;
  }
}

function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  // Neon's serverless driver only speaks to Neon; any other Postgres (CI's service
  // container, a contributor's local instance) goes through node-postgres. The two
  // expose the same Drizzle surface, so the rest of the app cannot tell them apart.
  if (new URL(url).hostname.endsWith(".neon.tech")) {
    return drizzleNeon(neon(pooledUrl(url)), { schema });
  }
  return drizzlePg(url, { schema }) as unknown as Db;
}

export function db(): Db {
  cached ??= connect();
  return cached;
}

export * from "./schema";
