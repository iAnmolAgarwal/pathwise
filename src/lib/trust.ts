import { readFileSync } from "node:fs";
import { join } from "node:path";

import catalog from "@/data/catalog.json";
import goals from "@/data/goals.json";
import skills from "@/data/skills.json";
import { BADGE_ANCHOR_EDGE } from "@/lib/edgeCard";
import type { TrustNumbers } from "@/lib/trustFormat";

export { compactCount, type TrustNumbers } from "@/lib/trustFormat";

/**
 * Every number the landing page shows, read from the committed pipeline outputs at build time
 * (§9.4): the agreement report, the two mining stats files and the data files. Nothing here is
 * typed in, so the page can never drift from the report. Server-only (reads the filesystem).
 */
const ROOT = process.cwd();
const num = (text: string, key: string): number => {
  const m = text.match(new RegExp(`^- ${key}: (\\d+)`, "m"));
  if (!m) throw new Error(`trust: ${key} not found`);
  return Number(m[1]);
};

let cached: TrustNumbers | null = null;

export function loadTrustNumbers(): TrustNumbers {
  if (cached) return cached;
  const report = JSON.parse(readFileSync(join(ROOT, "pipeline", "evidence", "agreement_report.json"), "utf8")) as {
    authoredEdges: number;
    observable: { anySource: number };
    confirmed: { anySource: number; both: number; pctOfObservableAny: number };
    contradicted: { count: number; resolved: number };
    mined: { promoted: number };
  };
  const so = readFileSync(join(ROOT, "pipeline", "evidence", "so_stats.md"), "utf8");
  const coursera = readFileSync(join(ROOT, "pipeline", "evidence", "coursera_stats.md"), "utf8");
  cached = {
    authoredEdges: report.authoredEdges,
    observable: report.observable.anySource,
    observablePct: Math.round((100 * report.observable.anySource) / report.authoredEdges),
    confirmedAny: report.confirmed.anySource,
    confirmedPct: report.confirmed.pctOfObservableAny,
    confirmedBoth: report.confirmed.both,
    contradicted: report.contradicted.count,
    resolved: report.contradicted.resolved,
    promoted: report.mined.promoted,
    skills: (skills as unknown[]).length,
    goalTemplates: (goals as unknown[]).length,
    catalogItems: (catalog as unknown[]).length,
    soUsers: num(so, "usersEligible"),
    courseraLearners: num(coursera, "namesWithPairs"),
    anchor: BADGE_ANCHOR_EDGE,
  };
  return cached;
}

