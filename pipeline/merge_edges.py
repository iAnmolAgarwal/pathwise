"""Merge the authored prerequisite graph with the mined evidence -> src/data/skill_edges.json,
src/data/branches.json, pipeline/evidence/agreement_report.md/.json, and the human queues
pipeline/sources/contradictions.md and promotions.md.

Authority (ARCHITECTURE §10, §15.5): authored edges (skills.json.prereqs) drive paths; evidence
annotates them; humans resolve disagreements through pipeline/sources/ files. Nothing here
deletes, flips or promotes an edge on its own.

Per authored edge (a -> b) and per source:
  confirm     confidence(a -> b) >= 0.70 with n >= 20
  contradict  confidence(b -> a) >= 0.85 with n >= 50
  unobserved  otherwise (the pair may still carry numbers below those floors; they are kept in
              `sources` so the UI can show them above the display floors, and counted in the
              report as "observed but inconclusive")
Status: confirmed-both | confirmed-one-source | contradicted-in-review (any source contradicts;
the edge keeps drivesPath true until a human resolves it) | no-data. Every mined pair with no
authored counterpart in either direction becomes origin "mined", status "candidate",
drivesPath false; a human promotion (§15.6) makes it "promoted", drivesPath true, and this
script refuses a promotion that fails the thresholds, the level-band rule or acyclicity.

Stack Overflow pairs exist in up to two samples (full-mirror, sede-current); per pair the
sample with the larger n is used, never a sum. Branches: per from-skill the sample with the
larger nTotal. Human decisions live in pipeline/sources/evidence_resolutions.json (hand-
edited, dated, with a note); the two .md queues are rendered from the queues plus that file,
so a re-run never loses a resolution.

Commands (repo root):
  python pipeline/merge_edges.py run
  python pipeline/merge_edges.py check-schema
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
sys.path.insert(0, str(PIPELINE_DIR))
from mine_coursera import dump, sha256_file  # noqa: E402

REPO_ROOT = PIPELINE_DIR.parent
DATA_DIR = REPO_ROOT / "src" / "data"
EVIDENCE_DIR = PIPELINE_DIR / "evidence"
SOURCES_DIR = PIPELINE_DIR / "sources"
IN_SO_EDGES = EVIDENCE_DIR / "edges_so.json"
IN_SO_BRANCHES = EVIDENCE_DIR / "branches_so.json"
IN_CR_EDGES = EVIDENCE_DIR / "edges_coursera.json"
IN_CR_BRANCHES = EVIDENCE_DIR / "branches_coursera.json"
IN_CR_TAGS = EVIDENCE_DIR / "course_skill_tags.json"
IN_RESOLUTIONS = SOURCES_DIR / "evidence_resolutions.json"
OUT_EDGES = DATA_DIR / "skill_edges.json"
OUT_BRANCHES = DATA_DIR / "branches.json"
OUT_REPORT_MD = EVIDENCE_DIR / "agreement_report.md"
OUT_REPORT_JSON = EVIDENCE_DIR / "agreement_report.json"
OUT_CONTRADICTIONS = SOURCES_DIR / "contradictions.md"
OUT_PROMOTIONS = SOURCES_DIR / "promotions.md"

SOURCES = ("stackoverflow", "coursera")
THRESHOLDS = {
    "confirmConfidence": 0.70,
    "confirmN": 20,
    "contradictConfidence": 0.85,
    "contradictN": 50,
    "promoteConfidence": 0.85,
    "promoteSupport": 50,
    "promoteCorroboration": 2,  # course pairs (coursera) or distinct tags (stackoverflow)
}
CONTRADICTION_DECISIONS = ("keep-authored", "flip", "remove", "both-valid-drop-edge")
PROMOTION_DECISIONS = ("promote", "keep-candidate")
FORBIDDEN_WORDS = ("satisfied", "struggled", "liked", "hard")


def load_json(path: Path):
    return json.loads(path.read_text())


# ---------------------------------------------------------------- source lookups

def so_lookup(doc: dict) -> tuple[dict[tuple[str, str], dict], set[str]]:
    """(a, b) -> SourceStat for direction a -> b (both orientations), picking per unordered pair
    the sample with the larger n. Also the set of skills with data in this source."""
    best: dict[tuple[str, str], dict] = {}
    for e in doc["edges"]:
        key = (e["from"], e["to"])
        if key not in best or e["n"] > best[key]["n"] or (e["n"] == best[key]["n"] and e["sample"] < best[key]["sample"]):
            best[key] = e
    skills_block = doc["skills"]
    out: dict[tuple[str, str], dict] = {}
    for (a, b), e in best.items():
        # tags behind each skill and the cohort rule are file-level (skill_edges.json "stackoverflow" block),
        # not repeated on every one of ~8k edges; detail keeps the sample the numbers came from
        out[(a, b)] = {
            "support": e["support"], "reverse": e["reverse"], "confidence": e["confidence"], "n": e["n"],
            "detail": {"sample": e["sample"]}, "caveat": doc["caveat"],
        }
        out[(b, a)] = {
            "support": e["reverse"], "reverse": e["support"],
            "confidence": round(e["reverse"] / e["n"], 6), "n": e["n"],
            "detail": {"sample": e["sample"]}, "caveat": doc["caveat"],
        }
    observed = {
        sid for sid, s in skills_block.items()
        if (s.get("mirror") or {}).get("usersEligible", 0) >= 1 or (s.get("sedeUsersInPairs") or 0) >= 1
    }
    return out, observed


def coursera_lookup(doc: dict, tags_doc: dict) -> tuple[dict[tuple[str, str], dict], set[str]]:
    out: dict[tuple[str, str], dict] = {}
    for e in doc["edges"]:
        a, b = e["from"], e["to"]
        out[(a, b)] = {
            "support": e["support"], "reverse": e["reverse"], "confidence": e["confidence"], "n": e["n"],
            "detail": {"nCoursePairs": e["nCoursePairs"], "coursePairs": e["coursePairs"]},
            "caveat": doc["caveat"],
        }
        out[(b, a)] = {
            "support": e["reverse"], "reverse": e["support"],
            "confidence": round(e["reverse"] / e["n"], 6), "n": e["n"],
            "detail": {"nCoursePairs": e["nCoursePairs"], "coursePairs": e["reverseCoursePairs"]},
            "caveat": doc["caveat"],
        }
    tagged = {t["skillId"] for c in tags_doc["tags"] for t in c.get("skillsTaught", [])}
    return out, tagged


# ---------------------------------------------------------------- verdicts

def verdict(stat: dict | None) -> str:
    if stat is None:
        return "unobserved"
    if stat["confidence"] >= THRESHOLDS["confirmConfidence"] and stat["n"] >= THRESHOLDS["confirmN"]:
        return "confirm"
    if (1 - stat["confidence"]) >= THRESHOLDS["contradictConfidence"] - 1e-9 and stat["n"] >= THRESHOLDS["contradictN"]:
        return "contradict"
    return "unobserved"


def status_from(verdicts: dict[str, str]) -> str:
    if "contradict" in verdicts.values():
        return "contradicted-in-review"
    confirms = sum(1 for v in verdicts.values() if v == "confirm")
    if confirms >= 2:
        return "confirmed-both"
    if confirms == 1:
        return "confirmed-one-source"
    return "no-data"


def corroboration(source: str, stat: dict, frm: str, to: str, so_tags: dict[str, list[str]]) -> int:
    """Coursera: distinct course pairs behind the pooled edge. Stack Overflow: distinct tags behind the
    two skills — satisfied by construction whenever both skills are mapped, because the mining pools
    tags per skill before counting (there is no per-tag count to check)."""
    if source == "coursera":
        return stat["detail"].get("nCoursePairs", 0)
    return len(set(so_tags.get(frm, [])) | set(so_tags.get(to, [])))


def meets_promotion(source: str, stat: dict, frm: str, to: str, so_tags: dict[str, list[str]]) -> bool:
    return (
        stat["confidence"] >= THRESHOLDS["promoteConfidence"]
        and stat["support"] >= THRESHOLDS["promoteSupport"]
        and corroboration(source, stat, frm, to, so_tags) >= THRESHOLDS["promoteCorroboration"]
    )


def has_cycle(edges: list[tuple[str, str]]) -> list[str] | None:
    """Return a cycle (as a node list) over from -> to edges, or None."""
    adj: dict[str, list[str]] = defaultdict(list)
    for a, b in edges:
        adj[a].append(b)
    WHITE, GREY, BLACK = 0, 1, 2
    color: dict[str, int] = defaultdict(int)
    parent: dict[str, str] = {}
    for start in list(adj):
        if color[start] != WHITE:
            continue
        stack = [(start, iter(adj[start]))]
        color[start] = GREY
        while stack:
            node, it = stack[-1]
            for nxt in it:
                if color[nxt] == GREY:
                    cyc = [nxt, node]
                    cur = node
                    while cur != nxt:
                        cur = parent[cur]
                        cyc.append(cur)
                    return list(reversed(cyc))
                if color[nxt] == WHITE:
                    color[nxt] = GREY
                    parent[nxt] = node
                    stack.append((nxt, iter(adj[nxt])))
                    break
            else:
                color[node] = BLACK
                stack.pop()
    return None


# ---------------------------------------------------------------- resolutions

def load_resolutions() -> dict:
    if not IN_RESOLUTIONS.exists():
        return {"contradictions": [], "promotions": []}
    doc = load_json(IN_RESOLUTIONS)
    errors = []
    for r in doc.get("contradictions", []):
        if r.get("decision") not in CONTRADICTION_DECISIONS:
            errors.append(f"contradiction {r.get('from')}->{r.get('to')}: decision {r.get('decision')!r}")
        for f in ("from", "to", "note", "date", "by"):
            if not r.get(f):
                errors.append(f"contradiction {r.get('from')}->{r.get('to')}: missing {f}")
    for r in doc.get("promotions", []):
        if r.get("decision") not in PROMOTION_DECISIONS:
            errors.append(f"promotion {r.get('from')}->{r.get('to')}: decision {r.get('decision')!r}")
        for f in ("from", "to", "note", "date", "by"):
            if not r.get(f):
                errors.append(f"promotion {r.get('from')}->{r.get('to')}: missing {f}")
    if errors:
        raise SystemExit("evidence_resolutions.json: " + "; ".join(errors))
    return {"contradictions": doc.get("contradictions", []), "promotions": doc.get("promotions", [])}


def resolution_obj(r: dict) -> dict:
    return {"by": "human", "decision": r["decision"], "note": r["note"], "date": r["date"]}


# ---------------------------------------------------------------- merge

def merge(skills: list[dict], lookups: dict[str, dict], observed_skills: dict[str, set[str]], resolutions: dict, so_tags: dict[str, list[str]]) -> tuple[list[dict], dict]:
    skill_ids = {s["id"] for s in skills}
    level = {s["id"]: s["levelBand"] for s in skills}
    authored = sorted((p, s["id"]) for s in skills for p in s.get("prereqs", []))
    authored_set = set(authored)
    contradiction_res = {(r["from"], r["to"]): r for r in resolutions["contradictions"]}
    promotion_res = {(r["from"], r["to"]): r for r in resolutions["promotions"]}

    edges: list[dict] = []
    authored_rows: list[dict] = []
    for a, b in authored:
        stats = {src: lookups[src].get((a, b)) for src in SOURCES}
        verdicts = {src: verdict(stats[src]) for src in SOURCES}
        status = status_from(verdicts)
        edge = {
            "from": a, "to": b, "origin": "authored", "status": status, "drivesPath": True,
            "sources": {src: stats[src] for src in SOURCES if stats[src] is not None},
        }
        res = contradiction_res.get((a, b))
        if res is not None:
            edge["resolution"] = resolution_obj(res)
        edges.append(edge)
        authored_rows.append({
            "from": a, "to": b, "status": status, "verdicts": verdicts,
            "observable": {src: a in observed_skills[src] and b in observed_skills[src] for src in SOURCES},
            "hasData": {src: stats[src] is not None for src in SOURCES},
            "resolution": res,
        })

    # Mined-only pairs: every pair in any source with no authored counterpart in either direction.
    mined_keys: set[tuple[str, str]] = set()
    for src in SOURCES:
        for (a, b), st in lookups[src].items():
            if (a, b) in authored_set or (b, a) in authored_set:
                continue
            # one row per unordered pair, oriented by the source with the larger n (support >= reverse there)
            mined_keys.add(tuple(sorted((a, b))))
    candidate_rows: list[dict] = []
    promoted_edges: list[tuple[str, str]] = []
    refused: list[str] = []
    for a0, b0 in sorted(mined_keys):
        # orientation: the direction with the larger support in the source with the larger n
        best_src, best_stat, frm, to = None, None, a0, b0
        for src in SOURCES:
            st = lookups[src].get((a0, b0))
            if st is None:
                continue
            if best_stat is None or st["n"] > best_stat["n"]:
                best_src, best_stat = src, st
        if best_stat["reverse"] > best_stat["support"]:
            frm, to = b0, a0
        stats = {src: lookups[src].get((frm, to)) for src in SOURCES}
        qualifying = [src for src in SOURCES if stats[src] is not None and meets_promotion(src, stats[src], frm, to, so_tags)]
        level_ok = level[frm] <= level[to]
        res = promotion_res.get((frm, to))
        status = "candidate"
        drives = False
        if res is not None and res["decision"] == "promote":
            if not qualifying:
                refused.append(f"{frm} -> {to}: promotion recorded but no source meets the §15.6 thresholds")
            elif not level_ok:
                refused.append(f"{frm} -> {to}: promotion recorded but levelBand({frm})={level[frm]} > levelBand({to})={level[to]}")
            else:
                status, drives = "promoted", True
                promoted_edges.append((frm, to))
        edge = {
            "from": frm, "to": to, "origin": "mined", "status": status, "drivesPath": drives,
            "sources": {src: stats[src] for src in SOURCES if stats[src] is not None},
        }
        if res is not None:
            edge["resolution"] = resolution_obj(res)
        edges.append(edge)
        candidate_rows.append({
            "from": frm, "to": to, "status": status, "qualifyingSources": qualifying, "levelOk": level_ok,
            "resolution": res, "bestSource": best_src,
        })

    cyc = has_cycle(authored + promoted_edges)
    if cyc:
        refused.append("path-driving graph would contain a cycle after promotions: " + " -> ".join(cyc))
    if refused:
        raise SystemExit("merge refused:\n  - " + "\n  - ".join(refused))

    # Resolutions that no longer match an edge (e.g. the authored edge was flipped or removed) are history.
    matched_c = {(r["from"], r["to"]) for r in authored_rows if r["resolution"]}
    history = [r for r in resolutions["contradictions"] if (r["from"], r["to"]) not in matched_c]
    for r in history:
        # a flip shows up as the reversed authored edge; attach the record there for the UI
        for e in edges:
            if e["origin"] == "authored" and (e["from"], e["to"]) == (r["to"], r["from"]) and "resolution" not in e:
                e["resolution"] = resolution_obj(r)

    def sort_key(e: dict):
        return (0 if e["origin"] == "authored" else 1, e["from"], e["to"])

    edges.sort(key=sort_key)
    return edges, {"authoredRows": authored_rows, "candidateRows": candidate_rows, "history": history, "skillIds": skill_ids}


def merge_branches(so_doc: dict, cr_doc: dict) -> list[dict]:
    best: dict[str, dict] = {}
    for b in so_doc["branches"]:
        cur = best.get(b["from"])
        if cur is None or b["nTotal"] > cur["nTotal"] or (b["nTotal"] == cur["nTotal"] and b["sample"] < cur["sample"]):
            best[b["from"]] = b
    out = []
    for frm in sorted(best):
        b = best[frm]
        out.append({
            "from": frm, "source": "stackoverflow", "sample": b["sample"], "next": b["next"], "nTotal": b["nTotal"],
            "nNextObserved": b["nNextObserved"], "minSupportMet": b["minSupportMet"], "caveat": b["caveat"],
        })
    for b in cr_doc["branches"]:
        out.append({
            "from": b["from"], "source": "coursera", "next": b["next"], "nTotal": b["nTotal"],
            "nNextObserved": b["nNextObserved"], "minSupportMet": b["minSupportMet"], "caveat": b["caveat"],
        })
    out.sort(key=lambda b: (b["from"], b["source"]))
    return out


# ---------------------------------------------------------------- report

def pct(n: int, d: int) -> str:
    return "n/a" if d == 0 else f"{100 * n / d:.1f} %"


def build_report(edges: list[dict], info: dict, so_doc: dict, cr_doc: dict, tags_doc: dict, branches: list[dict], skills: list[dict]) -> dict:
    rows = info["authoredRows"]
    cands = info["candidateRows"]
    n_auth = len(rows)
    observable = {src: sum(1 for r in rows if r["observable"][src]) for src in SOURCES}
    observable_any = sum(1 for r in rows if any(r["observable"].values()))
    has_data = {src: sum(1 for r in rows if r["hasData"][src]) for src in SOURCES}
    has_data_any = sum(1 for r in rows if any(r["hasData"].values()))
    confirmed_by = {src: sum(1 for r in rows if r["verdicts"][src] == "confirm") for src in SOURCES}
    confirmed_any = sum(1 for r in rows if "confirm" in r["verdicts"].values())
    confirmed_both = sum(1 for r in rows if all(v == "confirm" for v in r["verdicts"].values()))
    contradicted = [r for r in rows if r["status"] == "contradicted-in-review"]
    unobserved = sum(1 for r in rows if not any(r["hasData"].values()))
    inconclusive = sum(1 for r in rows if any(r["hasData"].values()) and r["status"] == "no-data")
    by_status = Counter(r["status"] for r in rows)
    skill_ids = info["skillIds"]
    skills_with_data = {src: set() for src in SOURCES}
    for e in edges:
        for src in e["sources"]:
            skills_with_data[src].update((e["from"], e["to"]))
    edges_with_data_any = sum(1 for e in edges if e["origin"] == "authored" and e["sources"])
    novel = [c for c in cands if c["qualifyingSources"]]
    promoted = [c for c in cands if c["status"] == "promoted"]
    mined_total = len(cands)
    cohort = so_doc["stats"]["cohortFilterEffect"]
    tagged_courses = sum(1 for c in tags_doc["tags"] if c.get("skillsTaught"))
    branch_met = {src: sum(1 for b in branches if b["source"] == src and b["minSupportMet"]) for src in SOURCES}

    resolved = [r for r in contradicted if r["resolution"]]
    headline = (
        f"Of the {n_auth} authored prerequisite edges, {observable_any} were observable in real learner sequences "
        f"(Stack Overflow question order for {observable['stackoverflow']}, Coursera review order for {observable['coursera']}); "
        f"{pct(confirmed_any, observable_any)} of the observable edges were confirmed by at least one source and "
        f"{pct(confirmed_both, observable_any)} by both; {len(contradicted)} contradiction{'s were' if len(contradicted) != 1 else ' was'} "
        f"raised and {len(resolved)} resolved; {len(promoted)} novel edge{'s were' if len(promoted) != 1 else ' was'} promoted after human review."
    )
    return {
        "thresholds": THRESHOLDS,
        "definitions": {
            "observable": "both endpoints have data in the source: Stack Overflow = skill observed in the mirror or the SEDE top-up; Coursera = skill tagged on >= 1 Ring-1 course",
            "confirm": "confidence(a->b) >= 0.70 with n >= 20",
            "contradict": "confidence(b->a) >= 0.85 with n >= 50",
            "unobservedBelowFloor": "no source holds the pair at its mining floor (Stack Overflow n >= 20 after the cohort filter; Coursera course pairs at support >= 20, confidence >= 0.85)",
            "observedButInconclusive": "a source holds the pair but neither confirms nor contradicts it; the numbers are kept on the edge",
        },
        "authoredEdges": n_auth,
        "observable": {**observable, "anySource": observable_any},
        "hasData": {**has_data, "anySource": has_data_any},
        "confirmed": {
            **confirmed_by, "anySource": confirmed_any, "both": confirmed_both,
            "pctOfObservableAny": round(100 * confirmed_any / observable_any, 1) if observable_any else None,
            "pctOfObservableBoth": round(100 * confirmed_both / observable_any, 1) if observable_any else None,
            "pctOfAuthoredAny": round(100 * confirmed_any / n_auth, 1),
        },
        "contradicted": {
            "count": len(contradicted),
            "resolved": len(resolved),
            "edges": [{"from": r["from"], "to": r["to"], "sources": [s for s, v in r["verdicts"].items() if v == "contradict"],
                       "resolution": r["resolution"]} for r in contradicted],
        },
        "unobserved": unobserved,
        "observedButInconclusive": inconclusive,
        "byStatus": {k: by_status.get(k, 0) for k in ("confirmed-both", "confirmed-one-source", "contradicted-in-review", "no-data")},
        "mined": {
            "candidatesTotal": mined_total,
            "meetingPromotionThresholds": len(novel),
            "meetingPromotionThresholdsBySource": {src: sum(1 for c in novel if src in c["qualifyingSources"]) for src in SOURCES},
            "promoted": len(promoted),
            "promotedEdges": [{"from": c["from"], "to": c["to"]} for c in promoted],
            "keptCandidateByHuman": sum(1 for c in cands if c["resolution"] and c["resolution"]["decision"] == "keep-candidate"),
        },
        "coverage": {
            "skills": len(skill_ids),
            "skillsWithData": {**{src: len(skills_with_data[src]) for src in SOURCES},
                               "anySource": len(skills_with_data["stackoverflow"] | skills_with_data["coursera"])},
            "authoredEdgesWithData": edges_with_data_any,
            "courseraRing1Courses": len(tags_doc["tags"]),
            "courseraCoursesWithTags": tagged_courses,
            "courseraTags": tags_doc["stats"]["tagsTotal"],
            "stackoverflowPairsAtFloor": so_doc["stats"]["pairsAtFloor"],
            "courseraPooledEdges": cr_doc["stats"]["pooledEdges"],
            "branchFromSkillsAtFloor": branch_met,
        },
        "cohortFilterEffect": cohort,
        "headline": headline,
        "history": info["history"],
    }


def write_report_md(path: Path, rep: dict, names: dict) -> None:
    so, cr = "stackoverflow", "coursera"
    c = rep["contradicted"]
    L = [
        "# Agreement report — authored prerequisite graph vs. learner-sequence evidence",
        "",
        "Produced by `python pipeline/merge_edges.py run`; every number is computed by the pipeline, none is typed in. "
        "Thresholds and definitions are printed below the tables.",
        "",
        f"> {rep['headline']}",
        "",
        "| Metric | Stack Overflow | Coursera | ≥ 1 source | both |",
        "|---|---|---|---|---|",
        f"| Observable authored edges (both endpoints have data) | {rep['observable'][so]} | {rep['observable'][cr]} | {rep['observable']['anySource']} | |",
        f"| Authored edges holding the pair at the mining floor | {rep['hasData'][so]} | {rep['hasData'][cr]} | {rep['hasData']['anySource']} | |",
        f"| Confirmed (conf ≥ 0.70, n ≥ 20) | {rep['confirmed'][so]} | {rep['confirmed'][cr]} | {rep['confirmed']['anySource']} | {rep['confirmed']['both']} |",
        f"| Confirmed as % of observable (≥ 1 source) | | | {rep['confirmed']['pctOfObservableAny']} % | {rep['confirmed']['pctOfObservableBoth']} % |",
        f"| Contradicted (reverse conf ≥ 0.85, n ≥ 50) | {sum(1 for e in c['edges'] if so in e['sources'])} | {sum(1 for e in c['edges'] if cr in e['sources'])} | {c['count']} | |",
        f"| Unobserved (below floor in every source) | | | {rep['unobserved']} | |",
        f"| Observed but inconclusive (numbers kept, no verdict) | | | {rep['observedButInconclusive']} | |",
        f"| Novel candidates meeting the §15.6 thresholds | {rep['mined']['meetingPromotionThresholdsBySource'][so]} | {rep['mined']['meetingPromotionThresholdsBySource'][cr]} | {rep['mined']['meetingPromotionThresholds']} | |",
        f"| Promoted by a human | | | {rep['mined']['promoted']} | |",
        f"| Skills with data (of {rep['coverage']['skills']}) | {rep['coverage']['skillsWithData'][so]} | {rep['coverage']['skillsWithData'][cr]} | {rep['coverage']['skillsWithData']['anySource']} | |",
        f"| Branch from-skills above the floor (nTotal ≥ 50) | {rep['coverage']['branchFromSkillsAtFloor'][so]} | {rep['coverage']['branchFromSkillsAtFloor'][cr]} | | |",
        "",
        "## Status of the authored edges",
        "",
        "| status | edges |",
        "|---|---|",
    ]
    L += [f"| {k} | {v} |" for k, v in rep["byStatus"].items()]
    L += [
        "",
        "## Cohort filter effect (Stack Overflow)",
        "",
        "The 12-month rule (count only users whose first-ever question is ≥ 12 months after both technologies existed) is what "
        "makes the direction claim defensible; this is what it cost:",
        "",
        "| | before | after |",
        "|---|---|---|",
        f"| pairs at the n ≥ 20 floor | {rep['cohortFilterEffect']['pairsAtFloorBefore']} | {rep['cohortFilterEffect']['pairsAtFloorAfter']} |",
        f"| ordered observations | {rep['cohortFilterEffect']['orderedObservationsBefore']} | {rep['cohortFilterEffect']['orderedObservationsAfter']} |",
        f"| same-day ties dropped | {rep['cohortFilterEffect']['tiesDropped']} | |",
        "",
        "## Contradictions",
        "",
    ]
    if c["edges"]:
        L += ["| authored edge | contradicting source(s) | resolution |", "|---|---|---|"]
        for e in c["edges"]:
            r = e["resolution"]
            res = f"{r['decision']} — {r['note']} ({r['by']}, {r['date']})" if r else "open"
            L.append(f"| {names.get(e['from'], e['from'])} → {names.get(e['to'], e['to'])} | {', '.join(e['sources'])} | {res} |")
    else:
        L.append("None at the thresholds.")
    if rep["history"]:
        L += ["", "Resolutions whose authored edge no longer exists in that direction (flipped or removed through the taxonomy sources):", ""]
        for r in rep["history"]:
            L.append(f"- {names.get(r['from'], r['from'])} → {names.get(r['to'], r['to'])}: {r['decision']} — {r['note']} ({r['by']}, {r['date']})")
    L += [
        "",
        "## Coverage",
        "",
        f"- Skills with ≥ 1 source of data: {rep['coverage']['skillsWithData']['anySource']} of {rep['coverage']['skills']} "
        f"(Stack Overflow {rep['coverage']['skillsWithData'][so]}, Coursera {rep['coverage']['skillsWithData'][cr]})",
        f"- Authored edges with ≥ 1 source of data: {rep['coverage']['authoredEdgesWithData']} of {rep['authoredEdges']}",
        f"- Coursera Ring-1 courses with tags: {rep['coverage']['courseraCoursesWithTags']} of {rep['coverage']['courseraRing1Courses']} "
        f"({rep['coverage']['courseraTags']} tags); pooled skill edges: {rep['coverage']['courseraPooledEdges']}",
        f"- Stack Overflow pairs at floor: {rep['coverage']['stackoverflowPairsAtFloor']}",
        f"- Mined-only candidate edges in skill_edges.json: {rep['mined']['candidatesTotal']} (display and evidence only; drivesPath false unless promoted)",
        "",
        "## Definitions and thresholds",
        "",
    ]
    L += [f"- {k}: {v}" for k, v in rep["definitions"].items()]
    L += [f"- thresholds: {json.dumps(rep['thresholds'])}", ""]
    path.write_text("\n".join(L))


def fmt_stat(src: str, st: dict) -> str:
    extra = ""
    if src == "coursera":
        extra = f", {st['detail']['nCoursePairs']} course pairs"
    else:
        extra = f", sample {st['detail']['sample']}"
    return f"{src}: {st['support']} vs {st['reverse']} (conf {st['confidence']:.3f}, n {st['n']}{extra})"


def write_contradictions_md(path: Path, edges: list[dict], info: dict, names: dict) -> None:
    rows = [r for r in info["authoredRows"] if r["status"] == "contradicted-in-review"]
    by_key = {(e["from"], e["to"]): e for e in edges if e["origin"] == "authored"}
    L = [
        "# Contradictions — authored edges a source opposes",
        "",
        "Rendered by `python pipeline/merge_edges.py run` from the current evidence plus the human decisions in "
        "`evidence_resolutions.json` (edit that file, never this one). A contradiction is an authored edge a → b where "
        "a source shows b → a at confidence ≥ 0.85 with n ≥ 50. The authored edge keeps driving paths until a human "
        "resolves it; a `flip`, `remove` or `both-valid-drop-edge` decision is applied through the taxonomy source files "
        "(pipeline/sources/*.json) and re-validated, then the merge is re-run — never by editing src/data/.",
        "",
        f"- Open: {sum(1 for r in rows if not r['resolution'])} · Resolved: {sum(1 for r in rows if r['resolution'])} · "
        f"Historical (edge since flipped/removed): {len(info['history'])}",
        "",
    ]
    for r in rows:
        e = by_key[(r["from"], r["to"])]
        L.append(f"## {names.get(r['from'], r['from'])} → {names.get(r['to'], r['to'])}  (`{r['from']}` → `{r['to']}`)")
        L.append("")
        for src, st in e["sources"].items():
            mark = " ← contradicts" if r["verdicts"][src] == "contradict" else (" (confirms)" if r["verdicts"][src] == "confirm" else "")
            L.append(f"- {fmt_stat(src, st)}{mark}")
            if src == "coursera" and st["detail"].get("coursePairs"):
                cp = st["detail"]["coursePairs"][0]
                L.append(f"  - top course pair behind the authored direction: {cp['fromCourseId']} → {cp['toCourseId']} ({cp['support']})")
        res = r["resolution"]
        if res:
            L.append(f"- **Resolution: {res['decision']}** — {res['note']} ({res['by']}, {res['date']})")
        else:
            L.append("- **Resolution: open** (keep-authored / flip / remove / both-valid-drop-edge)")
        L.append("")
    if info["history"]:
        L += ["## Historical resolutions", ""]
        for r in info["history"]:
            L.append(f"- `{r['from']}` → `{r['to']}`: {r['decision']} — {r['note']} ({r['by']}, {r['date']})")
        L.append("")
    path.write_text("\n".join(L))


def write_promotions_md(path: Path, edges: list[dict], info: dict, names: dict, level: dict) -> None:
    cands = [c for c in info["candidateRows"] if c["qualifyingSources"]]
    by_key = {(e["from"], e["to"]): e for e in edges if e["origin"] == "mined"}
    L = [
        "# Promotions — mined-only edges that meet the §15.6 thresholds",
        "",
        "Rendered by `python pipeline/merge_edges.py run` from the current evidence plus the human decisions in "
        "`evidence_resolutions.json` (edit that file, never this one). A mined-only edge is listed when a source shows it at "
        "confidence ≥ 0.85, support ≥ 50, corroborated by ≥ 2 course pairs (Coursera) or ≥ 2 distinct tags (Stack Overflow). "
        "It drives paths only after a human records `promote` here AND it keeps levelBand(from) ≤ levelBand(to) AND the "
        "path-driving graph stays acyclic (the merge refuses otherwise). Everything else stays `candidate`: display and "
        "evidence only.",
        "",
        f"- Candidates meeting the thresholds: {len(cands)} · promoted: {sum(1 for c in cands if c['status'] == 'promoted')} · "
        f"kept as candidate by a human: {sum(1 for c in cands if c['resolution'] and c['resolution']['decision'] == 'keep-candidate')} · "
        f"undecided: {sum(1 for c in cands if not c['resolution'])}",
        "",
        "| from | to | level bands | sources (support vs reverse, conf, n) | qualifies via | decision |",
        "|---|---|---|---|---|---|",
    ]
    def key(c):
        e = by_key[(c["from"], c["to"])]
        return -max(st["support"] for st in e["sources"].values())
    for c in sorted(cands, key=key):
        e = by_key[(c["from"], c["to"])]
        srcs = "; ".join(fmt_stat(s, st) for s, st in e["sources"].items())
        res = c["resolution"]
        dec = f"{res['decision']} — {res['note']} ({res['by']}, {res['date']})" if res else "undecided"
        bands = f"{level[c['from']]} → {level[c['to']]}" + ("" if c["levelOk"] else " ✗")
        L.append(f"| {names.get(c['from'], c['from'])} (`{c['from']}`) | {names.get(c['to'], c['to'])} (`{c['to']}`) | {bands} | {srcs} | {', '.join(c['qualifyingSources'])} | {dec} |")
    L.append("")
    path.write_text("\n".join(L))


# ---------------------------------------------------------------- run / check

def run() -> int:
    for p in (IN_SO_EDGES, IN_SO_BRANCHES, IN_CR_EDGES, IN_CR_BRANCHES, IN_CR_TAGS):
        if not p.exists():
            print(f"missing {p.relative_to(REPO_ROOT)} — run the mining and pooling steps first")
            return 2
    skills = load_json(DATA_DIR / "skills.json")
    names = {s["id"]: s["name"] for s in skills}
    level = {s["id"]: s["levelBand"] for s in skills}
    so_doc, so_br = load_json(IN_SO_EDGES), load_json(IN_SO_BRANCHES)
    cr_doc, cr_br = load_json(IN_CR_EDGES), load_json(IN_CR_BRANCHES)
    tags_doc = load_json(IN_CR_TAGS)
    resolutions = load_resolutions()

    so_idx, so_obs = so_lookup(so_doc)
    cr_idx, cr_obs = coursera_lookup(cr_doc, tags_doc)
    lookups = {"stackoverflow": so_idx, "coursera": cr_idx}
    observed = {"stackoverflow": so_obs, "coursera": cr_obs}
    so_tags = {sid: s["tags"] for sid, s in so_doc["skills"].items()}
    edges, info = merge(skills, lookups, observed, resolutions, so_tags)
    branches = merge_branches(so_br, cr_br)
    report = build_report(edges, info, so_doc, cr_doc, tags_doc, branches, skills)

    inputs = {p.name: sha256_file(p) for p in (IN_SO_EDGES, IN_SO_BRANCHES, IN_CR_EDGES, IN_CR_BRANCHES, IN_CR_TAGS, DATA_DIR / "skills.json")}
    if IN_RESOLUTIONS.exists():
        inputs[IN_RESOLUTIONS.name] = sha256_file(IN_RESOLUTIONS)
    by_origin = Counter(e["origin"] for e in edges)
    edges_doc = {
        "description": "Merged, tiered prerequisite edges: authored (skills.json.prereqs, drive paths) annotated with per-source "
                       "learner-sequence evidence, plus mined-only candidates (display and evidence only unless a human promoted them). "
                       "Generated by pipeline/merge_edges.py; never hand-edited.",
        "caveats": {"stackoverflow": so_doc["caveat"], "coursera": cr_doc["caveat"]},
        "stackoverflow": {
            "cohortRule": so_doc["cohortRule"],
            "samples": so_doc["samples"],
            "tags": so_tags,
            "note": "tags behind each skill and the cohort rule apply to every stackoverflow block below (kept here once); detail.sample names the data the numbers came from",
        },
        "coursera": {"detail": "detail.nCoursePairs = distinct course pairs pooled; detail.coursePairs = top-5 behind the edge direction; fromItem/toItem = catalog items the courses belong to"},
        "thresholds": THRESHOLDS,
        "inputs": inputs,
        "stats": {
            "edges": len(edges), "authored": by_origin["authored"], "mined": by_origin["mined"],
            "byStatus": dict(sorted(Counter(e["status"] for e in edges).items())),
            "drivesPath": sum(1 for e in edges if e["drivesPath"]),
        },
        "edges": edges,
    }
    branches_doc = {
        "description": "What learners did next, per skill and per source: transition shares only (never satisfaction), "
                       "shrunk with alpha = 20 over the observed next-skills, listed at n >= 5, minSupportMet = nTotal >= 50. "
                       "Generated by pipeline/merge_edges.py from branches_so.json (one sample per from-skill, the larger nTotal) "
                       "and branches_coursera.json; never hand-edited.",
        "caveats": {"stackoverflow": so_doc["caveat"], "coursera": cr_doc["caveat"]},
        "params": {"alpha": 20, "minListed": 5, "minTotal": 50},
        "inputs": {k: inputs[k] for k in (IN_SO_BRANCHES.name, IN_CR_BRANCHES.name)},
        "stats": {
            "entries": len(branches),
            "bySource": dict(Counter(b["source"] for b in branches)),
            "minSupportMetBySource": {src: sum(1 for b in branches if b["source"] == src and b["minSupportMet"]) for src in SOURCES},
            "listedTransitions": sum(len(b["next"]) for b in branches),
        },
        "branches": branches,
    }
    dump(OUT_EDGES, edges_doc, "edges")
    dump(OUT_BRANCHES, branches_doc, "branches")
    OUT_REPORT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    write_report_md(OUT_REPORT_MD, report, names)
    write_contradictions_md(OUT_CONTRADICTIONS, edges, info, names)
    write_promotions_md(OUT_PROMOTIONS, edges, info, names, level)
    print(f"wrote {OUT_EDGES.relative_to(REPO_ROOT)}: {edges_doc['stats']}")
    print(f"wrote {OUT_BRANCHES.relative_to(REPO_ROOT)}: {branches_doc['stats']}")
    print(f"wrote {OUT_REPORT_MD.relative_to(REPO_ROOT)}, {OUT_CONTRADICTIONS.relative_to(REPO_ROOT)}, {OUT_PROMOTIONS.relative_to(REPO_ROOT)}")
    print(report["headline"])
    return 0


def _require(cond: bool, msg: str, errors: list[str]) -> None:
    if not cond:
        errors.append(msg)


def check_schema() -> int:
    """Pipeline-side mirror of SkillEdgeSchema / BranchSchema (src/schemas/evidence.ts) plus the
    evidence-integrity rules of ARCHITECTURE §10 item 4."""
    errors: list[str] = []
    skills = load_json(DATA_DIR / "skills.json")
    skill_ids = {s["id"] for s in skills}
    authored = {(p, s["id"]) for s in skills for p in s.get("prereqs", [])}
    doc = load_json(OUT_EDGES)
    for key in ("description", "caveats", "stackoverflow", "thresholds", "inputs", "stats", "edges"):
        _require(key in doc, f"skill_edges.json: missing {key}", errors)
    _require(bool(doc.get("stackoverflow", {}).get("cohortRule")), "skill_edges.json: stackoverflow.cohortRule missing", errors)
    for src, cav in doc.get("caveats", {}).items():
        for w in FORBIDDEN_WORDS:
            _require(w not in cav.lower(), f"skill_edges.json: {src} caveat contains {w!r}", errors)
    seen: set[tuple[str, str]] = set()
    authored_seen: set[tuple[str, str]] = set()
    driving: list[tuple[str, str]] = []
    for e in doc.get("edges", []):
        key = (e.get("from"), e.get("to"))
        _require(key[0] in skill_ids and key[1] in skill_ids and key[0] != key[1], f"{key}: endpoints", errors)
        _require(key not in seen and (key[1], key[0]) not in seen, f"{key}: duplicate pair", errors)
        seen.add(key)
        origin, status = e.get("origin"), e.get("status")
        if origin == "authored":
            _require(key in authored, f"{key}: authored edge not in skills.json.prereqs", errors)
            authored_seen.add(key)
            _require(status in ("confirmed-both", "confirmed-one-source", "contradicted-in-review", "no-data"), f"{key}: status {status!r}", errors)
            _require(e.get("drivesPath") is True, f"{key}: authored edge must drive paths", errors)
        elif origin == "mined":
            _require(key not in authored and (key[1], key[0]) not in authored, f"{key}: mined edge has an authored counterpart", errors)
            _require(status in ("candidate", "promoted"), f"{key}: status {status!r}", errors)
            _require(e.get("drivesPath") is (status == "promoted"), f"{key}: drivesPath must equal (status == promoted)", errors)
            _require(bool(e.get("sources")), f"{key}: mined edge without sources", errors)
            if status == "promoted":
                _require(e.get("resolution", {}).get("decision") == "promote", f"{key}: promoted without a human promote resolution", errors)
        else:
            errors.append(f"{key}: origin {origin!r}")
        if e.get("drivesPath"):
            driving.append(key)
        for src, st in (e.get("sources") or {}).items():
            _require(src in SOURCES, f"{key}: source {src!r}", errors)
            for f in ("support", "reverse", "n"):
                _require(isinstance(st.get(f), int) and st[f] >= 0, f"{key}/{src}: bad {f}", errors)
            _require(st.get("n") == st.get("support", 0) + st.get("reverse", 0) and st.get("n", 0) > 0, f"{key}/{src}: n", errors)
            _require(abs(st.get("confidence", -1) - st["support"] / st["n"]) < 1e-5, f"{key}/{src}: confidence", errors)
            _require(st.get("caveat") == doc["caveats"].get(src), f"{key}/{src}: caveat", errors)
            d = st.get("detail") or {}
            if src == "coursera":
                _require(isinstance(d.get("nCoursePairs"), int) and d["nCoursePairs"] >= 1, f"{key}/{src}: nCoursePairs", errors)
                _require(isinstance(d.get("coursePairs"), list), f"{key}/{src}: coursePairs", errors)
            else:
                _require(d.get("sample") in doc.get("stackoverflow", {}).get("samples", {}), f"{key}/{src}: sample", errors)
                _require(key[0] in doc.get("stackoverflow", {}).get("tags", {}) and key[1] in doc.get("stackoverflow", {}).get("tags", {}), f"{key}/{src}: tags block", errors)
        if "resolution" in e:
            r = e["resolution"]
            _require(r.get("by") == "human" and r.get("decision") in CONTRADICTION_DECISIONS + ("promote", "keep-candidate")
                     and r.get("note") and r.get("date"), f"{key}: resolution", errors)
    _require(authored_seen == authored, f"skill_edges.json: authored edges differ from skills.json.prereqs ({len(authored_seen)} vs {len(authored)})", errors)
    cyc = has_cycle(driving)
    _require(cyc is None, f"skill_edges.json: path-driving edges contain a cycle: {cyc}", errors)
    _require(doc.get("stats", {}).get("edges") == len(seen), "skill_edges.json: stats.edges mismatch", errors)

    b = load_json(OUT_BRANCHES)
    for key in ("description", "caveats", "params", "inputs", "stats", "branches"):
        _require(key in b, f"branches.json: missing {key}", errors)
    seen_b = set()
    for br in b.get("branches", []):
        k = (br.get("from"), br.get("source"))
        _require(k not in seen_b, f"branches.json: duplicate {k}", errors)
        seen_b.add(k)
        _require(k[0] in skill_ids and k[1] in SOURCES, f"branches.json: {k} from/source", errors)
        _require(br.get("caveat") == b["caveats"].get(k[1]), f"branches.json: {k} caveat", errors)
        for w in FORBIDDEN_WORDS:
            _require(w not in br.get("caveat", "").lower(), f"branches.json: {k} caveat contains {w!r}", errors)
        _require(br.get("minSupportMet") == (br.get("nTotal", 0) >= 50), f"branches.json: {k} minSupportMet", errors)
        nxt = br.get("next", [])
        _require(isinstance(br.get("nNextObserved"), int) and br["nNextObserved"] >= len(nxt), f"branches.json: {k} nNextObserved", errors)
        n_total, alpha, kk = br.get("nTotal", 0), 20, br.get("nNextObserved", 1)
        for x in nxt:
            _require(x.get("to") in skill_ids and x["to"] != k[0], f"branches.json: {k}->{x.get('to')} endpoint", errors)
            _require(isinstance(x.get("n"), int) and x["n"] >= 5, f"branches.json: {k}->{x.get('to')} n below listing floor", errors)
            _require(abs(x.get("shareRaw", -1) - x["n"] / n_total) < 1e-6, f"branches.json: {k}->{x.get('to')} shareRaw", errors)
            _require(abs(x.get("shareShrunk", -1) - (x["n"] + alpha / kk) / (n_total + alpha)) < 1e-6, f"branches.json: {k}->{x.get('to')} shareShrunk", errors)
            _require(isinstance(x.get("inCatalog"), bool), f"branches.json: {k}->{x.get('to')} inCatalog", errors)
        _require(sum(x["n"] for x in nxt) <= n_total, f"branches.json: {k} listed n exceeds nTotal", errors)
        # shares over all observed successors sum to 1 ± 1e-6 by construction: the listed subset must not exceed it
        listed_raw = sum(x["shareRaw"] for x in nxt)
        listed_shrunk = sum(x["shareShrunk"] for x in nxt)
        _require(listed_raw <= 1 + 1e-6 and listed_shrunk <= 1 + 1e-6, f"branches.json: {k} listed shares exceed 1", errors)
        if len(nxt) == kk:  # every observed successor is listed: the sums must be exactly 1
            _require(abs(listed_raw - 1) < 1e-6 and abs(listed_shrunk - 1) < 1e-6, f"branches.json: {k} shares do not sum to 1", errors)
    _require(b.get("stats", {}).get("entries") == len(seen_b), "branches.json: stats.entries mismatch", errors)
    _require(OUT_REPORT_JSON.exists() and OUT_REPORT_MD.exists(), "agreement report missing", errors)
    if errors:
        print("check-schema FAILED:")
        for m in errors[:40]:
            print(f"  - {m}")
        return 1
    print(f"check-schema OK: {len(seen)} edges ({len(authored_seen)} authored, {len(driving)} path-driving, acyclic), {len(seen_b)} branch entries")
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
