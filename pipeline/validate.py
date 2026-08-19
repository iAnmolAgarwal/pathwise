"""Validate the committed static data layer end to end.

Checks, mirroring the Zod schemas in src/schemas/:
  1. Schema shape of skills.json, goals.json, catalog.json (fields, enums, ranges).
  2. Skill prerequisite edges form a DAG.
  3. Referential integrity: every skillId referenced anywhere exists.
  4. Embedding coverage: every skill and catalog item has a 384-dim vector, no extras.
  5. Evidence files under pipeline/evidence/ (when present) pass mine_so.py's and
     mine_coursera.py's schema checks (pipeline-side mirrors of the Zod evidence schema);
     their counts land in the report.

Writes pipeline/validation-report.json (committed) containing the outcome, entity
counts, coverage warnings, and sha256 hashes of the four data files; the Vitest
suite recomputes the hashes so `npm test` fails if data drifts from the last
validated state.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
REPO_ROOT = PIPELINE_DIR.parent
DATA_DIR = REPO_ROOT / "src" / "data"

DOMAINS = {
    "foundations",
    "web-frontend",
    "web-backend",
    "data-engineering",
    "data-analysis",
    "machine-learning",
    "ai-engineering",
    "cloud",
    "devops",
    "security",
}
KINDS = {"course", "project", "assessment"}
FORMATS = {"video", "interactive", "text", "project"}
COSTS = {"free", "freemium", "paid"}
DATA_FILES = ["skills.json", "goals.json", "catalog.json", "embeddings.json"]


def check_skill_refs(refs: list, skill_ids: set[str], owner: str, field: str, errors: list[str]) -> None:
    for ref in refs:
        if ref.get("skillId") not in skill_ids:
            errors.append(f"{owner}: {field} references unknown skill {ref.get('skillId')!r}")
        if ref.get("level") not in (1, 2, 3):
            errors.append(f"{owner}: {field}.{ref.get('skillId')} has invalid level {ref.get('level')!r}")


def validate_skills(skills: list[dict], errors: list[str]) -> set[str]:
    skill_ids = {s["id"] for s in skills}
    if len(skill_ids) != len(skills):
        errors.append("skills.json: duplicate ids")
    for s in skills:
        sid = s.get("id", "<missing>")
        for field in ("id", "name", "domain", "description"):
            if not s.get(field):
                errors.append(f"skill {sid}: missing '{field}'")
        if s.get("domain") not in DOMAINS:
            errors.append(f"skill {sid}: unknown domain {s.get('domain')!r}")
        if s.get("levelBand") not in (1, 2, 3):
            errors.append(f"skill {sid}: invalid levelBand {s.get('levelBand')!r}")
        for p in s.get("prereqs", []):
            if p not in skill_ids:
                errors.append(f"skill {sid}: unknown prereq {p!r}")
            if p == sid:
                errors.append(f"skill {sid}: self-referential prereq")

    # DAG check (iterative DFS, three-color).
    prereqs = {s["id"]: s.get("prereqs", []) for s in skills}
    state: dict[str, int] = {}
    for start in prereqs:
        if state.get(start):
            continue
        stack = [(start, iter(prereqs[start]))]
        state[start] = 1
        while stack:
            node, it = stack[-1]
            advanced = False
            for nxt in it:
                if state.get(nxt) == 1:
                    errors.append(f"skills.json: prerequisite cycle involving {nxt!r}")
                    state[nxt] = 2
                elif not state.get(nxt) and nxt in prereqs:
                    state[nxt] = 1
                    stack.append((nxt, iter(prereqs[nxt])))
                    advanced = True
                    break
            if not advanced:
                state[node] = 2
                stack.pop()
    return skill_ids


def validate_goals(goals: list[dict], skill_ids: set[str], errors: list[str]) -> None:
    if len({g["id"] for g in goals}) != len(goals):
        errors.append("goals.json: duplicate ids")
    for g in goals:
        gid = g.get("id", "<missing>")
        for field in ("id", "title", "description"):
            if not g.get(field):
                errors.append(f"goal {gid}: missing '{field}'")
        if not g.get("requiredSkills"):
            errors.append(f"goal {gid}: requiredSkills is empty")
        check_skill_refs(g.get("requiredSkills", []), skill_ids, f"goal {gid}", "requiredSkills", errors)


def validate_catalog(catalog: list[dict], skill_ids: set[str], errors: list[str]) -> None:
    if len({c["id"] for c in catalog}) != len(catalog):
        errors.append("catalog.json: duplicate ids")
    for c in catalog:
        cid = c.get("id", "<missing>")
        for field in ("id", "title", "provider", "url", "description"):
            if not c.get(field):
                errors.append(f"catalog {cid}: missing '{field}'")
        if c.get("kind") not in KINDS:
            errors.append(f"catalog {cid}: invalid kind {c.get('kind')!r}")
        if c.get("format") not in FORMATS:
            errors.append(f"catalog {cid}: invalid format {c.get('format')!r}")
        if c.get("cost") not in COSTS:
            errors.append(f"catalog {cid}: invalid cost {c.get('cost')!r}")
        if c.get("difficulty") not in (1, 2, 3, 4, 5):
            errors.append(f"catalog {cid}: invalid difficulty {c.get('difficulty')!r}")
        if not isinstance(c.get("durationHours"), (int, float)) or c["durationHours"] <= 0:
            errors.append(f"catalog {cid}: durationHours must be positive")
        qp = c.get("qualityPrior")
        if not isinstance(qp, (int, float)) or not 0 <= qp <= 1:
            errors.append(f"catalog {cid}: qualityPrior out of range")
        if not c.get("skillsTaught"):
            errors.append(f"catalog {cid}: skillsTaught is empty")
        check_skill_refs(c.get("skillsTaught", []), skill_ids, f"catalog {cid}", "skillsTaught", errors)
        check_skill_refs(c.get("skillsRequired", []), skill_ids, f"catalog {cid}", "skillsRequired", errors)


def validate_embeddings(
    embeddings: dict, skill_ids: set[str], catalog_ids: set[str], errors: list[str]
) -> None:
    expected = skill_ids | catalog_ids
    have = set(embeddings)
    for missing in sorted(expected - have):
        errors.append(f"embeddings.json: missing vector for {missing!r}")
    for extra in sorted(have - expected):
        errors.append(f"embeddings.json: vector for unknown id {extra!r}")
    for id_, vec in embeddings.items():
        if not isinstance(vec, list) or len(vec) != 384:
            errors.append(f"embeddings.json: {id_} vector is not 384-dim")
            break


def coverage_warnings(skills: list[dict], catalog: list[dict]) -> list[str]:
    taught: set[str] = set()
    for c in catalog:
        for ref in c.get("skillsTaught", []):
            taught.add(ref["skillId"])
    untaught = sorted(s["id"] for s in skills if s["id"] not in taught)
    return [f"skill '{s}' has no catalog item teaching it" for s in untaught]


def validate_evidence(errors: list[str]) -> dict:
    """Mined evidence under pipeline/evidence/, if emitted: Stack Overflow (edges_so.json,
    branches_so.json) and Coursera (edges_coursera_course.json)."""
    sys.path.insert(0, str(PIPELINE_DIR))
    report: dict = {"stackoverflow": None, "coursera": None}
    edges_path = PIPELINE_DIR / "evidence" / "edges_so.json"
    branches_path = PIPELINE_DIR / "evidence" / "branches_so.json"
    if edges_path.exists() and branches_path.exists():
        import mine_so  # noqa: E402  (same directory; no third-party imports)

        if mine_so.check_schema() != 0:
            errors.append("pipeline/evidence: Stack Overflow files failed mine_so.py check-schema")
        edges = json.loads(edges_path.read_text())
        branches = json.loads(branches_path.read_text())
        report["stackoverflow"] = {
            "edges": len(edges["edges"]),
            "branches": len(branches["branches"]),
            "mapSignedOff": edges.get("mapSignedOff"),
            "usersEligible": edges["stats"].get("usersEligible"),
            "pairsAtFloor": edges["stats"].get("pairsAtFloor"),
        }
    coursera_path = PIPELINE_DIR / "evidence" / "edges_coursera_course.json"
    if coursera_path.exists():
        import mine_coursera  # noqa: E402

        if mine_coursera.check_schema() != 0:
            errors.append("pipeline/evidence: Coursera file failed mine_coursera.py check-schema")
        doc = json.loads(coursera_path.read_text())
        chains = doc.get("chains", {})
        if not (chains.get("allSuccessSurvive") and chains.get("noNonsenseSurvives")):
            errors.append("pipeline/evidence: Coursera chain checks failed (a success chain lost or a nonsense chain kept)")
        report["coursera"] = {
            "courseEdges": len(doc["edges"]),
            "ring1Courses": len(doc["courses"]),
            "namesInBand": doc["stats"].get("namesInBand"),
            "pairsAtSupportFloor": doc["stats"].get("pairsAtSupportFloor"),
            "baselineReproduced": doc.get("baseline", {}).get("reproducesPublished"),
        }
    return report


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors: list[str] = []

    skills = json.loads((DATA_DIR / "skills.json").read_text())
    goals = json.loads((DATA_DIR / "goals.json").read_text())
    catalog = json.loads((DATA_DIR / "catalog.json").read_text())
    embeddings = json.loads((DATA_DIR / "embeddings.json").read_text())

    skill_ids = validate_skills(skills, errors)
    validate_goals(goals, skill_ids, errors)
    validate_catalog(catalog, skill_ids, errors)
    validate_embeddings(embeddings, skill_ids, {c["id"] for c in catalog}, errors)
    warnings = coverage_warnings(skills, catalog)
    evidence = validate_evidence(errors)

    report = {
        "passed": not errors,
        "counts": {
            "skills": len(skills),
            "prereqEdges": sum(len(s.get("prereqs", [])) for s in skills),
            "goals": len(goals),
            "courses": sum(1 for c in catalog if c["kind"] == "course"),
            "projects": sum(1 for c in catalog if c["kind"] == "project"),
            "assessments": sum(1 for c in catalog if c["kind"] == "assessment"),
            "embeddings": len(embeddings),
        },
        "evidence": evidence,
        "errors": errors,
        "warnings": warnings,
        "dataHashes": {name: sha256_file(DATA_DIR / name) for name in DATA_FILES},
    }
    out = PIPELINE_DIR / "validation-report.json"
    out.write_text(json.dumps(report, indent=2) + "\n")

    print(f"Counts: {report['counts']}")
    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print(f"FAILED with {len(errors)} errors:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"PASSED. Wrote {out.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
