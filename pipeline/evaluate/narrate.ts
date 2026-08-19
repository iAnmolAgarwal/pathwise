/**
 * Narrates a sample of evidence objects exactly as POST /api/explain does — the same
 * describeEvidence → narrateEvidence pair, the same profile summary, the same model and
 * effort — without a database or a running server. Reads a JSON array of
 * { key, profile, evidence } from --in and writes { key, described, profileSummary,
 * narration, usage, model } per sample to --out. Used by narration_groundedness.py.
 *
 *   npx tsx pipeline/evaluate/narrate.ts --in sample.json --out narrations.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadEnvConfig } from "@next/env";
import { llm, MODEL, EFFORT } from "@/llm/client";
import { narrateEvidence } from "@/llm/explain";
import { profileSummaryFor } from "@/lib/chatContext";
import { loadEngineData } from "@/lib/engineData";
import { describeEvidence } from "@/llm/tools";
import { EvidenceSchema, ProfileSchema } from "@/schemas";

loadEnvConfig(process.cwd());

type Sample = { key: string; profile: unknown; evidence: unknown };
type Out = {
  key: string;
  described: ReturnType<typeof describeEvidence>;
  profileSummary: string;
  narration: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number | null; cache_creation_input_tokens: number | null };
  model: string;
  effort: string;
};

function arg(name: string): string {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`missing ${name}`);
  return process.argv[i + 1];
}

async function main() {
  const inPath = arg("--in");
  const outPath = arg("--out");
  const concurrency = Number(process.env.NARRATE_CONCURRENCY ?? 4);
  const samples: Sample[] = JSON.parse(readFileSync(inPath, "utf8"));
  const data = loadEngineData();
  // Resume-safe: keys already narrated in --out are kept, so a rerun never re-spends.
  const done: Out[] = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : [];
  const doneKeys = new Set(done.map((d) => d.key));
  const todo = samples.filter((s) => !doneKeys.has(s.key));
  console.error(`${samples.length} samples, ${done.length} already narrated, ${todo.length} to do`);

  const client = llm();
  let cursor = 0;
  const results: Out[] = [...done];
  const save = () => {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(results, null, 1) + "\n");
  };
  async function worker() {
    while (cursor < todo.length) {
      const s = todo[cursor++];
      const profile = ProfileSchema.parse(s.profile);
      const evidence = EvidenceSchema.parse(s.evidence);
      const described = describeEvidence(evidence, data);
      const profileSummary = profileSummaryFor(profile);
      const { narration, usage } = await narrateEvidence(client, { evidence: described, profileSummary });
      results.push({
        key: s.key,
        described,
        profileSummary,
        narration,
        usage: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_input_tokens: usage.cache_read_input_tokens ?? null,
          cache_creation_input_tokens: usage.cache_creation_input_tokens ?? null,
        },
        model: MODEL,
        effort: EFFORT.narration,
      });
      save();
      console.error(`  ${results.length}/${samples.length} ${s.key}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  save();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
