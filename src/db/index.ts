import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy so builds and tests run without DATABASE_URL; only route handlers touch the DB.
let cached: ReturnType<typeof connect> | null = null;

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

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(neon(pooledUrl(url)), { schema });
}

export function db() {
  cached ??= connect();
  return cached;
}

export * from "./schema";
