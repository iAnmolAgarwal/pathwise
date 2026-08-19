"""Sequencing agreement: do generated paths order skills the way real learners did?

Corpus: the five fixture learners plus every goal template under three canonical
profiles (empty, partial, time-poor) — 50 paths, produced by the engine through
pipeline/evaluate/dump_paths.ts. For each path, every ordered pair of taught skills
(skill A first taught strictly before skill B, by item order) is a sequencing decision.
Where a source (Stack Overflow question order, Coursera review order) observed that pair
above the floor, the decision is checked against the observed majority direction.

Reported per source: pairs observed, % agreement, the disagreeing pairs. Also reported:
the same split by relation — authored prerequisite edge, graph-derived (a transitive
prerequisite through path-driving edges, so the engine's order was forced by the graph),
or unrelated (the order came from scoring and phasing) — because the engine's order is
partly derived from the authored graph, which is what the sources already confirmed in the
agreement report; plus a cross-phase-only view and a stricter floor.

  python pipeline/evaluate/sequencing_agreement.py            # regenerate paths, compute, write
  python pipeline/evaluate/sequencing_agreement.py --paths pipeline/build/evaluate/paths.json

Writes pipeline/evidence/eval_sequencing_agreement.json and .md. Nothing is trained.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = PIPELINE_DIR.parent
DATA_DIR = REPO_DIR / "src" / "data"
EVIDENCE_DIR = PIPELINE_DIR / "evidence"
BUILD_DIR = PIPELINE_DIR / "build" / "evaluate"
PATHS_JSON = BUILD_DIR / "paths.json"

SOURCES = ("stackoverflow", "coursera")
SOURCE_LABEL = {"stackoverflow": "Stack Overflow question order", "coursera": "Coursera review order"}
# Stricter floor reported alongside the file's floor, as a sensitivity check.
STRICT_N = 50
STRICT_MARGIN = 0.70  # majority share needed for the stricter view


def dump_paths(out: Path) -> dict:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["npx", "tsx", "pipeline/evaluate/dump_paths.ts", "--out", str(out)],
        cwd=REPO_DIR,
        check=True,
    )
    return json.loads(out.read_text())


def load_observations(edges_file: dict) -> dict[str, dict[tuple[str, str], dict]]:
    """Per source: (from, to) -> {support, reverse, n} for every edge the source observed."""
    obs: dict[str, dict[tuple[str, str], dict]] = {s: {} for s in SOURCES}
    for e in edges_file["edges"]:
        for src, rec in (e.get("sources") or {}).items():
            if src not in obs:
                continue
            obs[src][(e["from"], e["to"])] = {"support": rec["support"], "reverse": rec["reverse"], "n": rec["n"]}
    return obs


def lookup(obs: dict[tuple[str, str], dict], a: str, b: str) -> dict | None:
    """Observation for the ordered pair (a before b), oriented so support = a-then-b."""
    if (a, b) in obs:
        r = obs[(a, b)]
        return {"support": r["support"], "reverse": r["reverse"], "n": r["n"]}
    if (b, a) in obs:
        r = obs[(b, a)]
        return {"support": r["reverse"], "reverse": r["support"], "n": r["n"]}
    return None


def transitive_closure(edges) -> dict[str, set[str]]:
    """skill -> every skill reachable upstream through path-driving edges (its prerequisites)."""
    prereqs: dict[str, set[str]] = defaultdict(set)
    for e in edges:
        prereqs[e["to"]].add(e["from"])
    memo: dict[str, set[str]] = {}

    def anc(s: str) -> set[str]:
        if s not in memo:
            memo[s] = set()
            for p in prereqs.get(s, ()):
                memo[s].add(p)
                memo[s] |= anc(p)
        return memo[s]

    return {s: anc(s) for s in set(prereqs) | {p for ps in prereqs.values() for p in ps}}


def ordered_pairs(path: dict) -> list[dict]:
    """Every (a, b) with a first taught strictly before b. Assessments do not teach, and an
    item teaches a skill only above the level the learner already holds (a later project that
    also covers a skill the learner came in with is not a sequencing decision)."""
    held = {sid: v["level"] for sid, v in path["profile"]["skills"].items()}
    first_pos: dict[str, int] = {}
    first_phase: dict[str, int] = {}
    for item in path["items"]:
        if item["kind"] == "assessment":
            continue
        for t in item["skillsTaught"]:
            s = t["skillId"]
            if t["level"] <= held.get(s, 0):
                continue
            if s not in first_pos:
                first_pos[s] = item["index"]
                first_phase[s] = item["phaseIndex"]
    skills = sorted(first_pos, key=lambda s: (first_pos[s], s))
    pairs = []
    for i, a in enumerate(skills):
        for b in skills[i + 1 :]:
            if first_pos[a] < first_pos[b]:
                pairs.append({"from": a, "to": b, "crossPhase": first_phase[a] != first_phase[b]})
    return pairs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--paths", type=Path, help="existing paths.json (skips the engine run)")
    args = ap.parse_args()

    corpus = json.loads(args.paths.read_text()) if args.paths else dump_paths(PATHS_JSON)
    edges_file = json.loads((DATA_DIR / "skill_edges.json").read_text())
    floor_n = int(edges_file["thresholds"]["confirmN"])
    obs = load_observations(edges_file)
    authored = {(e["from"], e["to"]) for e in edges_file["edges"] if e["origin"] == "authored"}
    ancestors = transitive_closure(e for e in edges_file["edges"] if e["drivesPath"])
    skill_name = {s["id"]: s["name"] for s in corpus["skills"]}

    # Unique ordered pairs across the corpus (primary) and per-path occurrences.
    uniq: dict[tuple[str, str], dict] = {}
    occurrences = 0
    both_orders = 0
    for path in corpus["paths"]:
        for p in ordered_pairs(path):
            key = (p["from"], p["to"])
            occurrences += 1
            rec = uniq.setdefault(key, {"paths": [], "crossPhaseIn": 0})
            rec["paths"].append(path["name"])
            rec["crossPhaseIn"] += int(p["crossPhase"])
    for (a, b) in list(uniq):
        if (b, a) in uniq and a < b:
            both_orders += 1

    def evaluate(pairs: dict[tuple[str, str], dict], src: str, n_floor: int, margin: float) -> dict:
        observed = agree = ties = 0
        disagreeing = []
        by_relation = {k: {"observed": 0, "agreeing": 0} for k in ("authored-edge", "graph-derived", "graph-inverted", "unrelated")}
        weighted_obs = weighted_agree = 0
        for (a, b), rec in sorted(pairs.items()):
            o = lookup(obs[src], a, b)
            if o is None or o["n"] < n_floor:
                continue
            if o["support"] == o["reverse"]:
                ties += 1
                continue
            share = o["support"] / (o["support"] + o["reverse"])
            if max(share, 1 - share) < margin:
                continue
            observed += 1
            relation = ("authored-edge" if (a, b) in authored
                        else "graph-derived" if a in ancestors.get(b, set())
                        else "graph-inverted" if (b, a) in authored or b in ancestors.get(a, set())
                        else "unrelated")
            ok = o["support"] > o["reverse"]
            w = len(rec["paths"])
            weighted_obs += w
            if ok:
                agree += 1
                weighted_agree += w
            by_relation[relation]["observed"] += 1
            by_relation[relation]["agreeing"] += int(ok)
            if not ok:
                disagreeing.append({
                    "from": a, "to": b,
                    "fromName": skill_name.get(a, a), "toName": skill_name.get(b, b),
                    "engineOrder": f"{a} before {b}",
                    "observedThisOrder": o["support"], "observedReverse": o["reverse"], "n": o["n"],
                    "observedShareThisOrder": round(share, 3),
                    "relation": relation,
                    "inPaths": len(rec["paths"]),
                })
        disagreeing.sort(key=lambda d: (-d["n"], d["from"], d["to"]))
        pct = lambda x, y: round(100 * x / y, 1) if y else None
        return {
            "floorN": n_floor,
            "majorityMargin": margin,
            "pairsObserved": observed,
            "pairsAgreeing": agree,
            "pctAgreement": pct(agree, observed),
            "tiesExcluded": ties,
            "byRelation": {k: {**v, "pctAgreement": pct(v["agreeing"], v["observed"])} for k, v in by_relation.items()},
            "weightedByPathOccurrence": {"observed": weighted_obs, "agreeing": weighted_agree, "pctAgreement": pct(weighted_agree, weighted_obs)},
            "disagreeing": disagreeing,
        }

    cross_phase_only = {k: v for k, v in uniq.items() if v["crossPhaseIn"] == len(v["paths"])}
    inverted = sorted(
        (
            {"from": a, "to": b, "fromName": skill_name.get(a, a), "toName": skill_name.get(b, b), "inPaths": sorted(set(v["paths"]))}
            for (a, b), v in uniq.items()
            if (b, a) in authored or b in ancestors.get(a, set())
        ),
        key=lambda d: (d["from"], d["to"]),
    )
    per_path_counts = {p["name"]: len(ordered_pairs(p)) for p in corpus["paths"]}
    report = {
        "description": "Agreement between the engine's skill order in generated paths and the majority order observed in real learner sequences, per source. Computed by pipeline/evaluate/sequencing_agreement.py; nothing trained.",
        "method": {
            "corpus": "5 fixture learners + 15 goal templates x 3 canonical profiles (empty, partial, time-poor) = 50 generated paths",
            "pair": "ordered pair (A, B) of taught skills where A's first teaching item precedes B's first teaching item in path order; assessments do not teach, and an item teaches a skill only above the level the learner already holds; ties (same item) are not pairs",
            "observed": f"a source observed the pair with n >= {floor_n} (the file's confirm floor) and a strict majority; majority direction = support > reverse",
            "agreement": "the engine's order matches the observed majority direction",
            "relation": "authored-edge: A -> B is an authored prerequisite edge; graph-derived: A is a transitive prerequisite of B through path-driving edges (the engine's order follows the graph); graph-inverted: the graph says B before A yet the engine taught A first (a phase project covering a skill before its prerequisite course, or a cycle-broken soft edge) — an engine finding, not a learner-order one; unrelated: no graph relation either way (the order came from scoring and phasing, not from a prerequisite claim)",
            "confound": "the engine's order is partly derived from the authored prerequisite graph, and the authored edges are what the sources were already checked against in the agreement report; the unrelated split is the least confounded view and the authored-edge split the most",
        },
        "corpus": {
            "paths": len(corpus["paths"]),
            "fixturePaths": sum(p["kind"] == "fixture" for p in corpus["paths"]),
            "templatePaths": sum(p["kind"] == "template" for p in corpus["paths"]),
            "orderedPairOccurrences": occurrences,
            "uniqueOrderedPairs": len(uniq),
            "pairsSeenInBothOrdersAcrossPaths": both_orders,
            "graphInvertedPairs": inverted,
            "pairsPerPath": per_path_counts,
        },
        "results": {
            src: {
                "label": SOURCE_LABEL[src],
                "atFloor": evaluate(uniq, src, floor_n, 0.5),
                "crossPhaseOnly": evaluate(cross_phase_only, src, floor_n, 0.5),
                "strict": evaluate(uniq, src, STRICT_N, STRICT_MARGIN),
            }
            for src in SOURCES
        },
        "inputs": {"skill_edges.json": edges_file["inputs"], "thresholds": edges_file["thresholds"]},
    }
    EVIDENCE_DIR.mkdir(exist_ok=True)
    (EVIDENCE_DIR / "eval_sequencing_agreement.json").write_text(json.dumps(report, indent=1, sort_keys=True) + "\n")
    (EVIDENCE_DIR / "eval_sequencing_agreement.md").write_text(render_md(report))
    for src in SOURCES:
        r = report["results"][src]["atFloor"]
        print(f"{SOURCE_LABEL[src]}: {r['pairsObserved']} pairs observed, {r['pctAgreement']} % agree, {len(r['disagreeing'])} disagree")
    print(f"wrote {EVIDENCE_DIR / 'eval_sequencing_agreement.md'}")
    return 0


def render_md(report: dict) -> str:
    c = report["corpus"]
    lines = [
        "# Sequencing agreement",
        "",
        "Generated by `pipeline/evaluate/sequencing_agreement.py`. Measured, not asserted; nothing trained.",
        "",
        f"Corpus: {c['paths']} generated paths ({c['fixturePaths']} fixture learners, {c['templatePaths']} template x profile paths); "
        f"{c['uniqueOrderedPairs']} unique ordered skill pairs ({c['orderedPairOccurrences']} occurrences across paths).",
        "",
        "| Source | View | Pairs observed | Agreeing | Agreement | Authored edges | Graph-derived | Graph-inverted | Unrelated |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for src, r in report["results"].items():
        for view, label in (("atFloor", f"n ≥ {r['atFloor']['floorN']}"), ("crossPhaseOnly", "cross-phase pairs only"), ("strict", f"n ≥ {r['strict']['floorN']}, majority ≥ {int(r['strict']['majorityMargin']*100)} %")):
            v = r[view]
            cells = " | ".join(f"{b['agreeing']} / {b['observed']} ({b['pctAgreement']} %)" for b in v["byRelation"].values())
            lines.append(f"| {r['label']} | {label} | {v['pairsObserved']} | {v['pairsAgreeing']} | {v['pctAgreement']} % | {cells} |")
    inv = c["graphInvertedPairs"]
    lines += ["", f"Pairs where the engine taught a skill before one of its own prerequisites (graph-inverted, any source): {len(inv)} of {c['uniqueOrderedPairs']}.", ""]
    for d in inv:
        lines.append(f"- {d['fromName']} before {d['toName']} — in {', '.join(d['inPaths'])}")
    lines += ["", "## Disagreeing pairs (at the floor)", ""]
    for src, r in report["results"].items():
        lines.append(f"### {r['label']}")
        lines.append("")
        dis = r["atFloor"]["disagreeing"]
        if not dis:
            lines.append("none")
        else:
            lines.append("| Engine order | Learners this order | Learners reverse | n | Share this order | Relation | In paths |")
            lines.append("|---|---|---|---|---|---|---|")
            for d in dis:
                lines.append(f"| {d['fromName']} → {d['toName']} | {d['observedThisOrder']} | {d['observedReverse']} | {d['n']} | {int(round(d['observedShareThisOrder']*100))} % | {d['relation']} | {d['inPaths']} |")
        lines.append("")
    m = report["method"]
    lines += ["## Method", "", f"- Corpus: {m['corpus']}.", f"- Pair: {m['pair']}.", f"- Observed: {m['observed']}.", f"- Agreement: {m['agreement']}.", f"- Relation: {m['relation']}.", f"- Confound: {m['confound']}.", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
