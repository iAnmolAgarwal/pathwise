"""Coursera review-order mining -> pipeline/evidence/edges_coursera_course.json, coursera_stats.md.

Signal. The Kaggle corpus "Course Reviews on Coursera" (imuhammad; 1.45 M reviews of 623
courses, 2015-2020) carries a reviewer display name and a review date per row. Treating each
name as a pseudo-learner and the order of their reviews as the order they took the courses
gives, per ordered course pair (A before B), a count of learners who reviewed A first. This is
Riyan Garg's method, reproduced here at his recommended confidence floor of 0.85; his 0.70
baseline is recomputed from the same rows in the same run so the cost of the higher floor is
visible next to it, never quoted from memory.

Method (the parameters are printed into the output):
  1. drop literal duplicate rows on (reviewer, course, date, rating, text) — the scrape
     repeats most reviews two to five times;
  2. drop the placeholder name "By Deleted A";
  3. keep names with MIN_REVIEWS..MAX_REVIEWS distinct reviews (one-review names carry no
     order; names above the band are near-certainly many people sharing a display name);
  4. per name, take the first review date of each distinct course and count every ordered
     pair of distinct courses once per name; same-day pairs carry no order and are dropped;
  5. keep support >= MIN_SUPPORT; confidence = AB / (AB + BA); keep confidence >= MIN_CONF.

Course->skill lifting is not done here (tag_courses.py, then pool.py); this file is
course-level and every number carries the fixed caveat below. The same run also writes
branches_coursera_course.json: per name, Ring-1 courses ordered by first review date; every
course on the next distinct date is an immediate successor of every course on the current
date (the rule mine_so.py uses); counts per (from, to) over Ring-1 courses only, so pool.py
can lift them to skill-level transition shares without touching the raw CSV again. Raw CSVs live in the
gitignored pipeline/build/coursera/ (Kaggle source, see README); output is deterministic
(same CSVs -> byte-identical JSON) and no language model is involved.

Commands (repo root):
  python pipeline/mine_coursera.py run [--reviews PATH] [--courses PATH]
  python pipeline/mine_coursera.py check-schema
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import resource
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
REPO_ROOT = PIPELINE_DIR.parent
BUILD_DIR = PIPELINE_DIR / "build" / "coursera"
EVIDENCE_DIR = PIPELINE_DIR / "evidence"
OUT_EDGES = EVIDENCE_DIR / "edges_coursera_course.json"
OUT_STATS = EVIDENCE_DIR / "coursera_stats.md"
OUT_BRANCHES = EVIDENCE_DIR / "branches_coursera_course.json"
DEFAULT_REVIEWS = BUILD_DIR / "Coursera_reviews.csv"
DEFAULT_COURSES = BUILD_DIR / "Coursera_courses.csv"

SOURCE = "coursera"
CAVEAT = (
    "Coursera learners 2015–2020; sequences reconstructed from review order; "
    "pseudo-users by reviewer name"
)
LICENCE = (
    "Kaggle dataset 'Course Reviews on Coursera' (imuhammad), CC0: Public Domain; "
    "aggregate counts only, no review text leaves pipeline/build/"
)
DATASET_URL = "https://www.kaggle.com/datasets/imuhammad/course-reviews-on-coursera"
DELETED_NAME = "By Deleted A"
DATE_FORMAT = "%b %d, %Y"
PARAMS = {
    "minReviews": 2,
    "maxReviews": 15,
    "minSupport": 20,  # directed count AB >= 20 keeps a pair
    "minConfidence": 0.85,  # AB / (AB + BA)
    "dedupLiteralRows": True,
    "sameDayTies": "dropped",
    "baselineConfidence": 0.70,  # Riyan's floor, recomputed for the comparison only
}
METHOD = (
    "literal duplicate rows dropped on (reviewer, course, date, rating, text); '{deleted}' dropped; "
    "names with {minReviews}-{maxReviews} distinct reviews; per name the first review date of each "
    "distinct course; every ordered pair of distinct courses counted once per name; same-day pairs "
    "dropped; support >= {minSupport}; confidence = AB/(AB+BA) >= {minConfidence}"
).format(deleted=DELETED_NAME, **PARAMS)

# Riyan's chains (course ids from Coursera_courses.csv). A success chain must survive edge by
# edge at 0.85; a nonsense chain must lose at least one edge. Reported either way.
SUCCESS_CHAINS = {
    "python-for-everybody": ["python", "python-data", "python-network-data", "python-data-visualization"],
    "ibm-cybersecurity": [
        "introduction-cybersecurity-cyber-attacks",
        "cybersecurity-roles-processes-operating-system-security",
        "cybersecurity-compliance-framework-system-administration",
    ],
    "uci-project-management": ["project-planning", "schedule-projects", "project-risk-management"],
    "ml-to-tensorflow": [  # Stanford's Machine Learning, then two TensorFlow in Practice courses
        "machine-learning",
        "convolutional-neural-networks-tensorflow",
        "tensorflow-sequences-time-series-and-prediction",
    ],
}
NONSENSE_CHAINS = {
    "food-health-python-css": ["food-and-health", "python-data", "introcss"],
    "customer-analytics-deep-learning": ["wharton-customer-analytics", "neural-networks-deep-learning"],
    "python-css": ["python", "python-data", "introcss"],
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_courses(path: Path) -> dict[str, dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return {
            r["course_id"]: {"name": r["name"], "institution": r["institution"], "url": r["course_url"]}
            for r in csv.DictReader(f)
        }


def read_reviews(path: Path) -> tuple[dict[str, list[tuple[int, int, str]]], dict[str, list[tuple[int, int, str]]], dict]:
    """One streaming pass. Returns per-name review lists after literal dedup, the raw (undeduped)
    lists Riyan's baseline needs, and the row counts. Each review is (dateOrdinal, fileOrder, courseId).
    Review text is hashed into the dedup key and never kept."""
    csv.field_size_limit(1 << 30)
    dedup: dict[str, list] = defaultdict(list)
    raw: dict[str, list] = defaultdict(list)
    seen: set[bytes] = set()
    counts = Counter()
    with path.open(newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f), start=1):
            counts["rows"] += 1
            name = row["reviewers"]
            key = hashlib.blake2b(
                "\x1f".join((name, row["course_id"], row["date_reviews"], row["rating"], row["reviews"])).encode(),
                digest_size=16,
            ).digest()
            date = datetime.strptime(row["date_reviews"], DATE_FORMAT).toordinal()
            rec = (date, i, row["course_id"])
            if name == DELETED_NAME:
                counts["deletedRows"] += 1
                if key not in seen:
                    seen.add(key)
                continue
            raw[name].append(rec)
            if key in seen:
                counts["duplicateRows"] += 1
                continue
            seen.add(key)
            dedup[name].append(rec)
    return dedup, raw, dict(counts)


def band(reviews: dict[str, list], lo: int, hi: int) -> dict[str, list]:
    return {n: v for n, v in reviews.items() if lo <= len(v) <= hi}


def count_pairs(banded: dict[str, list], drop_same_day: bool) -> tuple[Counter, dict]:
    """Per name: first date per course, then all ordered pairs of distinct courses, once per name."""
    pairs: Counter = Counter()
    ties = 0
    names_with_pairs = 0
    for v in banded.values():
        first: dict[str, tuple[int, int]] = {}
        for date, order, course in sorted(v):
            if course not in first:
                first[course] = (date, order)
        courses = sorted(first.items(), key=lambda kv: kv[1])
        counted = False
        for a in range(len(courses)):
            for b in range(a + 1, len(courses)):
                if drop_same_day and courses[a][1][0] == courses[b][1][0]:
                    ties += 1
                    continue
                pairs[(courses[a][0], courses[b][0])] += 1
                counted = True
        names_with_pairs += counted
    return pairs, {"sameDayPairsDropped": ties, "namesWithPairs": names_with_pairs}


def count_successors(banded: dict[str, list], keep: set[str]) -> tuple[Counter, dict]:
    """Immediate-successor counts over the courses in `keep`: per name, first date per kept
    course; courses grouped by date; every course on date d_{i+1} succeeds every course on d_i.
    Same-day courses are never each other's successor."""
    succ: Counter = Counter()
    names_with_transition = 0
    transitions = 0
    for v in banded.values():
        first: dict[str, int] = {}
        for date, _order, course in sorted(v):
            if course in keep and course not in first:
                first[course] = date
        if len(first) < 2:
            continue
        by_date: dict[int, list[str]] = defaultdict(list)
        for course, date in first.items():
            by_date[date].append(course)
        dates = sorted(by_date)
        counted = False
        for d0, d1 in zip(dates, dates[1:]):
            for a in by_date[d0]:
                for b in by_date[d1]:
                    succ[(a, b)] += 1
                    transitions += 1
                    counted = True
        names_with_transition += counted
    return succ, {"namesWithTransition": names_with_transition, "transitions": transitions}


def edges_from(pairs: Counter, min_support: int, min_conf: float) -> list[dict]:
    edges = []
    for (a, b), ab in pairs.items():
        if ab < min_support:
            continue
        ba = pairs.get((b, a), 0)
        conf = ab / (ab + ba)
        if conf >= min_conf:
            edges.append({"fromCourseId": a, "toCourseId": b, "support": ab, "reverse": ba,
                          "n": ab + ba, "confidence": round(conf, 6)})
    edges.sort(key=lambda e: (e["fromCourseId"], e["toCourseId"]))
    return edges


def summarize(pairs: Counter, min_support: int, min_conf: float) -> dict:
    at_floor = [k for k, c in pairs.items() if c >= min_support]
    edges = edges_from(pairs, min_support, min_conf)
    return {
        "orderedPairsSeen": len(pairs),
        "pairsAtSupportFloor": len(at_floor),
        "edgesKept": len(edges),
        "distinctCourses": len({c for e in edges for c in (e["fromCourseId"], e["toCourseId"])}),
        "confidenceFloor": min_conf,
    }


def chain_report(chains: dict[str, list[str]], pairs: Counter, edge_keys: set, min_support: int, min_conf: float) -> dict:
    out = {}
    for name, seq in chains.items():
        steps = []
        for a, b in zip(seq, seq[1:]):
            ab, ba = pairs.get((a, b), 0), pairs.get((b, a), 0)
            conf = round(ab / (ab + ba), 4) if ab + ba else None
            steps.append({"from": a, "to": b, "support": ab, "reverse": ba, "confidence": conf,
                          "kept": (a, b) in edge_keys})
        out[name] = {"courses": seq, "survives": all(s["kept"] for s in steps), "steps": steps}
    return out


def top_edges(edges: list[dict], k: int) -> list[dict]:
    return sorted(edges, key=lambda e: (-e["support"], e["fromCourseId"], e["toCourseId"]))[:k]


def dump(path: Path, obj: dict, list_key: str) -> None:
    """Pretty header, one compact line per element of obj[list_key] (same shape as edges_so.json)."""
    head = {k: v for k, v in obj.items() if k != list_key}
    text = json.dumps(head, indent=2, sort_keys=True, ensure_ascii=False)
    assert text.endswith("\n}")
    lines = [json.dumps(item, sort_keys=True, ensure_ascii=False, separators=(",", ":")) for item in obj[list_key]]
    text = text[:-2] + f',\n  "{list_key}": [\n    ' + ",\n    ".join(lines) + "\n  ]\n}\n"
    path.write_text(text)


def run(reviews_path: Path, courses_path: Path) -> int:
    t0 = time.time()
    for p in (reviews_path, courses_path):
        if not p.exists():
            print(f"missing {p} — download the Kaggle dataset into pipeline/build/coursera/ (see README)")
            return 2
    courses = load_courses(courses_path)
    dedup, raw, counts = read_reviews(reviews_path)
    t_read = time.time() - t0

    # The shipped run: literal dedup first, band on distinct reviews, ties dropped.
    banded = band(dedup, PARAMS["minReviews"], PARAMS["maxReviews"])
    pairs, pair_info = count_pairs(banded, drop_same_day=True)
    edges = edges_from(pairs, PARAMS["minSupport"], PARAMS["minConfidence"])
    edge_keys = {(e["fromCourseId"], e["toCourseId"]) for e in edges}
    unknown = sorted({c for e in edges for c in (e["fromCourseId"], e["toCourseId"])} - courses.keys())
    if unknown:
        print(f"edges reference course ids missing from Coursera_courses.csv: {unknown}")
        return 1

    dist_dedup = Counter(len(v) for v in dedup.values())
    dist_raw = Counter(len(v) for v in raw.values())
    main_stats = {
        "rowsTotal": counts["rows"],
        "rowsDeletedName": counts.get("deletedRows", 0),
        "rowsLiteralDuplicates": counts.get("duplicateRows", 0),
        "rowsDistinct": sum(dist_dedup[k] * k for k in dist_dedup),
        "namesDistinct": len(dedup),
        "namesOneReview": dist_dedup[1],
        "namesAboveBand": sum(v for k, v in dist_dedup.items() if k > PARAMS["maxReviews"]),
        "namesInBand": len(banded),
        "rowsUsed": sum(len(v) for v in banded.values()),
        "namesWithPairs": pair_info["namesWithPairs"],
        "sameDayPairsDropped": pair_info["sameDayPairsDropped"],
        **summarize(pairs, PARAMS["minSupport"], PARAMS["minConfidence"]),
        "coursesInCorpus": len(courses),
    }
    ties_kept_pairs, _ = count_pairs(banded, drop_same_day=False)
    main_stats["ifSameDayTiesKept"] = summarize(ties_kept_pairs, PARAMS["minSupport"], PARAMS["minConfidence"])
    main_stats["atBaselineConfidence"] = summarize(pairs, PARAMS["minSupport"], PARAMS["baselineConfidence"])

    # Riyan's baseline, recomputed exactly: no literal dedup, band on raw row counts, first date
    # per course, same-day ties kept in file order, floor 0.70. Then his procedure at 0.85.
    raw_banded = band(raw, PARAMS["minReviews"], PARAMS["maxReviews"])
    raw_pairs, raw_info = count_pairs(raw_banded, drop_same_day=False)
    baseline = {
        "procedure": (
            "no literal-duplicate drop; '{d}' dropped; names with {lo}-{hi} raw rows; per name the first review "
            "date of each distinct course; ordered pairs once per name; same-day pairs kept in file order"
        ).format(d=DELETED_NAME, lo=PARAMS["minReviews"], hi=PARAMS["maxReviews"]),
        "namesOneReviewRaw": dist_raw[1],
        "namesAboveBandRaw": sum(v for k, v in dist_raw.items() if k > PARAMS["maxReviews"]),
        "namesInBand": len(raw_banded),
        "rowsUsed": sum(len(v) for v in raw_banded.values()),
        "at0.70": summarize(raw_pairs, PARAMS["minSupport"], PARAMS["baselineConfidence"]),
        "at0.85": summarize(raw_pairs, PARAMS["minSupport"], PARAMS["minConfidence"]),
        "publishedByRiyan": {"rowsUsed": 1054450, "orderedPairsSeen": 58939, "pairsAtSupportFloor": 714,
                             "edgesKept": 287, "distinctCourses": 171, "confidenceFloor": 0.70},
    }
    baseline["reproducesPublished"] = all(
        baseline["at0.70"][k] == baseline["publishedByRiyan"][k]
        for k in ("orderedPairsSeen", "pairsAtSupportFloor", "edgesKept", "distinctCourses")
    ) and baseline["rowsUsed"] == baseline["publishedByRiyan"]["rowsUsed"]
    baseline_edges = edges_from(raw_pairs, PARAMS["minSupport"], PARAMS["baselineConfidence"])
    baseline_keys = {(e["fromCourseId"], e["toCourseId"]) for e in baseline_edges}
    baseline_keys_85 = {(e["fromCourseId"], e["toCourseId"]) for e in edges_from(raw_pairs, PARAMS["minSupport"], PARAMS["minConfidence"])}

    chains = {
        "success": chain_report(SUCCESS_CHAINS, pairs, edge_keys, PARAMS["minSupport"], PARAMS["minConfidence"]),
        "nonsense": chain_report(NONSENSE_CHAINS, pairs, edge_keys, PARAMS["minSupport"], PARAMS["minConfidence"]),
        "successOnBaselineRows": chain_report(SUCCESS_CHAINS, raw_pairs, baseline_keys_85, PARAMS["minSupport"], PARAMS["minConfidence"]),
        "nonsenseOnBaselineRowsAt0.70": chain_report(NONSENSE_CHAINS, raw_pairs, baseline_keys, PARAMS["minSupport"], PARAMS["baselineConfidence"]),
    }
    chains["allSuccessSurvive"] = all(c["survives"] for c in chains["success"].values())
    chains["noNonsenseSurvives"] = not any(c["survives"] for c in chains["nonsense"].values())

    ring1 = sorted({c for e in edges for c in (e["fromCourseId"], e["toCourseId"])})
    wall = time.time() - t0
    max_rss_mb = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 * 1024), 1)
    doc = {
        "source": SOURCE,
        "caveat": CAVEAT,
        "licence": LICENCE,
        "datasetUrl": DATASET_URL,
        "method": METHOD,
        "params": PARAMS,
        "inputs": {reviews_path.name: sha256_file(reviews_path), courses_path.name: sha256_file(courses_path)},
        "edgeFields": "fromCourseId, toCourseId, support (names reviewing from before to), reverse, n, confidence = support/n; "
                      "course names/institutions/urls for every course in an edge are in courses",
        "courses": {c: courses[c] for c in ring1},
        "stats": main_stats,
        "baseline": baseline,
        "chains": chains,
        "top20EdgesBySupport": top_edges(edges, 20),
        "edges": edges,
    }
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    dump(OUT_EDGES, doc, "edges")
    write_stats_md(OUT_STATS, doc)
    print(f"wrote {OUT_EDGES.relative_to(REPO_ROOT)}: {len(edges)} edges over {len(ring1)} courses")

    succ, succ_info = count_successors(banded, set(ring1))
    successors = [{"fromCourseId": a, "toCourseId": b, "n": n} for (a, b), n in succ.items()]
    successors.sort(key=lambda r: (r["fromCourseId"], r["toCourseId"]))
    branches_doc = {
        "source": SOURCE,
        "caveat": CAVEAT,
        "licence": LICENCE,
        "datasetUrl": DATASET_URL,
        "rule": (
            "per name (same rows and band as the edges), Ring-1 courses ordered by first review date; every "
            "course on the next distinct date is an immediate successor of every course on the current date; "
            "same-day courses are never each other's successor; a review of a course outside Ring 1 is ignored "
            "(the sequence runs over Ring-1 courses only)"
        ),
        "ring1": "the courses appearing in any edge of edges_coursera_course.json",
        "params": {k: PARAMS[k] for k in ("minReviews", "maxReviews", "dedupLiteralRows")},
        "inputs": doc["inputs"],
        "stats": {
            "ring1Courses": len(ring1),
            "namesInBand": len(banded),
            "namesWithTransition": succ_info["namesWithTransition"],
            "transitions": succ_info["transitions"],
            "successorPairs": len(successors),
        },
        "successorFields": "fromCourseId, toCourseId, n (names whose next Ring-1 course after from was to)",
        "successors": successors,
    }
    dump(OUT_BRANCHES, branches_doc, "successors")
    print(f"wrote {OUT_BRANCHES.relative_to(REPO_ROOT)}: {len(successors)} successor pairs, {succ_info['transitions']} transitions")
    print(f"wall {wall:.1f}s (read {t_read:.1f}s), max RSS {max_rss_mb} MB, python {sys.version.split()[0]}")
    print(f"success chains all survive: {chains['allSuccessSurvive']}; no nonsense chain survives: {chains['noNonsenseSurvives']}")
    return 0


def _chain_lines(title: str, report: dict, courses: dict) -> list[str]:
    L = [f"### {title}", ""]
    for name, c in report.items():
        L.append(f"- **{name}** — {'SURVIVES' if c['survives'] else 'does not survive'}")
        for s in c["steps"]:
            fn = courses.get(s["from"], {}).get("name", s["from"])
            tn = courses.get(s["to"], {}).get("name", s["to"])
            L.append(f"  - {fn} → {tn}: {s['support']} vs {s['reverse']}, conf {s['confidence']} — {'kept' if s['kept'] else 'not kept'}")
    L.append("")
    return L


def write_stats_md(path: Path, doc: dict) -> None:
    s, b, ch, courses = doc["stats"], doc["baseline"], doc["chains"], doc["courses"]
    L = ["# Coursera review-order mining — stats", "",
         "Produced by `python pipeline/mine_coursera.py run`; every number below is computed, none is typed in.", "",
         f"- Method: {doc['method']}",
         f"- Caveat on every number: {doc['caveat']}",
         "",
         "## Rows and names", ""]
    for k in ("rowsTotal", "rowsDeletedName", "rowsLiteralDuplicates", "rowsDistinct", "namesDistinct", "namesOneReview",
              "namesAboveBand", "namesInBand", "rowsUsed", "namesWithPairs", "sameDayPairsDropped", "coursesInCorpus"):
        L.append(f"- {k}: {s[k]}")
    L += ["", "## Edges at the shipped floors (support ≥ %d, confidence ≥ %.2f)" % (doc["params"]["minSupport"], doc["params"]["minConfidence"]), ""]
    for k in ("orderedPairsSeen", "pairsAtSupportFloor", "edgesKept", "distinctCourses"):
        L.append(f"- {k}: {s[k]}")
    L += ["", f"- same rows at confidence ≥ {doc['params']['baselineConfidence']}: {json.dumps(s['atBaselineConfidence'])}",
          f"- same rows if same-day ties were kept in file order: {json.dumps(s['ifSameDayTiesKept'])}", "",
          "## Riyan's baseline, recomputed from the same CSVs", "",
          f"- procedure: {b['procedure']}",
          f"- names: one-review {b['namesOneReviewRaw']}, above band {b['namesAboveBandRaw']}, in band {b['namesInBand']}; rows used {b['rowsUsed']}",
          f"- at 0.70: {json.dumps(b['at0.70'])}",
          f"- at 0.85 (his procedure, our floor): {json.dumps(b['at0.85'])}",
          f"- published by Riyan: {json.dumps(b['publishedByRiyan'])}",
          f"- reproduces the published numbers exactly: **{b['reproducesPublished']}**", "",
          "| run | rows used | ordered pairs | pairs ≥ 20 | edges | courses |", "|---|---|---|---|---|---|",
          f"| Riyan published (0.70) | {b['publishedByRiyan']['rowsUsed']} | {b['publishedByRiyan']['orderedPairsSeen']} | {b['publishedByRiyan']['pairsAtSupportFloor']} | {b['publishedByRiyan']['edgesKept']} | {b['publishedByRiyan']['distinctCourses']} |",
          f"| his procedure recomputed (0.70) | {b['rowsUsed']} | {b['at0.70']['orderedPairsSeen']} | {b['at0.70']['pairsAtSupportFloor']} | {b['at0.70']['edgesKept']} | {b['at0.70']['distinctCourses']} |",
          f"| his procedure at 0.85 | {b['rowsUsed']} | {b['at0.85']['orderedPairsSeen']} | {b['at0.85']['pairsAtSupportFloor']} | {b['at0.85']['edgesKept']} | {b['at0.85']['distinctCourses']} |",
          f"| shipped: dedup, ties dropped (0.70) | {s['rowsUsed']} | {s['atBaselineConfidence']['orderedPairsSeen']} | {s['atBaselineConfidence']['pairsAtSupportFloor']} | {s['atBaselineConfidence']['edgesKept']} | {s['atBaselineConfidence']['distinctCourses']} |",
          f"| **shipped: dedup, ties dropped (0.85)** | {s['rowsUsed']} | {s['orderedPairsSeen']} | {s['pairsAtSupportFloor']} | **{s['edgesKept']}** | **{s['distinctCourses']}** |",
          "", "## Chain checks (shipped edge set)", "",
          f"- all four success chains survive: **{ch['allSuccessSurvive']}**",
          f"- no nonsense chain survives: **{ch['noNonsenseSurvives']}**", ""]
    L += _chain_lines("Success chains at 0.85 (shipped rows)", ch["success"], courses)
    L += _chain_lines("Nonsense chains at 0.85 (shipped rows)", ch["nonsense"], courses)
    L += _chain_lines("Success chains at 0.85 on Riyan's rows", ch["successOnBaselineRows"], courses)
    L += _chain_lines("Nonsense chains at 0.70 on Riyan's rows (should survive there — that was his finding)", ch["nonsenseOnBaselineRowsAt0.70"], courses)
    L += ["## Top 20 edges by support", "", "| from | to | support | reverse | conf | n |", "|---|---|---|---|---|---|"]
    for e in doc["top20EdgesBySupport"]:
        L.append(f"| {courses[e['fromCourseId']]['name']} | {courses[e['toCourseId']]['name']} | {e['support']} | {e['reverse']} | {e['confidence']:.3f} | {e['n']} |")
    L.append("")
    path.write_text("\n".join(L))


def _require(cond: bool, msg: str, errors: list[str]) -> None:
    if not cond:
        errors.append(msg)


def check_schema() -> int:
    """Pipeline-side mirror of the shape M5.7 adds under src/schemas/evidence.ts."""
    errors: list[str] = []
    e = json.loads(OUT_EDGES.read_text())
    for key in ("source", "caveat", "licence", "method", "params", "inputs", "courses", "stats", "baseline", "chains", "edges"):
        _require(key in e, f"edges_coursera_course.json: missing {key}", errors)
    _require(e.get("source") == SOURCE, "edges_coursera_course.json: source", errors)
    _require(e.get("caveat") == CAVEAT, "edges_coursera_course.json: caveat text changed", errors)
    for w in ("satisfied", "struggled", "liked", "hard"):
        _require(w not in e.get("caveat", "").lower(), f"edges_coursera_course.json: caveat contains {w!r}", errors)
    courses = e.get("courses", {})
    seen = set()
    for edge in e.get("edges", []):
        key = (edge.get("fromCourseId"), edge.get("toCourseId"))
        _require(key not in seen, f"duplicate edge {key}", errors)
        seen.add(key)
        _require(key[0] != key[1], f"self edge {key}", errors)
        _require(key[0] in courses and key[1] in courses, f"{key}: endpoint missing from courses block", errors)
        for f in ("support", "reverse", "n"):
            _require(isinstance(edge.get(f), int) and edge[f] >= 0, f"{key}: bad {f}", errors)
        _require(edge.get("n") == edge.get("support", 0) + edge.get("reverse", 0), f"{key}: n mismatch", errors)
        _require(edge.get("support", 0) >= PARAMS["minSupport"], f"{key}: below support floor", errors)
        _require(abs(edge.get("confidence", -1) - edge["support"] / edge["n"]) < 1e-5, f"{key}: confidence", errors)
        _require(edge["confidence"] >= PARAMS["minConfidence"], f"{key}: below confidence floor", errors)
    for cid, c in courses.items():
        _require(all(isinstance(c.get(k), str) and c[k] for k in ("name", "institution", "url")), f"courses[{cid}] incomplete", errors)
    ring1 = {c for k in seen for c in k}
    _require(ring1 == set(courses), "courses block is not exactly the set of courses in edges", errors)
    _require(e.get("stats", {}).get("edgesKept") == len(seen), "stats.edgesKept mismatch", errors)
    n_succ = None
    if OUT_BRANCHES.exists():
        b = json.loads(OUT_BRANCHES.read_text())
        for key in ("source", "caveat", "rule", "params", "inputs", "stats", "successors"):
            _require(key in b, f"branches_coursera_course.json: missing {key}", errors)
        _require(b.get("caveat") == CAVEAT, "branches_coursera_course.json: caveat text changed", errors)
        _require(b.get("inputs") == e.get("inputs"), "branches_coursera_course.json: not produced from the same CSVs as the edges", errors)
        seen_succ = set()
        for r in b.get("successors", []):
            key = (r.get("fromCourseId"), r.get("toCourseId"))
            _require(key not in seen_succ, f"duplicate successor {key}", errors)
            seen_succ.add(key)
            _require(key[0] != key[1], f"self successor {key}", errors)
            _require(key[0] in courses and key[1] in courses, f"successor {key}: course outside Ring 1", errors)
            _require(isinstance(r.get("n"), int) and r["n"] >= 1, f"successor {key}: bad n", errors)
        _require(b.get("stats", {}).get("successorPairs") == len(seen_succ), "branches stats.successorPairs mismatch", errors)
        _require(b.get("stats", {}).get("transitions") == sum(r["n"] for r in b.get("successors", [])), "branches stats.transitions mismatch", errors)
        n_succ = len(seen_succ)
    if errors:
        print("check-schema FAILED:")
        for m in errors[:30]:
            print(f"  - {m}")
        return 1
    print(f"check-schema OK: {len(seen)} edges over {len(courses)} courses" + (f"; {n_succ} successor pairs" if n_succ is not None else ""))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--reviews", type=Path, default=DEFAULT_REVIEWS)
    r.add_argument("--courses", type=Path, default=DEFAULT_COURSES)
    sub.add_parser("check-schema")
    a = ap.parse_args()
    if a.cmd == "run":
        return run(a.reviews, a.courses)
    return check_schema()


if __name__ == "__main__":
    sys.exit(main())
