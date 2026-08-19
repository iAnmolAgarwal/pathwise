"""Pool Coursera course-level evidence up to skill level -> pipeline/evidence/edges_coursera.json,
branches_coursera.json, pooled_support_histogram.md, cross_domain_candidates.md.

Stack Overflow evidence is mined at skill level already (mine_so.py); Coursera evidence is
course-level (mine_coursera.py) and reaches skills only through the Ring-1 course tags
(tag_courses.py). This script does that lift and nothing else — no raw CSV, no network, no
model; it reads committed files only and is deterministic.

Edges. A course edge (C1 -> C2, support, reverse) pools onto (s_from, s_to) for every
s_from taught by C1 and s_to taught by C2 with s_from != s_to. A course pair may therefore
pool onto several skill pairs, and a skill pair may collect several course pairs. The two
orientations of a skill pair are combined (the reverse count of C1 -> C2 pooled on (a, b)
is support for (b, a)) and the pooled edge is stored once, oriented so support >= reverse,
with confidence = support / n, n = support + reverse, nCoursePairs, and the top-5 course
pairs behind the stored direction. Tags of every confidence level are used; the set passed
the spot-check gate as a whole.

Pooled pairs whose skills are not in each other's authored prerequisite closure are kept in
the edge file but bucketed as "cross-domain candidates" in a separate report — they are
inspected by a person, never silently dropped (ARCHITECTURE §15.4).

Branches. Course-level immediate-successor counts (branches_coursera_course.json) lift the
same way: a transition C1 -> C2 with n names counts n for every (s1, s2), s1 taught by C1,
s2 by C2, s1 != s2. Per from-skill: nTotal = sum over observed next-skills, uniform prior
over those next-skills, shareShrunk = (n + alpha * prior) / (nTotal + alpha) with alpha = 20,
a branch is listed only at n >= 5, minSupportMet = nTotal >= 50 — the same floors and
shrinkage as the Stack Overflow branches. Transition shares only; nothing rating-derived.

The first output of this stage is the measured pooled-support histogram; nothing downstream
(merge_edges.py) is written before it exists.

Commands (repo root):
  python pipeline/pool.py run
  python pipeline/pool.py check-schema
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
sys.path.insert(0, str(PIPELINE_DIR))
from mine_coursera import CAVEAT, LICENCE, SOURCE, dump, sha256_file  # noqa: E402

REPO_ROOT = PIPELINE_DIR.parent
DATA_DIR = REPO_ROOT / "src" / "data"
EVIDENCE_DIR = PIPELINE_DIR / "evidence"
SOURCES_DIR = PIPELINE_DIR / "sources"
IN_EDGES = EVIDENCE_DIR / "edges_coursera_course.json"
IN_SUCCESSORS = EVIDENCE_DIR / "branches_coursera_course.json"
IN_TAGS = EVIDENCE_DIR / "course_skill_tags.json"
IN_CATALOG_MAP = SOURCES_DIR / "coursera_catalog_map.json"
OUT_EDGES = EVIDENCE_DIR / "edges_coursera.json"
OUT_BRANCHES = EVIDENCE_DIR / "branches_coursera.json"
OUT_HISTOGRAM = EVIDENCE_DIR / "pooled_support_histogram.md"
OUT_CROSS_DOMAIN = EVIDENCE_DIR / "cross_domain_candidates.md"

PARAMS = {
    "branchAlpha": 20,
    "branchMinListed": 5,
    "branchMinTotal": 50,
    "topCoursePairs": 5,
}
SUPPORT_BINS = [(1, 19), (20, 49), (50, 99), (100, 199), (200, 499), (500, 999), (1000, None)]
CONFIDENCE_BINS = [(0.5, 0.7), (0.7, 0.85), (0.85, 0.95), (0.95, 1.0001)]


def load_json(path: Path):
    return json.loads(path.read_text())


def prereq_closure(skills: list[dict]) -> dict[str, set[str]]:
    """skill id -> every transitive authored prerequisite."""
    prereqs = {s["id"]: list(s.get("prereqs", [])) for s in skills}
    memo: dict[str, set[str]] = {}

    def anc(sid: str) -> set[str]:
        if sid in memo:
            return memo[sid]
        out: set[str] = set()
        for p in prereqs.get(sid, []):
            out.add(p)
            out |= anc(p)
        memo[sid] = out
        return out

    return {sid: anc(sid) for sid in prereqs}


def relation(a: str, b: str, direct: set[tuple[str, str]], closure: dict[str, set[str]]) -> str:
    """How the authored graph relates a -> b: 'direct' (an authored edge either way), 'ancestor'
    (one is a transitive prerequisite of the other), else 'unrelated' (a cross-domain candidate)."""
    if (a, b) in direct or (b, a) in direct:
        return "direct"
    if a in closure.get(b, set()) or b in closure.get(a, set()):
        return "ancestor"
    return "unrelated"


def pool_edges(course_edges: list[dict], tags: dict[str, list[str]], item_of: dict[str, str]) -> tuple[list[dict], dict]:
    support: Counter = Counter()  # (s_from, s_to) -> pooled support in that direction
    contributors: dict[tuple[str, str], dict[tuple[str, str], int]] = defaultdict(dict)  # course pairs behind a direction
    used_course_edges = 0
    lifted = 0
    for e in course_edges:
        tf, tt = tags.get(e["fromCourseId"], []), tags.get(e["toCourseId"], [])
        pairs = [(a, b) for a in tf for b in tt if a != b]
        if not pairs:
            continue
        used_course_edges += 1
        for a, b in pairs:
            lifted += 1
            support[(a, b)] += e["support"]
            support[(b, a)] += e["reverse"]
            contributors[(a, b)][(e["fromCourseId"], e["toCourseId"])] = e["support"]
            if e["reverse"]:
                contributors[(b, a)][(e["toCourseId"], e["fromCourseId"])] = e["reverse"]
    edges = []
    for a, b in sorted({tuple(sorted(k)) for k in support}):
        ab, ba = support[(a, b)], support[(b, a)]
        frm, to, sup, rev = (a, b, ab, ba) if ab >= ba else (b, a, ba, ab)
        n = sup + rev
        course_pairs = contributors.get((frm, to), {})
        reverse_pairs = contributors.get((to, frm), {})
        all_pairs = {tuple(sorted(k)) for k in list(course_pairs) + list(reverse_pairs)}

        def top(d: dict) -> list[dict]:
            return [
                {
                    "fromCourseId": c1,
                    "toCourseId": c2,
                    "support": s,
                    **({"fromItem": item_of[c1]} if c1 in item_of else {}),
                    **({"toItem": item_of[c2]} if c2 in item_of else {}),
                }
                for (c1, c2), s in sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))[: PARAMS["topCoursePairs"]]
            ]

        edges.append(
            {
                "from": frm,
                "to": to,
                "support": sup,
                "reverse": rev,
                "confidence": round(sup / n, 6),
                "n": n,
                "nCoursePairs": len(all_pairs),
                "coursePairs": top(course_pairs),
                "reverseCoursePairs": top(reverse_pairs),
            }
        )
    edges.sort(key=lambda e: (e["from"], e["to"]))
    return edges, {"courseEdgesUsed": used_course_edges, "liftedPairs": lifted}


def pool_branches(successors: list[dict], tags: dict[str, list[str]], taught: set[str]) -> list[dict]:
    per_from: dict[str, Counter] = defaultdict(Counter)
    for r in successors:
        for a in tags.get(r["fromCourseId"], []):
            for b in tags.get(r["toCourseId"], []):
                if a != b:
                    per_from[a][b] += r["n"]
    alpha = PARAMS["branchAlpha"]
    out = []
    for frm in sorted(per_from):
        succ = per_from[frm]
        n_total = sum(succ.values())
        k = len(succ)
        prior = 1.0 / k
        listed = []
        for to, n in sorted(succ.items(), key=lambda kv: (-kv[1], kv[0])):
            if n < PARAMS["branchMinListed"]:
                continue
            listed.append(
                {
                    "to": to,
                    "n": n,
                    "shareRaw": round(n / n_total, 8),
                    "shareShrunk": round((n + alpha * prior) / (n_total + alpha), 8),
                    "inCatalog": to in taught,
                }
            )
        out.append(
            {
                "from": frm,
                "source": SOURCE,
                "next": listed,
                "nTotal": n_total,
                "nNextObserved": k,
                "minSupportMet": n_total >= PARAMS["branchMinTotal"],
                "caveat": CAVEAT,
            }
        )
    return out


def bin_label(lo, hi) -> str:
    return f"{lo}+" if hi is None else f"{lo}–{hi}"


def histogram(values: list[int], bins) -> list[tuple[str, int]]:
    return [(bin_label(lo, hi), sum(1 for v in values if v >= lo and (hi is None or v <= hi))) for lo, hi in bins]


def conf_histogram(values: list[float]) -> list[tuple[str, int]]:
    return [(f"{lo:.2f}–{min(hi, 1.0):.2f}", sum(1 for v in values if lo <= v < hi)) for lo, hi in CONFIDENCE_BINS]


def authored_edges(skills: list[dict]) -> list[tuple[str, str]]:
    return sorted((p, s["id"]) for s in skills for p in s.get("prereqs", []))


def write_histogram(path: Path, edges: list[dict], branches: list[dict], stats: dict, skills: list[dict], names: dict) -> None:
    authored = authored_edges(skills)
    by_pair = {(e["from"], e["to"]): e for e in edges}
    by_pair.update({(e["to"], e["from"]): e for e in edges})
    observed = [e for e in authored if e in by_pair]
    covered_skills = {s for e in edges for s in (e["from"], e["to"])}
    L = [
        "# Pooled support histogram — Coursera course→course edges lifted to skills",
        "",
        "Produced by `python pipeline/pool.py run` from the committed Ring-1 course tags and course-level edges; "
        "every number is computed. This is the first output of the pooling stage (ARCHITECTURE §15.4): the "
        "\"1,617\" figure in the original proposal was illustrative, this is the measurement.",
        "",
        f"- Caveat on every number: {CAVEAT}",
        f"- Inputs: {stats['courseEdges']} course edges (conf ≥ 0.85, support ≥ 20) over {stats['ring1Courses']} Ring-1 courses; "
        f"{stats['coursesWithTags']} of those courses carry ≥ 1 skill tag ({stats['tagsTotal']} tags); "
        f"{stats['courseEdgesUsed']} course edges have a tagged course at both ends and lift to {stats['liftedPairs']} (course pair, skill pair) contributions.",
        f"- Pooled skill→skill edges: **{len(edges)}** over **{len(covered_skills)}** skills; "
        f"{stats['relation']['direct']} sit on an authored edge, {stats['relation']['ancestor']} inside the authored prerequisite closure, "
        f"{stats['relation']['unrelated']} cross-domain candidates (see cross_domain_candidates.md).",
        f"- Authored edges ({len(authored)}) with a pooled Coursera observation in either direction: **{len(observed)}**.",
        "",
        "Pooled confidence is computed from course pairs that passed the course-level 0.85 floor, so a pooled reverse "
        "count can come only from kept course pairs whose skills point the other way; a single-course-pair edge "
        "inherits that pair's confidence. The histogram therefore says how much support each skill pair collects, "
        "not how often learners went the other way at course level below the floor.",
        "",
        "## Support per pooled edge",
        "",
        "| support | edges |",
        "|---|---|",
    ]
    L += [f"| {lab} | {c} |" for lab, c in histogram([e["support"] for e in edges], SUPPORT_BINS)]
    L += ["", "## n (support + reverse) per pooled edge", "", "| n | edges |", "|---|---|"]
    L += [f"| {lab} | {c} |" for lab, c in histogram([e["n"] for e in edges], SUPPORT_BINS)]
    L += ["", "## Confidence per pooled edge", "", "| confidence | edges |", "|---|---|"]
    L += [f"| {lab} | {c} |" for lab, c in conf_histogram([e["confidence"] for e in edges])]
    L += ["", "## Course pairs per pooled edge", "", "| nCoursePairs | edges |", "|---|---|"]
    L += [f"| {lab} | {c} |" for lab, c in histogram([e["nCoursePairs"] for e in edges], [(1, 1), (2, 2), (3, 4), (5, 9), (10, None)])]
    L += [
        "",
        "## Against the promotion thresholds (§15.6: conf ≥ 0.85, support ≥ 50, ≥ 2 course pairs)",
        "",
        f"- pooled edges meeting all three: {stats['meetsPromotionThresholds']} "
        f"(of which {stats['meetsPromotionThresholdsUnrelated']} cross-domain, {stats['meetsPromotionThresholdsNoAuthored']} without an authored counterpart)",
        f"- pooled edges at conf ≥ 0.70 and n ≥ 20 (the §15.5 confirm floor): {stats['atConfirmFloor']}",
        "",
        "## Branches (transition shares, same floors as Stack Overflow: nTotal ≥ 50, listed at n ≥ 5, α = 20)",
        "",
        f"- from-skills observed: {stats['branches']['fromSkills']}; with nTotal ≥ 50: **{stats['branches']['fromSkillsMinSupportMet']}**; "
        f"listed transitions: {stats['branches']['listedTransitions']}; course-level transitions lifted: {stats['successorTransitions']}",
        "",
        "| nTotal | from-skills |",
        "|---|---|",
    ]
    L += [f"| {lab} | {c} |" for lab, c in histogram([b["nTotal"] for b in branches], [(1, 4), (5, 19), (20, 49), (50, 99), (100, 499), (500, None)])]
    L += ["", "## Top 20 pooled edges by support", "", "| from | to | support | reverse | conf | n | course pairs | relation |", "|---|---|---|---|---|---|---|---|"]
    for e in sorted(edges, key=lambda e: (-e["support"], e["from"], e["to"]))[:20]:
        L.append(
            f"| {names.get(e['from'], e['from'])} | {names.get(e['to'], e['to'])} | {e['support']} | {e['reverse']} | "
            f"{e['confidence']:.3f} | {e['n']} | {e['nCoursePairs']} | {e['authoredRelation']} |"
        )
    L.append("")
    path.write_text("\n".join(L))


def write_cross_domain(path: Path, edges: list[dict], names: dict, courses: dict) -> None:
    rows = [e for e in edges if e["authoredRelation"] == "unrelated"]
    L = [
        "# Cross-domain candidates — pooled Coursera skill pairs outside the authored prerequisite closure",
        "",
        "Produced by `python pipeline/pool.py run`. These pairs are kept in `edges_coursera.json` (they reach "
        "`skill_edges.json` as `candidate` edges like every other mined-only pair) but are listed here separately "
        "because neither skill is an authored prerequisite of the other, directly or transitively: this is where "
        "coincidence chains surface (learners who took two unrelated specializations in a row). They are inspected, "
        "not dropped; promotion follows the §15.6 policy and a human tick like any other candidate.",
        "",
        f"- Caveat on every number: {CAVEAT}",
        f"- Candidates: {len(rows)} of {len(edges)} pooled edges",
        "",
        "| from | to | support | reverse | conf | n | course pairs | top course pair |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for e in sorted(rows, key=lambda e: (-e["support"], e["from"], e["to"])):
        cp = e["coursePairs"][0] if e["coursePairs"] else None
        top = f"{courses[cp['fromCourseId']]['name']} → {courses[cp['toCourseId']]['name']} ({cp['support']})" if cp else ""
        L.append(
            f"| {names.get(e['from'], e['from'])} | {names.get(e['to'], e['to'])} | {e['support']} | {e['reverse']} | "
            f"{e['confidence']:.3f} | {e['n']} | {e['nCoursePairs']} | {top} |"
        )
    L.append("")
    path.write_text("\n".join(L))


def run() -> int:
    for p in (IN_EDGES, IN_SUCCESSORS, IN_TAGS, IN_CATALOG_MAP):
        if not p.exists():
            print(f"missing {p.relative_to(REPO_ROOT)} — run mine_coursera.py and tag_courses.py first")
            return 2
    course_doc = load_json(IN_EDGES)
    succ_doc = load_json(IN_SUCCESSORS)
    tags_doc = load_json(IN_TAGS)
    skills = load_json(DATA_DIR / "skills.json")
    catalog = load_json(DATA_DIR / "catalog.json")
    cmap = load_json(IN_CATALOG_MAP)

    skill_ids = {s["id"] for s in skills}
    names = {s["id"]: s["name"] for s in skills}
    tags = {t["courseId"]: sorted({x["skillId"] for x in t.get("skillsTaught", [])}) for t in tags_doc["tags"]}
    unknown = sorted({sid for v in tags.values() for sid in v} - skill_ids)
    if unknown:
        print(f"course_skill_tags.json references unknown skills: {unknown}")
        return 1
    item_of = {r["courseId"]: r["catalogItemId"] for r in cmap.get("rows", [])}
    taught = {t["skillId"] for item in catalog for t in item.get("skillsTaught", [])}
    direct = set(authored_edges(skills))
    closure = prereq_closure(skills)

    edges, pool_info = pool_edges(course_doc["edges"], tags, item_of)
    for e in edges:
        e["authoredRelation"] = relation(e["from"], e["to"], direct, closure)
    branches = pool_branches(succ_doc["successors"], tags, taught)

    rel = Counter(e["authoredRelation"] for e in edges)
    meets = [e for e in edges if e["confidence"] >= 0.85 and e["support"] >= 50 and e["nCoursePairs"] >= 2]
    stats = {
        "courseEdges": len(course_doc["edges"]),
        "ring1Courses": len(course_doc["courses"]),
        "coursesWithTags": sum(1 for v in tags.values() if v),
        "tagsTotal": sum(len(v) for v in tags.values()),
        **pool_info,
        "pooledEdges": len(edges),
        "skillsCovered": len({s for e in edges for s in (e["from"], e["to"])}),
        "relation": {k: rel.get(k, 0) for k in ("direct", "ancestor", "unrelated")},
        "authoredEdges": len(direct),
        "authoredEdgesObserved": sum(1 for e in edges if e["authoredRelation"] == "direct"),
        "atConfirmFloor": sum(1 for e in edges if e["confidence"] >= 0.70 and e["n"] >= 20),
        "meetsPromotionThresholds": len(meets),
        "meetsPromotionThresholdsUnrelated": sum(1 for e in meets if e["authoredRelation"] == "unrelated"),
        "meetsPromotionThresholdsNoAuthored": sum(1 for e in meets if e["authoredRelation"] != "direct"),
        "supportHistogram": dict(histogram([e["support"] for e in edges], SUPPORT_BINS)),
        "successorTransitions": succ_doc["stats"]["transitions"],
        "branches": {
            "fromSkills": len(branches),
            "fromSkillsMinSupportMet": sum(1 for b in branches if b["minSupportMet"]),
            "fromSkillsWithListed": sum(1 for b in branches if b["next"]),
            "listedTransitions": sum(len(b["next"]) for b in branches),
        },
    }
    inputs = {p.name: sha256_file(p) for p in (IN_EDGES, IN_SUCCESSORS, IN_TAGS, IN_CATALOG_MAP)}
    edges_out = {
        "source": SOURCE,
        "caveat": CAVEAT,
        "licence": LICENCE,
        "datasetUrl": course_doc["datasetUrl"],
        "method": (
            "each course edge (conf >= 0.85, support >= 20) pools onto (s_from, s_to) for every s_from taught by the "
            "from-course and s_to taught by the to-course, s_from != s_to; both orientations combined; stored once "
            "oriented so support >= reverse; confidence = support / n; nCoursePairs = distinct course pairs behind either "
            "direction; coursePairs = top-5 behind the stored direction; authoredRelation = direct | ancestor | unrelated "
            "against the authored prerequisite graph (unrelated = cross-domain candidate)"
        ),
        "params": {"topCoursePairs": PARAMS["topCoursePairs"], "courseEdgeFloors": course_doc["params"]},
        "inputs": inputs,
        "stats": {k: v for k, v in stats.items() if k not in ("branches", "successorTransitions")},
        "edges": edges,
    }
    branches_out = {
        "source": SOURCE,
        "caveat": CAVEAT,
        "licence": LICENCE,
        "datasetUrl": course_doc["datasetUrl"],
        "branchRule": (
            f"{succ_doc['rule']}; each course transition lifts to every (s1, s2) with s1 taught by the from-course and s2 "
            "by the to-course, s1 != s2 (so one transition may count for several skill pairs); nTotal = sum over observed next-skills"
        ),
        "shrinkage": (
            "shareShrunk = (n + alpha * prior) / (nTotal + alpha), uniform prior 1/nNextObserved over the observed "
            "next-skills; shares sum to 1 over all observed successors, the listed subset (n >= branchMinListed) sums to less"
        ),
        "params": {k: PARAMS[k] for k in ("branchAlpha", "branchMinListed", "branchMinTotal")},
        "inputs": inputs,
        "stats": {"successorTransitions": stats["successorTransitions"], **stats["branches"]},
        "branches": branches,
    }
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    write_histogram(OUT_HISTOGRAM, edges, branches, stats, skills, names)
    write_cross_domain(OUT_CROSS_DOMAIN, edges, names, course_doc["courses"])
    dump(OUT_EDGES, edges_out, "edges")
    dump(OUT_BRANCHES, branches_out, "branches")
    print(f"wrote {OUT_HISTOGRAM.relative_to(REPO_ROOT)} (read this first)")
    print(f"wrote {OUT_EDGES.relative_to(REPO_ROOT)}: {len(edges)} pooled edges over {stats['skillsCovered']} skills "
          f"({stats['relation']['direct']} direct / {stats['relation']['ancestor']} ancestor / {stats['relation']['unrelated']} unrelated)")
    print(f"wrote {OUT_BRANCHES.relative_to(REPO_ROOT)}: {len(branches)} from-skills, {stats['branches']['fromSkillsMinSupportMet']} at nTotal >= 50")
    print(f"wrote {OUT_CROSS_DOMAIN.relative_to(REPO_ROOT)}: {stats['relation']['unrelated']} candidates")
    return 0


def _require(cond: bool, msg: str, errors: list[str]) -> None:
    if not cond:
        errors.append(msg)


def check_schema() -> int:
    """Pipeline-side mirror of the pooled-evidence shape merge_edges.py and validate.py rely on."""
    errors: list[str] = []
    skills = load_json(DATA_DIR / "skills.json")
    skill_ids = {s["id"] for s in skills}
    e = load_json(OUT_EDGES)
    for key in ("source", "caveat", "method", "params", "inputs", "stats", "edges"):
        _require(key in e, f"edges_coursera.json: missing {key}", errors)
    _require(e.get("source") == SOURCE and e.get("caveat") == CAVEAT, "edges_coursera.json: source/caveat", errors)
    seen = set()
    for edge in e.get("edges", []):
        key = (edge.get("from"), edge.get("to"))
        _require(key not in seen and (key[1], key[0]) not in seen, f"edges_coursera.json: duplicate {key}", errors)
        seen.add(key)
        _require(key[0] != key[1] and key[0] in skill_ids and key[1] in skill_ids, f"edges_coursera.json: {key} endpoints", errors)
        for f in ("support", "reverse", "n", "nCoursePairs"):
            _require(isinstance(edge.get(f), int) and edge[f] >= 0, f"edges_coursera.json: {key} bad {f}", errors)
        _require(edge.get("support", 0) >= edge.get("reverse", 0), f"edges_coursera.json: {key} not oriented", errors)
        _require(edge.get("n") == edge.get("support", 0) + edge.get("reverse", 0), f"edges_coursera.json: {key} n", errors)
        _require(edge.get("n", 0) > 0 and abs(edge.get("confidence", -1) - edge["support"] / edge["n"]) < 1e-5, f"edges_coursera.json: {key} confidence", errors)
        _require(edge.get("nCoursePairs", 0) >= 1 and 1 <= len(edge.get("coursePairs", [])) <= PARAMS["topCoursePairs"], f"edges_coursera.json: {key} coursePairs", errors)
        _require(edge.get("authoredRelation") in ("direct", "ancestor", "unrelated"), f"edges_coursera.json: {key} authoredRelation", errors)
    _require(e.get("stats", {}).get("pooledEdges") == len(seen), "edges_coursera.json: stats.pooledEdges mismatch", errors)

    b = load_json(OUT_BRANCHES)
    for key in ("source", "caveat", "branchRule", "shrinkage", "params", "inputs", "stats", "branches"):
        _require(key in b, f"branches_coursera.json: missing {key}", errors)
    _require(b.get("inputs") == e.get("inputs"), "branches_coursera.json: inputs differ from edges_coursera.json", errors)
    froms = set()
    for br in b.get("branches", []):
        frm = br.get("from")
        _require(frm in skill_ids and frm not in froms, f"branches_coursera.json: from {frm!r}", errors)
        froms.add(frm)
        _require(br.get("source") == SOURCE and br.get("caveat") == CAVEAT, f"branches_coursera.json: {frm} source/caveat", errors)
        _require(br.get("minSupportMet") == (br.get("nTotal", 0) >= PARAMS["branchMinTotal"]), f"branches_coursera.json: {frm} minSupportMet", errors)
        _require(isinstance(br.get("nNextObserved"), int) and br["nNextObserved"] >= len(br.get("next", [])), f"branches_coursera.json: {frm} nNextObserved", errors)
        for nx in br.get("next", []):
            _require(nx.get("to") in skill_ids and nx["to"] != frm, f"branches_coursera.json: {frm}->{nx.get('to')} endpoint", errors)
            _require(nx.get("n", 0) >= PARAMS["branchMinListed"], f"branches_coursera.json: {frm}->{nx.get('to')} below listing floor", errors)
            _require(0 < nx.get("shareRaw", 0) <= 1 and 0 < nx.get("shareShrunk", 0) <= 1, f"branches_coursera.json: {frm}->{nx.get('to')} share range", errors)
            _require(isinstance(nx.get("inCatalog"), bool), f"branches_coursera.json: {frm}->{nx.get('to')} inCatalog", errors)
    _require(OUT_HISTOGRAM.exists(), "pooled_support_histogram.md missing", errors)
    if errors:
        print("check-schema FAILED:")
        for m in errors[:30]:
            print(f"  - {m}")
        return 1
    print(f"check-schema OK: {len(seen)} pooled edges, {len(froms)} branch from-skills")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run")
    sub.add_parser("check-schema")
    a = ap.parse_args()
    return run() if a.cmd == "run" else check_schema()


if __name__ == "__main__":
    sys.exit(main())
