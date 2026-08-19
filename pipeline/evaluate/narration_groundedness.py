"""Narration groundedness: how often does the narrated explanation say something the
evidence object does not?

Sample: 60 evidence objects drawn deterministically (seed 42) from the evaluation corpus
of generated paths — one item from each of the 50 paths (5 fixture learners, 15 goal
templates x 3 canonical profiles) plus two more from each fixture path. Each is narrated
exactly as POST /api/explain narrates it (pipeline/evaluate/narrate.ts runs the same
describeEvidence -> narrateEvidence pair with the same prompt, model and effort). A second
model pass with a different objective — "list every factual claim in this narration that
is not traceable to a field of the evidence object or the profile summary" — flags
unsupported claims. Reported: the unsupported-claim rate (narrations with at least one
flagged claim, and flagged claims per narration and per sentence), every flagged
sentence, and token cost for both passes. Model calls are cached under pipeline/build/
so a rerun never re-spends.

  python pipeline/evaluate/narration_groundedness.py           # sample, narrate, check, write
  python pipeline/evaluate/narration_groundedness.py --paths pipeline/build/evaluate/paths.json

Writes pipeline/evidence/eval_narration_groundedness.json and .md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import subprocess
import sys
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

PIPELINE_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = PIPELINE_DIR.parent
EVIDENCE_DIR = PIPELINE_DIR / "evidence"
BUILD_DIR = PIPELINE_DIR / "build" / "evaluate"
PATHS_JSON = BUILD_DIR / "paths.json"
SAMPLE_JSON = BUILD_DIR / "narration_sample.json"
NARRATIONS_JSON = BUILD_DIR / "narrations.json"
CHECK_DIR = BUILD_DIR / "narration_checks"

SAMPLE_SIZE = 60
SEED = 42
CHECKER_MODEL = "claude-sonnet-5"
CHECKER_EFFORT = "medium"
CHECKER_VERSION = "v2"
# Sonnet 5 list prices, USD per MTok (intro pricing through the judging window).
PRICE = {"input": 2.0, "output": 10.0, "cacheWrite": 2.5, "cacheRead": 0.2}

CHECKER_SYSTEM = """You are a strict fact-checker for a learning-path product. You receive three things: a learner's profile summary, an evidence object (JSON) that explains why one item is on that learner's path, and a short narration that was written from nothing but those two inputs.

Task: list every factual claim in the narration that is NOT traceable to a field of the evidence object or to the profile summary.

Traceable means: a paraphrase of a field; a name, number or percentage that appears in a field; simple arithmetic over fields (hours divided by hours per week, a count of skills); an ordering that sequencedAfter or a graphPath states; a qualitative reading that a field directly supports (a "strongest component" when that score is the largest; "beginner-level" when difficulty says so).

Not factual claims (do not flag): second-person encouragement, tone, framing, and general statements of intent that assert nothing specific about the item, the skills, the provider, or other learners.

Flag in particular: numbers or percentages that appear nowhere in the inputs; names of courses, skills, tools, providers or data sources that are not in the inputs; properties of the item not stated in the evidence (format, projects, certificates, duration, level, popularity, price, recency, instructor); claims about what other learners did, preferred or felt that are not in learnerEvidence; prerequisites or sequencing not in the evidence; and anything the profile summary does not say about the learner.

Classify each flagged claim: "invented-fact" — a name, number, property, event or relationship that appears in no input; "misstated-field" — a field that exists but is misquoted, misread or contradicted (wrong number, wrong direction, a percent read as a count); "interpretive-gloss" — a qualitative reading that goes beyond what a field says without introducing a new fact (a numeric quality score called "well-regarded", an empty sequencedAfter called "foundational", a difficulty called "deeper").

Return one entry per untraceable claim, quoting the narration sentence verbatim. If every claim is traceable, return an empty list. Also return the number of sentences in the narration."""


class Flag(BaseModel):
    sentence: str = Field(description="the narration sentence, verbatim")
    claim: str = Field(description="the specific untraceable claim inside it")
    whyUntraceable: str = Field(description="which input lacks it")
    kind: Literal["invented-fact", "misstated-field", "interpretive-gloss"]


class CheckResult(BaseModel):
    sentences: int = Field(description="number of sentences in the narration")
    unsupportedClaims: list[Flag]


def dump_paths(out: Path) -> dict:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["npx", "tsx", "pipeline/evaluate/dump_paths.ts", "--out", str(out)], cwd=REPO_DIR, check=True)
    return json.loads(out.read_text())


def draw_sample(corpus: dict) -> list[dict]:
    """One item per path, then two more per fixture path; seeded, so the sample is stable."""
    rng = random.Random(SEED)
    picked: list[dict] = []
    seen: set[tuple[str, str]] = set()

    def take(path: dict, k: int) -> None:
        pool = [it for it in path["items"] if (path["name"], it["catalogId"]) not in seen]
        for it in rng.sample(pool, min(k, len(pool))):
            seen.add((path["name"], it["catalogId"]))
            picked.append({
                "key": f"{path['name']}|{it['catalogId']}",
                "path": path["name"],
                "kind": it["kind"],
                "catalogId": it["catalogId"],
                "hasLinks": bool((it["evidence"].get("learnerEvidence") or {}).get("edges")),
                "hasBranch": bool((it["evidence"].get("learnerEvidence") or {}).get("branch")),
                "profile": path["profile"],
                "evidence": it["evidence"],
            })

    for path in corpus["paths"]:
        take(path, 1)
    for path in corpus["paths"]:
        if path["kind"] == "fixture":
            take(path, 2)
    assert len(picked) == SAMPLE_SIZE, len(picked)
    return picked


def narrate(sample: list[dict]) -> list[dict]:
    SAMPLE_JSON.write_text(json.dumps([{k: s[k] for k in ("key", "profile", "evidence")} for s in sample]) + "\n")
    subprocess.run(["npx", "tsx", "pipeline/evaluate/narrate.ts", "--in", str(SAMPLE_JSON), "--out", str(NARRATIONS_JSON)], cwd=REPO_DIR, check=True)
    by_key = {n["key"]: n for n in json.loads(NARRATIONS_JSON.read_text())}
    return [by_key[s["key"]] for s in sample]


def load_env_key() -> None:
    if os.environ.get("ANTHROPIC_API_KEY"):
        return
    env = REPO_DIR / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("ANTHROPIC_API_KEY="):
                os.environ["ANTHROPIC_API_KEY"] = line.split("=", 1)[1].strip().strip('"').strip("'")


def check(narrations: list[dict]) -> tuple[list[dict], dict]:
    from anthropic import Anthropic

    load_env_key()
    client = Anthropic(max_retries=3)
    CHECK_DIR.mkdir(parents=True, exist_ok=True)
    usage = {"calls": 0, "cached": 0, "input": 0, "output": 0, "cacheWrite": 0, "cacheRead": 0}
    results = []
    for i, n in enumerate(narrations, 1):
        user = (
            f"Profile summary:\n{n['profileSummary']}\n\n"
            f"Evidence object (JSON):\n{json.dumps(n['described'])}\n\n"
            f"Narration:\n{n['narration']}"
        )
        key = hashlib.sha256(json.dumps([CHECKER_VERSION, CHECKER_MODEL, CHECKER_EFFORT, CHECKER_SYSTEM, user]).encode()).hexdigest()
        path = CHECK_DIR / f"{key}.json"
        if path.exists():
            rec = json.loads(path.read_text())
            usage["cached"] += 1
        else:
            resp = client.messages.parse(
                model=CHECKER_MODEL,
                max_tokens=8192,
                system=[{"type": "text", "text": CHECKER_SYSTEM, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": user}],
                output_format=CheckResult,
                output_config={"effort": CHECKER_EFFORT},
            )
            if resp.parsed_output is None:
                raise RuntimeError(f"checker returned no structured output (stop_reason={resp.stop_reason}) for {n['key']}")
            u = resp.usage
            rec = {
                "model": resp.model,
                "usage": {"input": u.input_tokens, "output": u.output_tokens, "cacheWrite": u.cache_creation_input_tokens or 0, "cacheRead": u.cache_read_input_tokens or 0},
                "parsed": resp.parsed_output.model_dump(),
            }
            path.write_text(json.dumps(rec, indent=1) + "\n")
            usage["calls"] += 1
            print(f"  checked {i}/{len(narrations)}")
        # Totals cover the whole pass, cached or not; "calls" is what this run spent.
        for k, v in rec["usage"].items():
            usage[k] += v
        results.append(rec["parsed"])
    return results, usage


def count_sentences(text: str) -> int:
    return len([s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s])


def cost_usd(u: dict) -> float:
    return round(sum(u.get(k, 0) * PRICE[k] for k in PRICE) / 1e6, 4)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--paths", type=Path, help="existing paths.json (skips the engine run)")
    args = ap.parse_args()
    corpus = json.loads(args.paths.read_text()) if args.paths else dump_paths(PATHS_JSON)
    sample = draw_sample(corpus)
    print(f"sample: {len(sample)} evidence objects")
    narrations = narrate(sample)
    checks, checker_usage = check(narrations)

    rows = []
    flagged_narrations = flagged_claims = total_sentences = 0
    narr_usage = {"input": 0, "output": 0, "cacheWrite": 0, "cacheRead": 0}
    for s, n, c in zip(sample, narrations, checks):
        sentences = count_sentences(n["narration"])
        total_sentences += sentences
        flagged_claims += len(c["unsupportedClaims"])
        flagged_narrations += int(bool(c["unsupportedClaims"]))
        narr_usage["input"] += n["usage"]["input_tokens"]
        narr_usage["output"] += n["usage"]["output_tokens"]
        narr_usage["cacheWrite"] += n["usage"]["cache_creation_input_tokens"] or 0
        narr_usage["cacheRead"] += n["usage"]["cache_read_input_tokens"] or 0
        rows.append({
            "key": s["key"], "path": s["path"], "kind": s["kind"], "catalogId": s["catalogId"],
            "hasLinks": s["hasLinks"], "hasBranch": s["hasBranch"],
            "narration": n["narration"], "sentences": sentences,
            "unsupportedClaims": c["unsupportedClaims"],
        })
    n_total = len(rows)
    composition = {
        "fixturePaths": sum(r["path"].startswith("fixture:") for r in rows),
        "templatePaths": sum(r["path"].startswith("template:") for r in rows),
        "byKind": {k: sum(r["kind"] == k for r in rows) for k in ("course", "project", "assessment")},
        "withLearnerLinks": sum(r["hasLinks"] for r in rows),
        "withBranchShare": sum(r["hasBranch"] for r in rows),
    }
    by_kind_flag = {k: {"n": sum(r["kind"] == k for r in rows), "flagged": sum(r["kind"] == k and bool(r["unsupportedClaims"]) for r in rows)} for k in ("course", "project", "assessment")}
    with_numbers = [r for r in rows if r["hasLinks"] or r["hasBranch"]]
    kinds = ("invented-fact", "misstated-field", "interpretive-gloss")
    claims_by_kind = {k: sum(f["kind"] == k for r in rows for f in r["unsupportedClaims"]) for k in kinds}
    narrations_by_kind = {k: sum(any(f["kind"] == k for f in r["unsupportedClaims"]) for r in rows) for k in kinds}
    hard = sum(any(f["kind"] != "interpretive-gloss" for f in r["unsupportedClaims"]) for r in rows)
    report = {
        "description": "Unsupported-claim rate of /api/explain narrations on a fixed 60-object sample: a second model pass flags every factual claim not traceable to the evidence object or profile summary. Computed by pipeline/evaluate/narration_groundedness.py; nothing trained.",
        "method": {
            "sample": f"{SAMPLE_SIZE} evidence objects: one per generated path (50) plus two more per fixture path (10); seed {SEED}",
            "narration": "pipeline/evaluate/narrate.ts: the same describeEvidence -> narrateEvidence pair, prompt, model and effort as POST /api/explain",
            "checker": f"{CHECKER_MODEL}, effort {CHECKER_EFFORT}, structured output; objective: list every factual claim not traceable to a field of the evidence object or the profile summary (paraphrase, arithmetic over fields and direct qualitative readings count as traceable; encouragement and framing are not claims)",
            "rates": "narrations with >= 1 flagged claim / 60; flagged claims per narration; flagged claims per 100 sentences (sentences split on terminal punctuation); each flag is classed invented-fact (absent from every input), misstated-field (a field misquoted or misread) or interpretive-gloss (a qualitative reading beyond a field, no new fact)",
        },
        "sampleComposition": composition,
        "results": {
            "narrations": n_total,
            "narrationsWithUnsupportedClaim": flagged_narrations,
            "unsupportedNarrationRate": round(flagged_narrations / n_total, 4),
            "narrationsWithInventedOrMisstatedFact": hard,
            "inventedOrMisstatedRate": round(hard / n_total, 4),
            "claimsByKind": claims_by_kind,
            "narrationsByClaimKind": narrations_by_kind,
            "unsupportedClaims": flagged_claims,
            "claimsPerNarration": round(flagged_claims / n_total, 3),
            "sentences": total_sentences,
            "claimsPer100Sentences": round(100 * flagged_claims / total_sentences, 2) if total_sentences else None,
            "byKind": by_kind_flag,
            "withLearnerNumbers": {"n": len(with_numbers), "flagged": sum(bool(r["unsupportedClaims"]) for r in with_numbers)},
            "meanNarrationWords": round(sum(len(r["narration"].split()) for r in rows) / n_total, 1),
        },
        "cost": {
            "narration": {"model": narrations[0]["model"], "effort": narrations[0]["effort"], **narr_usage, "estimatedUsd": cost_usd(narr_usage)},
            "checker": {"model": CHECKER_MODEL, "effort": CHECKER_EFFORT, **checker_usage, "estimatedUsd": cost_usd(checker_usage)},
            "priceUsdPerMTok": PRICE,
            "note": "token counts are summed from the API responses behind every narration and check (cached responses included); 'calls' is what the latest run spent",
        },
        "flagged": [r for r in rows if r["unsupportedClaims"]],
        "samples": rows,
    }
    EVIDENCE_DIR.mkdir(exist_ok=True)
    (EVIDENCE_DIR / "eval_narration_groundedness.json").write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n")
    (EVIDENCE_DIR / "eval_narration_groundedness.md").write_text(render_md(report))
    r = report["results"]
    print(f"{r['narrationsWithUnsupportedClaim']}/{r['narrations']} narrations with an unsupported claim ({100*r['unsupportedNarrationRate']:.1f} %), {r['unsupportedClaims']} claims over {r['sentences']} sentences")
    print(f"cost: narration ${report['cost']['narration']['estimatedUsd']}, checker ${report['cost']['checker']['estimatedUsd']}")
    return 0


def render_md(report: dict) -> str:
    r, c, comp, m = report["results"], report["cost"], report["sampleComposition"], report["method"]
    lines = [
        "# Narration groundedness",
        "",
        "Generated by `pipeline/evaluate/narration_groundedness.py`. Measured, not asserted; nothing trained.",
        "",
        f"Sample: {m['sample']} — {comp['fixturePaths']} from fixture paths, {comp['templatePaths']} from template paths; "
        f"{comp['byKind']['course']} courses, {comp['byKind']['project']} projects, {comp['byKind']['assessment']} assessments; "
        f"{comp['withLearnerLinks']} carry learner-sequence links and {comp['withBranchShare']} a 'what learners did next' share.",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Narrations | {r['narrations']} |",
        f"| Narrations with ≥ 1 unsupported claim | {r['narrationsWithUnsupportedClaim']} ({100*r['unsupportedNarrationRate']:.1f} %) |",
        f"| — of which invented fact / misstated field | {r['narrationsWithInventedOrMisstatedFact']} ({100*r['inventedOrMisstatedRate']:.1f} %) |",
        f"| Unsupported claims | {r['unsupportedClaims']} ({r['claimsPerNarration']} per narration): {r['claimsByKind']['invented-fact']} invented facts, {r['claimsByKind']['misstated-field']} misstated fields, {r['claimsByKind']['interpretive-gloss']} interpretive glosses |",
        f"| Sentences | {r['sentences']} ({r['claimsPer100Sentences']} unsupported claims per 100 sentences) |",
        f"| Narrations citing learner numbers | {r['withLearnerNumbers']['n']} ({r['withLearnerNumbers']['flagged']} flagged) |",
        f"| Mean narration length | {r['meanNarrationWords']} words |",
        "",
        "By item kind (flagged / n): " + ", ".join(f"{k} {v['flagged']} / {v['n']}" for k, v in r["byKind"].items()),
        "",
        "## Cost",
        "",
        "| Pass | Model | Effort | Input | Output | Cache write | Cache read | Estimated USD |",
        "|---|---|---|---|---|---|---|---|",
        f"| Narration | {c['narration']['model']} | {c['narration']['effort']} | {c['narration']['input']} | {c['narration']['output']} | {c['narration']['cacheWrite']} | {c['narration']['cacheRead']} | {c['narration']['estimatedUsd']} |",
        f"| Checker | {c['checker']['model']} | {c['checker']['effort']} | {c['checker']['input']} | {c['checker']['output']} | {c['checker']['cacheWrite']} | {c['checker']['cacheRead']} | {c['checker']['estimatedUsd']} |",
        "",
        f"Prices (USD per MTok): {c['priceUsdPerMTok']}. {c['note']}.",
        "",
        "## Flagged sentences",
        "",
    ]
    if not report["flagged"]:
        lines.append("none")
    for row in report["flagged"]:
        lines.append(f"### {row['key']} ({row['kind']})")
        lines.append("")
        for f in row["unsupportedClaims"]:
            lines.append(f"- [{f['kind']}] \"{f['sentence']}\" — {f['claim']} ({f['whyUntraceable']})")
        lines.append("")
    lines += ["## Method", "", f"- Sample: {m['sample']}.", f"- Narration: {m['narration']}.", f"- Checker: {m['checker']}.", f"- Rates: {m['rates']}.", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
