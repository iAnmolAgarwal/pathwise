"""Embedding bake-off: which local sentence-embedding model retrieves the right skills
for a catalog item?

Ground truth is each catalog item's annotated `skillsTaught` (model-annotated, human
spot-checked). For every item, all 159 skills are ranked by cosine similarity between the
item text and each skill text — the exact texts embed.py encodes ("title. description" and
"name. description") — and P@1, P@3 and MRR are computed against the item's skill set.
Candidates run locally (MPS when available): all-MiniLM-L6-v2 (the shipped baseline),
BAAI/bge-small-en-v1.5, BAAI/bge-base-en-v1.5, thenlper/gte-base,
nomic-ai/nomic-embed-text-v1.5 (with its required search_query: / search_document:
prefixes). Nothing is trained; the table is the result, and the shipped model changes only
after a reviewed fixture-snapshot diff.

  python pipeline/evaluate/embedding_bakeoff.py             # all candidates, cached per model
  python pipeline/evaluate/embedding_bakeoff.py --models all-MiniLM-L6-v2 BAAI/bge-small-en-v1.5

Writes pipeline/evidence/eval_embedding_bakeoff.json and .md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = PIPELINE_DIR.parent / "src" / "data"
EVIDENCE_DIR = PIPELINE_DIR / "evidence"
BUILD_DIR = PIPELINE_DIR / "build" / "evaluate"

BASELINE = "all-MiniLM-L6-v2"
CANDIDATES: list[dict] = [
    {"id": "all-MiniLM-L6-v2", "queryPrefix": "", "docPrefix": "", "trustRemoteCode": False},
    {"id": "BAAI/bge-small-en-v1.5", "queryPrefix": "", "docPrefix": "", "trustRemoteCode": False},
    {"id": "BAAI/bge-base-en-v1.5", "queryPrefix": "", "docPrefix": "", "trustRemoteCode": False},
    {"id": "thenlper/gte-base", "queryPrefix": "", "docPrefix": "", "trustRemoteCode": False},
    {"id": "nomic-ai/nomic-embed-text-v1.5", "queryPrefix": "search_query: ", "docPrefix": "search_document: ", "trustRemoteCode": True},
]
K = 3


def texts() -> tuple[list[dict], list[dict]]:
    skills = json.loads((DATA_DIR / "skills.json").read_text())
    catalog = json.loads((DATA_DIR / "catalog.json").read_text())
    skill_texts = [{"id": s["id"], "text": f"{s['name']}. {s['description']}"} for s in skills]
    item_texts = [
        {"id": c["id"], "kind": c["kind"], "text": f"{c['title']}. {c['description']}", "truth": [t["skillId"] for t in c["skillsTaught"]]}
        for c in catalog
    ]
    return skill_texts, item_texts


def corpus_hash(skill_texts: list[dict], item_texts: list[dict]) -> str:
    return hashlib.sha256(json.dumps([skill_texts, item_texts], sort_keys=True).encode()).hexdigest()[:16]


def run_model(cand: dict, skill_texts: list[dict], item_texts: list[dict], device: str) -> dict:
    import numpy as np
    from sentence_transformers import SentenceTransformer

    t0 = time.time()
    model = SentenceTransformer(cand["id"], device=device, trust_remote_code=cand["trustRemoteCode"])
    load_s = time.time() - t0
    t1 = time.time()
    s_vec = model.encode([cand["docPrefix"] + s["text"] for s in skill_texts], batch_size=64, normalize_embeddings=True, show_progress_bar=False)
    i_vec = model.encode([cand["queryPrefix"] + i["text"] for i in item_texts], batch_size=64, normalize_embeddings=True, show_progress_bar=False)
    encode_s = time.time() - t1
    sims = np.asarray(i_vec) @ np.asarray(s_vec).T  # items x skills, cosine (unit vectors)
    skill_ids = [s["id"] for s in skill_texts]

    per_item = []
    p1 = p3 = mrr = p3_ceiling = 0.0
    by_kind: dict[str, dict] = {}
    for row, item in zip(sims, item_texts):
        order = np.argsort(-row)
        ranked = [skill_ids[j] for j in order]
        truth = set(item["truth"])
        hit1 = float(ranked[0] in truth)
        hits3 = sum(r in truth for r in ranked[:K]) / K
        rank = next(i for i, r in enumerate(ranked) if r in truth) + 1
        rr = 1.0 / rank
        ceiling = min(len(truth), K) / K
        p1 += hit1
        p3 += hits3
        mrr += rr
        p3_ceiling += ceiling
        bk = by_kind.setdefault(item["kind"], {"n": 0, "p1": 0.0, "p3": 0.0, "mrr": 0.0})
        bk["n"] += 1
        bk["p1"] += hit1
        bk["p3"] += hits3
        bk["mrr"] += rr
        per_item.append({"id": item["id"], "firstCorrectRank": rank, "top3": ranked[:K], "truth": sorted(truth), "p1": hit1, "p3": hits3, "rr": rr})
    n = len(item_texts)
    return {
        "model": cand["id"],
        "dimension": int(np.asarray(s_vec).shape[1]),
        "queryPrefix": cand["queryPrefix"],
        "docPrefix": cand["docPrefix"],
        "device": device,
        "loadSeconds": round(load_s, 1),
        "encodeSeconds": round(encode_s, 1),
        "items": n,
        "p1": round(p1 / n, 4),
        "p3": round(p3 / n, 4),
        "p3Ceiling": round(p3_ceiling / n, 4),
        "mrr": round(mrr / n, 4),
        "byKind": {k: {"n": v["n"], "p1": round(v["p1"] / v["n"], 4), "p3": round(v["p3"] / v["n"], 4), "mrr": round(v["mrr"] / v["n"], 4)} for k, v in sorted(by_kind.items())},
        "worstItems": [{k: v for k, v in r.items() if k in ("id", "firstCorrectRank", "top3", "truth")} for r in sorted(per_item, key=lambda r: -r["firstCorrectRank"])[:10]],
        "perItem": {r["id"]: {"p1": r["p1"], "p3": r["p3"], "rr": r["rr"]} for r in per_item},
    }


def paired_bootstrap(base: dict, cand: dict, n_boot: int = 2000, seed: int = 42) -> dict:
    """95 % interval of (candidate - baseline) per metric, resampling items with replacement."""
    import numpy as np

    ids = sorted(base["perItem"])
    rng = np.random.default_rng(seed)
    out = {}
    for metric in ("p1", "p3", "rr"):
        d = np.array([cand["perItem"][i][metric] - base["perItem"][i][metric] for i in ids])
        boots = np.array([d[rng.integers(0, len(d), len(d))].mean() for _ in range(n_boot)])
        lo, hi = np.percentile(boots, [2.5, 97.5])
        out[{"p1": "p1", "p3": "p3", "rr": "mrr"}[metric]] = {"delta": round(float(d.mean()), 4), "ci95": [round(float(lo), 4), round(float(hi), 4)]}
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="*", help="subset of candidate ids")
    ap.add_argument("--no-cache", action="store_true")
    args = ap.parse_args()
    import torch

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    skill_texts, item_texts = texts()
    chash = corpus_hash(skill_texts, item_texts)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    wanted = [c for c in CANDIDATES if not args.models or c["id"] in args.models]
    results = []
    for cand in wanted:
        cache = BUILD_DIR / f"bakeoff_{cand['id'].replace('/', '__')}_{chash}.json"
        if cache.exists() and not args.no_cache:
            results.append(json.loads(cache.read_text()))
            print(f"{cand['id']}: cached")
            continue
        print(f"{cand['id']}: encoding on {device}...")
        r = run_model(cand, skill_texts, item_texts, device)
        cache.write_text(json.dumps(r, indent=1) + "\n")
        results.append(r)
        print(f"  P@1 {r['p1']}  P@3 {r['p3']}  MRR {r['mrr']}  dim {r['dimension']}")

    base = next((r for r in results if r["model"] == BASELINE), None)
    best = max(results, key=lambda r: (r["mrr"], r["p1"], r["p3"]))
    for r in results:
        r["vsBaseline"] = paired_bootstrap(base, r) if base and r["model"] != BASELINE else None
    # "Clearly better" is measured: every metric's paired-bootstrap 95 % interval sits above zero.
    clearly_better = bool(best["vsBaseline"] and all(v["ci95"][0] > 0 for v in best["vsBaseline"].values()))
    for r in results:
        r.pop("perItem", None)
    report = {
        "description": "Skill retrieval quality per local embedding model: for each catalog item, all skills ranked by cosine to the item text; P@1, P@3, MRR against the item's annotated skillsTaught. Computed by pipeline/evaluate/embedding_bakeoff.py; nothing trained.",
        "method": {
            "groundTruth": "catalog.json skillsTaught per item (model-annotated, human spot-checked)",
            "texts": "item = 'title. description', skill = 'name. description' (what embed.py encodes); nomic-embed gets its required search_query: / search_document: prefixes",
            "metrics": f"P@1, P@{K} (hits in top {K} / {K}; an item teaching fewer than {K} skills cannot reach 1.0 — the ceiling column is the mean best achievable P@{K}), MRR of the first correct skill",
            "comparison": "candidate minus baseline per metric with a paired bootstrap over items (2000 resamples, seed 42); 'clearly better' means every metric's 95 % interval lies above zero",
            "items": len(item_texts),
            "skills": len(skill_texts),
            "corpusHash": chash,
        },
        "shipped": BASELINE,
        "results": results,
        "winner": {"model": best["model"], "clearlyBetterThanBaselineOnAllThree": clearly_better},
        "decision": "swap only if clearly better on all three metrics AND the fixture-snapshot diff is reviewed and accepted; otherwise keep the shipped model",
    }
    EVIDENCE_DIR.mkdir(exist_ok=True)
    (EVIDENCE_DIR / "eval_embedding_bakeoff.json").write_text(json.dumps(report, indent=1) + "\n")
    (EVIDENCE_DIR / "eval_embedding_bakeoff.md").write_text(render_md(report))
    print(f"winner: {best['model']} (clearly better than baseline on all three: {clearly_better})")
    print(f"wrote {EVIDENCE_DIR / 'eval_embedding_bakeoff.md'}")
    return 0


def render_md(report: dict) -> str:
    m = report["method"]
    lines = [
        "# Embedding bake-off",
        "",
        "Generated by `pipeline/evaluate/embedding_bakeoff.py`. Measured, not asserted; nothing trained.",
        "",
        f"Ground truth: {m['groundTruth']}. {m['items']} items, {m['skills']} skills. {m['metrics']}.",
        "",
        "| Model | Dim | P@1 | P@3 | P@3 ceiling | MRR | Courses P@1 / MRR | Projects P@1 / MRR | Assessments P@1 / MRR | Encode s |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in report["results"]:
        bk = r["byKind"]
        kinds = " | ".join(f"{bk[k]['p1']:.3f} / {bk[k]['mrr']:.3f}" if k in bk else "—" for k in ("course", "project", "assessment"))
        tag = " (shipped)" if r["model"] == report["shipped"] else ""
        lines.append(f"| {r['model']}{tag} | {r['dimension']} | {r['p1']:.3f} | {r['p3']:.3f} | {r['p3Ceiling']:.3f} | {r['mrr']:.3f} | {kinds} | {r['encodeSeconds']} |")
    lines += ["", "Candidate minus shipped baseline, paired bootstrap over items (95 % interval):", "", "| Model | ΔP@1 | ΔP@3 | ΔMRR |", "|---|---|---|---|"]
    for r in report["results"]:
        if not r["vsBaseline"]:
            continue
        cells = " | ".join(f"{v['delta']:+.3f} [{v['ci95'][0]:+.3f}, {v['ci95'][1]:+.3f}]" for v in r["vsBaseline"].values())
        lines.append(f"| {r['model']} | {cells} |")
    w = report["winner"]
    lines += [
        "",
        f"Best by MRR: `{w['model']}`; clearly better than the shipped baseline on all three metrics (every interval above zero): {'yes' if w['clearlyBetterThanBaselineOnAllThree'] else 'no'}.",
        f"Decision rule: {report['decision']}.",
        "",
        "## Hardest items per model (first correct skill ranked lowest)",
        "",
    ]
    for r in report["results"]:
        lines.append(f"### {r['model']}")
        lines.append("")
        lines.append("| Item | First correct rank | Top 3 | Truth |")
        lines.append("|---|---|---|---|")
        for it in r["worstItems"]:
            lines.append(f"| {it['id']} | {it['firstCorrectRank']} | {', '.join(it['top3'])} | {', '.join(it['truth'])} |")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
