"""Stack Overflow question-order mining -> pipeline/evidence/edges_so.json, branches_so.json.

Signal. For each Stack Overflow user, the date of their first question carrying each tag.
Tags map to Pathwise skills through the hand-built pipeline/sources/tag_skill_map.json
(closed vocabulary = src/data/skills.json); a skill's first date for a user is the earliest
of its tags. If a user's first Python question precedes their first pandas question, that is
one vote for python -> pandas. Asking is not completing: every number this file produces is
rendered with the fixed caveat below.

Cohort-bias filter. Newer technologies always appear "after" older ones in the same user's
history (jQuery -> React is age, not prerequisite). For a pair (A, B) only users whose
first-ever question is >= COHORT_MONTHS after both technologies existed are counted
(technology birth = first appearance of any of the skill's tags on the site). Same-day ties
are unordered and dropped. Users with fewer than MIN_SKILLS or more than MAX_SKILLS mapped
skills are excluded (the latter are long-tenure professionals, not learners).

Route. The queries run on the BigQuery public mirror `bigquery-public-data.stackoverflow`
(sandbox project, free tier) through the `bq` CLI and land as CSVs in pipeline/build/so/
(gitignored). The mirror ends in 2022, so pairs that involve an LLM-era skill (the
ai-engineering domain) are re-measured on current data with a Stack Exchange Data Explorer
query over a 5 % user sample, run by hand in the browser; its CSV goes to the same folder.
Emission is offline, deterministic (same CSVs -> byte-identical JSON) and involves no LLM.

Commands (run from the repo root, inside `pipeline/`'s uv environment or plain python3):
  python pipeline/mine_so.py check   --project <gcp-project>   # reachability, MAX(creation_date), tag presence
  python pipeline/mine_so.py run     --project <gcp-project>   # pairs / branches / skills queries -> CSVs
  python pipeline/mine_so.py render-sede                       # writes the two SEDE queries to pipeline/build/so/
  python pipeline/mine_so.py emit [--allow-unsigned]           # CSVs -> pipeline/evidence/*.json + so_stats.md
  python pipeline/mine_so.py check-schema                      # validates the emitted files
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
REPO_ROOT = PIPELINE_DIR.parent
DATA_DIR = REPO_ROOT / "src" / "data"
SQL_DIR = PIPELINE_DIR / "sql"
BUILD_DIR = PIPELINE_DIR / "build" / "so"
EVIDENCE_DIR = PIPELINE_DIR / "evidence"
MAP_PATH = PIPELINE_DIR / "sources" / "tag_skill_map.json"

SOURCE = "stackoverflow"
CAVEAT = (
    "Stack Overflow question order (first question per tag), users who started after both "
    "technologies existed; asking ≠ completing"
)
PARAMS = {
    "minSkills": 2,
    "maxSkills": 40,
    "cohortMonths": 12,
    "minPairSupport": 20,  # support + reverse >= 20 keeps a pair
    "branchAlpha": 20,  # shrinkage weight towards the uniform prior
    "branchMinTotal": 50,  # nTotal >= 50 -> minSupportMet
    "branchMinListed": 5,  # a successor is listed only if n >= 5
    "sedeSampleMod": 20,  # OwnerUserId % 20 = 0 -> 5 % user sample
    "sedeMinPostId": 73000000,  # Posts.Id range seek: ~Aug 2022, just before the BigQuery mirror ends (2022-09-25)
    "llmEraDomain": "ai-engineering",
}
COHORT_RULE = (
    "For pair (A,B) count only users whose first-ever question is >= {cohortMonths} months after "
    "both technologies existed (birth = first appearance of any of the skill's tags on the site); "
    "same-day ties dropped; users with {minSkills}-{maxSkills} mapped skills only"
).format(**PARAMS)
BRANCH_RULE = (
    "Per eligible user, skills ordered by first date; every skill on the next distinct date is an "
    "immediate successor of every skill on the current date; same-day ties never counted; the "
    "cohort rule is applied to each (from, to) transition"
)
LICENCE = "Stack Overflow content is CC BY-SA 4.0 (https://stackoverflow.com/help/licensing); aggregate counts only"

BQ_DATASET = "bigquery-public-data.stackoverflow"


# ----------------------------------------------------------------------------- inputs


def load_json(path: Path):
    return json.loads(path.read_text())


def load_map() -> dict:
    doc = load_json(MAP_PATH)
    skills = load_json(DATA_DIR / "skills.json")
    skill_ids = {s["id"] for s in skills}
    seen: dict[str, str] = {}
    for row in doc["rows"]:
        tag, sid = row["tag"], row["skillId"]
        if sid not in skill_ids:
            raise SystemExit(f"tag_skill_map: unknown skill id {sid!r} for tag {tag!r}")
        if tag in seen:
            raise SystemExit(f"tag_skill_map: tag {tag!r} mapped twice ({seen[tag]}, {sid})")
        seen[tag] = sid
    for nd in doc.get("noDataSkills", []):
        if nd["skillId"] not in skill_ids:
            raise SystemExit(f"tag_skill_map: unknown no-data skill id {nd['skillId']!r}")
        if nd["skillId"] in {r["skillId"] for r in doc["rows"]}:
            raise SystemExit(f"tag_skill_map: {nd['skillId']} is both mapped and no-data")
    return doc


def map_signed(doc: dict) -> bool:
    so = doc.get("signoff") or {}
    return bool(so.get("anmol")) and bool(so.get("riyan"))


def tags_by_skill(doc: dict) -> dict[str, list[str]]:
    out: dict[str, list[str]] = defaultdict(list)
    for row in doc["rows"]:
        out[row["skillId"]].append(row["tag"])
    return {k: sorted(v) for k, v in out.items()}


def sql_str(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def tsql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


# ----------------------------------------------------------------------------- BigQuery


def render_bq(name: str, doc: dict) -> str:
    """Render pipeline/sql/so_bigquery_<name>.sql with the tag map inlined."""
    rows = sorted(doc["rows"], key=lambda r: (r["tag"], r["skillId"]))
    struct = ",\n    ".join(f"STRUCT({sql_str(r['tag'])} AS tag, {sql_str(r['skillId'])} AS skill_id)" for r in rows)
    common = (SQL_DIR / "so_bigquery_common.sql").read_text()
    body = (SQL_DIR / f"so_bigquery_{name}.sql").read_text()
    text = body.replace("{{COMMON}}", common.rstrip("\n"))
    text = (
        text.replace("{{TAG_SKILL_MAP}}", "\n    " + struct + "\n  ")
        .replace("{{MIN_SKILLS}}", str(PARAMS["minSkills"]))
        .replace("{{MAX_SKILLS}}", str(PARAMS["maxSkills"]))
        .replace("{{COHORT_MONTHS}}", str(PARAMS["cohortMonths"]))
    )
    if "{{" in text:
        raise SystemExit(f"unrendered placeholder in {name}: {text[text.index('{{'):][:40]}")
    return text


def find_bq() -> str:
    exe = shutil.which("bq")
    if exe:
        return exe
    for cand in ("/opt/homebrew/share/google-cloud-sdk/bin/bq", "/usr/local/share/google-cloud-sdk/bin/bq"):
        if Path(cand).exists():
            return cand
    raise SystemExit("bq CLI not found: install the Google Cloud SDK and run `gcloud auth login`")


def run_bq(name: str, project: str, doc: dict, out_csv: Path) -> Path:
    sql = render_bq(name, doc)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    (BUILD_DIR / f"rendered_{name}.sql").write_text(sql)
    cmd = [
        find_bq(),
        f"--project_id={project}",
        "--quiet",
        "--format=csv",
        "query",
        "--use_legacy_sql=false",
        "--max_rows=5000000",
    ]
    print(f"[bq] {name}: running ({len(sql)} chars of SQL)", file=sys.stderr)
    proc = subprocess.run(cmd, input=sql, text=True, capture_output=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        raise SystemExit(f"bq query {name} failed with exit code {proc.returncode}")
    out_csv.write_text(proc.stdout)
    n_rows = max(0, proc.stdout.count("\n") - 1)
    print(f"[bq] {name}: {n_rows} rows -> {out_csv.relative_to(REPO_ROOT)}", file=sys.stderr)
    return out_csv


def cmd_check(args) -> int:
    doc = load_map()
    out = run_bq("check", args.project, doc, BUILD_DIR / "check.csv")
    rows = list(csv.DictReader(out.open()))
    metrics = {r["metric"]: r["value"] for r in rows}
    print(f"max_creation_date    {metrics.get('max_creation_date')}")
    print(f"min_creation_date    {metrics.get('min_creation_date')}")
    print(f"questions_total      {metrics.get('questions_total')}")
    print(f"questions_with_owner {metrics.get('questions_with_owner')}")
    missing = sorted(k.split(":", 1)[1] for k, v in metrics.items() if k.startswith("tag_count:") and v == "0")
    present = sum(1 for k, v in metrics.items() if k.startswith("tag_count:") and v != "0")
    print(f"map tags present in the mirror: {present}; absent (count 0): {len(missing)}")
    for t in missing:
        print(f"  absent: {t}")
    return 0


def cmd_run(args) -> int:
    doc = load_map()
    for name in ("skills", "pairs", "branches"):
        run_bq(name, args.project, doc, BUILD_DIR / f"{name}.csv")
    return 0


# ----------------------------------------------------------------------------- SEDE


def llm_era_skills() -> list[str]:
    skills = load_json(DATA_DIR / "skills.json")
    return sorted(s["id"] for s in skills if s["domain"] == PARAMS["llmEraDomain"])


def read_skills_csv() -> tuple[dict[str, dict], dict[str, int]]:
    path = BUILD_DIR / "skills.csv"
    if not path.exists():
        raise SystemExit(f"missing {path.relative_to(REPO_ROOT)}: run `mine_so.py run` first")
    per_skill: dict[str, dict] = {}
    totals: dict[str, int] = {}
    for r in csv.DictReader(path.open()):
        sid = r["skill_id"]
        if sid.startswith("_"):
            totals[sid] = int(r["users_all"] or 0) or int(r["users_eligible"] or 0)
        else:
            per_skill[sid] = {
                "birth": r["birth_d"],
                "usersAll": int(r["users_all"]),
                "usersEligible": int(r["users_eligible"]),
            }
    return per_skill, totals


SEDE_PARAMS_PATH = BUILD_DIR / "sede_params.json"


def cmd_render_sede(args) -> int:
    doc = load_map()
    sample_mod = args.sample_mod
    per_skill, _ = read_skills_csv()
    rows = sorted(doc["rows"], key=lambda r: (r["tag"], r["skillId"]))
    map_values = ",\n    ".join(f"({tsql_str(r['tag'])}, {tsql_str(r['skillId'])})" for r in rows)
    llm = llm_era_skills()
    llm_values = ", ".join(f"({tsql_str(s)})" for s in llm)
    birth_values = ",\n    ".join(
        f"({tsql_str(s)}, {tsql_str(v['birth'])})" for s, v in sorted(per_skill.items()) if v["birth"]
    )
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("pairs", "branches"):
        text = (SQL_DIR / f"so_sede_llm_{name}.sql").read_text()
        text = (
            text.replace("{{TAG_SKILL_MAP_VALUES}}", "\n    " + map_values + "\n  ")
            .replace("{{LLM_SKILLS_VALUES}}", llm_values)
            .replace("{{BIRTH_VALUES}}", "\n    " + birth_values + "\n  ")
            .replace("{{MIN_SKILLS}}", str(PARAMS["minSkills"]))
            .replace("{{MAX_SKILLS}}", str(PARAMS["maxSkills"]))
            .replace("{{COHORT_MONTHS}}", str(PARAMS["cohortMonths"]))
            .replace("{{SAMPLE_MOD}}", str(sample_mod))
            .replace("{{MIN_POST_ID}}", str(PARAMS["sedeMinPostId"]))
        )
        if "{{" in text:
            raise SystemExit(f"unrendered placeholder in sede {name}")
        out = BUILD_DIR / f"rendered_sede_llm_{name}.sql"
        out.write_text(text)
        print(f"wrote {out.relative_to(REPO_ROOT)} ({len(text)} chars); paste into data.stackexchange.com/stackoverflow "
              f"and download the CSV to pipeline/build/so/sede_llm_{name}.csv")
    SEDE_PARAMS_PATH.write_text(json.dumps({"sampleMod": sample_mod, "minPostId": PARAMS["sedeMinPostId"]}, indent=2) + "\n")
    print(f"sample: OwnerUserId % {sample_mod} = 0 ({100 / sample_mod:g} % of users); recorded in {SEDE_PARAMS_PATH.relative_to(REPO_ROOT)}")
    return 0


# ----------------------------------------------------------------------------- emit


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_pairs_csv(path: Path) -> list[dict]:
    out = []
    for r in csv.DictReader(path.open()):
        out.append(
            {
                "a": r["s_from"],
                "b": r["s_to"],
                "support": int(r["support"]),
                "reverse": int(r["reverse"]),
                "supportAll": int(r["support_all"]),
                "reverseAll": int(r["reverse_all"]),
                "tiesAll": int(r["ties_all"]),
            }
        )
    return out


def orient(p: dict) -> dict:
    """Return the pair oriented so that support >= reverse (ties keep a -> b)."""
    if p["reverse"] > p["support"]:
        return {
            "from": p["b"],
            "to": p["a"],
            "support": p["reverse"],
            "reverse": p["support"],
            "supportAll": p["reverseAll"],
            "reverseAll": p["supportAll"],
            "tiesAll": p["tiesAll"],
        }
    return {
        "from": p["a"],
        "to": p["b"],
        "support": p["support"],
        "reverse": p["reverse"],
        "supportAll": p["supportAll"],
        "reverseAll": p["reverseAll"],
        "tiesAll": p["tiesAll"],
    }


def build_edges(pairs: list[dict], tags: dict[str, list[str]], sample: str) -> list[dict]:
    edges = []
    for p in pairs:
        o = orient(p)
        n = o["support"] + o["reverse"]
        if n < PARAMS["minPairSupport"]:
            continue
        edges.append(
            {
                "from": o["from"],
                "to": o["to"],
                "support": o["support"],
                "reverse": o["reverse"],
                "confidence": round(o["support"] / n, 6),
                "n": n,
                "unfiltered": {
                    "support": o["supportAll"],
                    "reverse": o["reverseAll"],
                    "ties": o["tiesAll"],
                },
                "sample": sample,
            }
        )
    edges.sort(key=lambda e: (e["from"], e["to"], e["sample"]))
    return edges


def build_branches(path: Path, taught: set[str], sample: str) -> list[dict]:
    per_from: dict[str, dict[str, int]] = defaultdict(dict)
    for r in csv.DictReader(path.open()):
        n = int(r["n"])
        if n >= 1:
            per_from[r["s_from"]][r["s_to"]] = n
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
                "sample": sample,
                "next": listed,
                "nTotal": n_total,
                "nNextObserved": k,
                "minSupportMet": n_total >= PARAMS["branchMinTotal"],
                "caveat": CAVEAT,
            }
        )
    return out


def authored_edges() -> list[tuple[str, str]]:
    skills = load_json(DATA_DIR / "skills.json")
    return sorted((p, s["id"]) for s in skills for p in s.get("prereqs", []))


def pair_index(pairs: list[dict]) -> dict[tuple[str, str], dict]:
    """(from, to) -> directional counts (support = from before to), for both orientations."""
    idx: dict[tuple[str, str], dict] = {}
    for p in pairs:
        idx[(p["a"], p["b"])] = {"support": p["support"], "reverse": p["reverse"]}
        idx[(p["b"], p["a"])] = {"support": p["reverse"], "reverse": p["support"]}
    return idx


def stats_block(pairs: list[dict], sede_pairs: list[dict], edges: list[dict], per_skill: dict, totals: dict, tags: dict, doc: dict) -> dict:
    floor = PARAMS["minPairSupport"]
    seen = [p for p in pairs if p["supportAll"] + p["reverseAll"] >= 1]
    after = [p for p in pairs if p["support"] + p["reverse"] >= floor]
    before = [p for p in pairs if p["supportAll"] + p["reverseAll"] >= floor]
    skills_observed = sorted(s for s, v in per_skill.items() if v["usersEligible"] >= 1)
    skills_in_edges = sorted({e["from"] for e in edges} | {e["to"] for e in edges})
    idx = pair_index(pairs)
    sede_idx = pair_index(sede_pairs)
    sede_skills = {p["a"] for p in sede_pairs} | {p["b"] for p in sede_pairs}
    observed_any = set(skills_observed) | sede_skills
    authored = authored_edges()
    endpoints_observed = [(p, s) for p, s in authored if p in observed_any and s in observed_any]
    at_floor = []
    for p, s in authored:
        for src, name in ((idx, "full-mirror"), (sede_idx, "sede-current")):
            d = src.get((p, s))
            if d and d["support"] + d["reverse"] >= floor:
                n = d["support"] + d["reverse"]
                at_floor.append({"from": p, "to": s, "support": d["support"], "reverse": d["reverse"], "n": n,
                                 "confidence": round(d["support"] / n, 6), "sample": name})
                break
    lowest = sorted(at_floor, key=lambda e: (e["confidence"], -e["n"], e["from"], e["to"]))[:20]
    top = sorted(edges, key=lambda e: (-e["support"], e["from"], e["to"]))[:20]
    n_all_before = sum(p["supportAll"] + p["reverseAll"] for p in pairs)
    n_all_after = sum(p["support"] + p["reverse"] for p in pairs)
    return {
        "usersWithQuestions": totals.get("_users_with_questions"),
        "usersWithAnyMappedSkill": totals.get("_users_with_any_mapped_skill"),
        "usersEligible": totals.get("_users_eligible"),
        "skillsMapped": len(tags),
        "skillsNoDataByConstruction": sorted(nd["skillId"] for nd in doc.get("noDataSkills", [])),
        "skillsObserved": len(observed_any),
        "skillsObservedMirror": len(skills_observed),
        "skillsObservedSede": len(sede_skills),
        "skillsInKeptEdges": len(skills_in_edges),
        "skillsMappedButUnobserved": sorted(set(tags) - observed_any),
        "pairsSeen": len(seen),
        "pairsAtFloor": len(after),
        "authoredEdges": len(authored),
        "authoredEdgesEndpointsObserved": len(endpoints_observed),
        "authoredEdgesAtFloor": len(at_floor),
        "authoredEdgesReverseWins": sum(1 for e in at_floor if e["confidence"] < 0.5),
        "cohortFilterEffect": {
            "pairsAtFloorBefore": len(before),
            "pairsAtFloorAfter": len(after),
            "orderedObservationsBefore": n_all_before,
            "orderedObservationsAfter": n_all_after,
            "tiesDropped": sum(p["tiesAll"] for p in pairs),
        },
        "top20EdgesBySupport": [
            {k: e[k] for k in ("from", "to", "support", "reverse", "confidence", "n")} for e in top
        ],
        "lowest20ConfidenceAuthoredEdges": lowest,
    }


def branch_stats(branches: list[dict]) -> dict:
    met = [b for b in branches if b["minSupportMet"]]
    return {
        "fromSkills": len(branches),
        "fromSkillsMinSupportMet": len(met),
        "listedTransitions": sum(len(b["next"]) for b in branches),
        "fromSkillsWithListed": sum(1 for b in branches if b["next"]),
    }


def dump(path: Path, obj: dict, list_key: str) -> None:
    """Pretty header, then one compact line per element of obj[list_key] (diff-friendly, ~4x smaller)."""
    head = {k: v for k, v in obj.items() if k != list_key}
    text = json.dumps(head, indent=2, sort_keys=True, ensure_ascii=False)
    assert text.endswith("\n}")
    lines = [json.dumps(item, sort_keys=True, ensure_ascii=False, separators=(",", ":")) for item in obj[list_key]]
    body = ",\n    ".join(lines)
    text = text[:-2] + f',\n  "{list_key}": [\n    ' + body + "\n  ]\n}\n"
    path.write_text(text)


def write_stats_md(path: Path, edges_doc: dict, branches_doc: dict) -> None:
    s = edges_doc["stats"]
    L = []
    L.append("# Stack Overflow question-order mining — stats\n")
    L.append("Produced by `python pipeline/mine_so.py emit`; every number below is computed, none is typed in.\n")
    L.append(f"- Map signed off by both humans: **{edges_doc['mapSignedOff']}** ({json.dumps(edges_doc['mapSignoff'])})")
    L.append(f"- Cohort rule: {COHORT_RULE}")
    L.append(f"- Caveat on every number: {CAVEAT}\n")
    L.append("## Coverage\n")
    for k in ("usersWithQuestions", "usersWithAnyMappedSkill", "usersEligible", "skillsMapped", "skillsObserved",
              "skillsObservedMirror", "skillsObservedSede", "skillsInKeptEdges", "pairsSeen", "pairsAtFloor", "authoredEdges", "authoredEdgesEndpointsObserved",
              "authoredEdgesAtFloor", "authoredEdgesReverseWins"):
        L.append(f"- {k}: {s[k]}")
    L.append(f"- skillsNoDataByConstruction ({len(s['skillsNoDataByConstruction'])}): {', '.join(s['skillsNoDataByConstruction'])}")
    L.append(f"- skillsMappedButUnobserved ({len(s['skillsMappedButUnobserved'])}): {', '.join(s['skillsMappedButUnobserved']) or '—'}\n")
    c = s["cohortFilterEffect"]
    L.append("## Cohort filter effect (12-month rule)\n")
    L.append(f"- pairs at floor (n ≥ {PARAMS['minPairSupport']}): {c['pairsAtFloorBefore']} before → {c['pairsAtFloorAfter']} after")
    L.append(f"- ordered observations: {c['orderedObservationsBefore']} before → {c['orderedObservationsAfter']} after; same-day ties dropped: {c['tiesDropped']}\n")
    L.append("## Top 20 edges by support\n")
    L.append("| from | to | support | reverse | conf | n |\n|---|---|---|---|---|---|")
    for e in s["top20EdgesBySupport"]:
        L.append(f"| {e['from']} | {e['to']} | {e['support']} | {e['reverse']} | {e['confidence']:.3f} | {e['n']} |")
    L.append("\n## 20 lowest-confidence authored edges (the noise, not hidden)\n")
    L.append("Confidence here is for the AUTHORED direction (prereq before dependent); < 0.5 means learners asked in the opposite order more often.\n")
    L.append("| authored from | authored to | support | reverse | conf | n | sample |\n|---|---|---|---|---|---|---|")
    for e in s["lowest20ConfidenceAuthoredEdges"]:
        L.append(f"| {e['from']} | {e['to']} | {e['support']} | {e['reverse']} | {e['confidence']:.3f} | {e['n']} | {e['sample']} |")
    L.append("\n## LLM-era top-up (Stack Exchange Data Explorer, current data)\n")
    L.append(f"- {json.dumps(edges_doc['llmEraTopUp'], sort_keys=True)}\n")
    L.append("## Branches\n")
    L.append(f"- {json.dumps(branches_doc['stats'], sort_keys=True)}\n")
    L.append(f"_{LICENCE}._\n")
    path.write_text("\n".join(L))


def cmd_emit(args) -> int:
    doc = load_map()
    signed = map_signed(doc)
    if not signed and not args.allow_unsigned:
        raise SystemExit("tag_skill_map.json is not signed off by both humans; pass --allow-unsigned for a draft run")
    tags = tags_by_skill(doc)
    per_skill, totals = read_skills_csv()
    pairs_csv = BUILD_DIR / "pairs.csv"
    branches_csv = BUILD_DIR / "branches.csv"
    for p in (pairs_csv, branches_csv):
        if not p.exists():
            raise SystemExit(f"missing {p.relative_to(REPO_ROOT)}: run `mine_so.py run` first")
    catalog = load_json(DATA_DIR / "catalog.json")
    taught = {t["skillId"] for item in catalog for t in item.get("skillsTaught", [])}

    pairs = read_pairs_csv(pairs_csv)
    edges = build_edges(pairs, tags, "full-mirror")
    branches = build_branches(branches_csv, taught, "full-mirror")
    inputs = {name: sha256_file(BUILD_DIR / name) for name in ("skills.csv", "pairs.csv", "branches.csv")}

    llm = llm_era_skills()
    sede_pairs_csv = BUILD_DIR / "sede_llm_pairs.csv"
    sede_branches_csv = BUILD_DIR / "sede_llm_branches.csv"
    sede_params = json.loads(SEDE_PARAMS_PATH.read_text()) if SEDE_PARAMS_PATH.exists() else {"sampleMod": PARAMS["sedeSampleMod"], "minPostId": PARAMS["sedeMinPostId"]}
    sede_label = "sede-current"
    sede_rule = (f"Stack Exchange Data Explorer, current data: users with >= 1 LLM-era question among posts with Id >= "
                 f"{sede_params['minPostId']}, OwnerUserId % {sede_params['sampleMod']} = 0 ({100 / sede_params['sampleMod']:g} % of users), "
                 f"full history per user; pairs with an LLM-era endpoint only")
    sede_pairs: list[dict] = []
    sede_users: dict[str, int] = {}
    if sede_pairs_csv.exists():
        sede_pairs = read_pairs_csv(sede_pairs_csv)
        for p in sede_pairs:  # rough per-skill presence in the SEDE data: max ordered observations over its pairs
            for sid in (p["a"], p["b"]):
                sede_users[sid] = max(sede_users.get(sid, 0), p["supportAll"] + p["reverseAll"] + p["tiesAll"])
        sede_edges = build_edges(sede_pairs, tags, sede_label)
        edges = sorted(edges + sede_edges, key=lambda e: (e["from"], e["to"], e["sample"]))
        inputs["sede_llm_pairs.csv"] = sha256_file(sede_pairs_csv)
        top_up = {
            "status": "ingested",
            "llmEraSkills": llm,
            "pairsSeen": sum(1 for p in sede_pairs if p["supportAll"] + p["reverseAll"] >= 1),
            "pairsAtFloor": len(sede_edges),
            "sample": sede_rule,
            "orderedObservations": sum(p["supportAll"] + p["reverseAll"] for p in sede_pairs),
        }
    else:
        top_up = {"status": "pending", "llmEraSkills": llm,
                  "note": "run `mine_so.py render-sede`, execute the query on data.stackexchange.com, save the CSV to pipeline/build/so/sede_llm_pairs.csv, re-run emit"}
    if sede_branches_csv.exists():
        branches = branches + build_branches(sede_branches_csv, taught, sede_label)
        branches.sort(key=lambda b: (b["from"], b["sample"]))
        inputs["sede_llm_branches.csv"] = sha256_file(sede_branches_csv)

    edges_doc = {
        "source": SOURCE,
        "caveat": CAVEAT,
        "cohortRule": COHORT_RULE,
        "licence": LICENCE,
        "params": PARAMS,
        "mapSignedOff": signed,
        "mapSignoff": doc.get("signoff"),
        "mapDraftedOn": doc.get("draftedOn"),
        "inputs": inputs,
        "orientation": "each pair is stored once, oriented so that support >= reverse; confidence = support / n; "
                       "n = support + reverse after the cohort filter; `unfiltered` keeps the pre-filter counts",
        "samples": {
            "full-mirror": f"BigQuery {BQ_DATASET} (ends 2022)",
            sede_label: sede_rule,
        },
        "skills": {
            sid: {
                "tags": tags.get(sid, []),
                "mirror": per_skill.get(sid),
                "sedeUsersInPairs": sede_users.get(sid),
            }
            for sid in sorted(set(tags) | set(per_skill))
        },
        "edgeFields": "from, to, support, reverse, confidence, n, unfiltered{support,reverse,ties}, sample; the tags behind "
                      "each endpoint are skills[<id>].tags; skills[<id>].mirror = birth/users in the BigQuery mirror (null "
                      "if unobserved there); skills[<id>].sedeUsersInPairs = largest pair observation count in the SEDE data",
        "noDataSkills": sorted(doc.get("noDataSkills", []), key=lambda d: d["skillId"]),
        "llmEraTopUp": top_up,
        "stats": stats_block(pairs, sede_pairs, edges, per_skill, totals, tags, doc),
        "edges": edges,
    }
    branches_doc = {
        "source": SOURCE,
        "caveat": CAVEAT,
        "cohortRule": COHORT_RULE,
        "branchRule": BRANCH_RULE,
        "licence": LICENCE,
        "params": {k: PARAMS[k] for k in ("branchAlpha", "branchMinTotal", "branchMinListed", "minSkills", "maxSkills", "cohortMonths")},
        "shrinkage": "shareShrunk = (n + alpha * prior) / (nTotal + alpha), uniform prior 1/nNextObserved over the observed "
                     "next-skills; shares sum to 1 over all observed successors, the listed subset (n >= branchMinListed) sums to less",
        "mapSignedOff": signed,
        "inputs": {k: v for k, v in inputs.items() if "branches" in k},
        "samples": {"full-mirror": f"BigQuery {BQ_DATASET} (ends 2022)", sede_label: sede_rule},
        "stats": branch_stats(branches),
        "branches": branches,
    }
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    dump(EVIDENCE_DIR / "edges_so.json", edges_doc, "edges")
    dump(EVIDENCE_DIR / "branches_so.json", branches_doc, "branches")
    write_stats_md(EVIDENCE_DIR / "so_stats.md", edges_doc, branches_doc)
    print(json.dumps({k: v for k, v in edges_doc["stats"].items() if not k.startswith(("top20", "lowest20"))}, indent=2))
    print(f"edges: {len(edges)}  branches: {len(branches)}  -> {EVIDENCE_DIR.relative_to(REPO_ROOT)}/")
    return check_schema()


# ----------------------------------------------------------------------------- schema check


def _require(cond: bool, msg: str, errors: list[str]) -> None:
    if not cond:
        errors.append(msg)


def check_schema() -> int:
    """Pipeline-side mirror of the Zod schema that M5.7 adds under src/schemas/evidence.ts."""
    errors: list[str] = []
    skills = {s["id"] for s in load_json(DATA_DIR / "skills.json")}
    e = load_json(EVIDENCE_DIR / "edges_so.json")
    for key in ("source", "caveat", "cohortRule", "licence", "params", "mapSignedOff", "inputs", "skills", "stats", "edges"):
        _require(key in e, f"edges_so.json: missing {key}", errors)
    _require(e.get("source") == SOURCE, "edges_so.json: source", errors)
    _require(e.get("caveat") == CAVEAT, "edges_so.json: caveat text changed", errors)
    for w in ("satisfied", "struggled", "liked", "hard"):
        _require(w not in e.get("caveat", "").lower(), f"edges_so.json: caveat contains {w!r}", errors)
    seen = set()
    for edge in e.get("edges", []):
        key = (edge.get("from"), edge.get("to"), edge.get("sample"))
        _require(key not in seen, f"edges_so.json: duplicate edge {key}", errors)
        seen.add(key)
        _require(edge.get("from") in skills and edge.get("to") in skills, f"edges_so.json: unknown skill in {key}", errors)
        _require(edge.get("from") != edge.get("to"), f"edges_so.json: self edge {key}", errors)
        for f in ("support", "reverse", "n"):
            _require(isinstance(edge.get(f), int) and edge[f] >= 0, f"edges_so.json: {key} bad {f}", errors)
        _require(edge.get("n") == edge.get("support", 0) + edge.get("reverse", 0), f"edges_so.json: {key} n mismatch", errors)
        _require(edge.get("n", 0) >= PARAMS["minPairSupport"], f"edges_so.json: {key} below floor", errors)
        _require(edge.get("support", 0) >= edge.get("reverse", 0), f"edges_so.json: {key} not oriented", errors)
        _require(abs(edge.get("confidence", -1) - edge["support"] / edge["n"]) < 1e-5, f"edges_so.json: {key} confidence", errors)
        _require(edge.get("from") in e.get("skills", {}) and edge.get("to") in e.get("skills", {}), f"edges_so.json: {key} endpoint missing from skills block (tags)", errors)
    for sid, info in e.get("skills", {}).items():
        _require(sid in skills, f"edges_so.json: skills block has unknown skill {sid}", errors)
        _require(isinstance(info.get("tags"), list) and len(info["tags"]) >= 1, f"edges_so.json: skills[{sid}] has no tags", errors)
        _require(edge.get("sample") in e.get("samples", {}), f"edges_so.json: {key} unknown sample", errors)
    b = load_json(EVIDENCE_DIR / "branches_so.json")
    for key in ("source", "caveat", "cohortRule", "branchRule", "params", "stats", "branches"):
        _require(key in b, f"branches_so.json: missing {key}", errors)
    for br in b.get("branches", []):
        frm = br.get("from")
        _require(frm in skills, f"branches_so.json: unknown from {frm}", errors)
        _require(br.get("source") == SOURCE and br.get("caveat") == CAVEAT, f"branches_so.json: {frm} source/caveat", errors)
        _require(br.get("minSupportMet") == (br.get("nTotal", 0) >= PARAMS["branchMinTotal"]), f"branches_so.json: {frm} minSupportMet", errors)
        total_raw = 0.0
        for nx in br.get("next", []):
            _require(nx.get("to") in skills, f"branches_so.json: {frm} unknown to {nx.get('to')}", errors)
            _require(nx.get("n", 0) >= PARAMS["branchMinListed"], f"branches_so.json: {frm}->{nx.get('to')} below listing floor", errors)
            _require(0 < nx.get("shareRaw", 0) <= 1 and 0 < nx.get("shareShrunk", 0) <= 1, f"branches_so.json: {frm}->{nx.get('to')} share range", errors)
            _require(isinstance(nx.get("inCatalog"), bool), f"branches_so.json: {frm}->{nx.get('to')} inCatalog", errors)
            total_raw += nx["shareRaw"]
        _require(total_raw <= 1 + 1e-6, f"branches_so.json: {frm} listed shares exceed 1", errors)
    if errors:
        print(f"schema check FAILED ({len(errors)}):")
        for msg in errors[:50]:
            print(f"  - {msg}")
        return 1
    print("schema check passed: edges_so.json, branches_so.json")
    return 0


# ----------------------------------------------------------------------------- main


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("check", "run"):
        p = sub.add_parser(name)
        p.add_argument("--project", default=os.environ.get("BQ_PROJECT"), required=not os.environ.get("BQ_PROJECT"),
                       help="GCP project id (sandbox is fine); or set BQ_PROJECT")
    p = sub.add_parser("render-sede")
    p.add_argument("--sample-mod", type=int, default=PARAMS["sedeSampleMod"],
                   help="OwnerUserId %% N = 0 user sample for the SEDE queries (20 = 5 %%, 1 = everyone)")
    p = sub.add_parser("emit")
    p.add_argument("--allow-unsigned", action="store_true", help="emit from a map that both humans have not signed yet (draft stats)")
    sub.add_parser("check-schema")
    args = ap.parse_args()
    if args.cmd == "check":
        return cmd_check(args)
    if args.cmd == "run":
        return cmd_run(args)
    if args.cmd == "render-sede":
        return cmd_render_sede(args)
    if args.cmd == "emit":
        return cmd_emit(args)
    if args.cmd == "check-schema":
        return check_schema()
    return 2


if __name__ == "__main__":
    sys.exit(main())
