import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy so builds and tests run without DATABASE_URL; only route handlers touch the DB.
let cached: ReturnType<typeof connect> | null = null;

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(neon(url), { schema });
}

export function db() {
  cached ??= connect();
  return cached;
}

export * from "./schema";
