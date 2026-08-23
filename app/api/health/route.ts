import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HealthSchema = z.object({
  ok: z.boolean(),
  db: z.object({ ok: z.boolean(), ms: z.number().int().min(0) }),
  at: z.string(),
});

/**
 * GET /api/health — a round trip to the database. The keep-warm Action calls it so Neon's
 * free-tier compute does not suspend between a judge's visits; it is also the first thing
 * to check when the app misbehaves. Public and unauthenticated on purpose; it reveals
 * nothing but latency.
 */
export async function GET() {
  const started = Date.now();
  let dbOk = false;
  try {
    await db().execute(sql`select 1`);
    dbOk = true;
  } catch (err) {
    console.error("health: database unreachable", err);
  }
  const body = HealthSchema.parse({ ok: dbOk, db: { ok: dbOk, ms: Date.now() - started }, at: new Date().toISOString() });
  return NextResponse.json(body, { status: dbOk ? 200 : 503, headers: { "cache-control": "no-store" } });
}
