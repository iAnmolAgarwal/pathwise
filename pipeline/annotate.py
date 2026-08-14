"""Validate taxonomy annotations and emit the final catalog.

Takes the per-domain source files (which carry skillsTaught/skillsRequired,
difficulty, and qualityPrior annotations alongside the raw fields), checks every
annotation against the committed skill taxonomy, and writes src/data/catalog.json.

Also emits pipeline/build/spotcheck.md — a deterministic ~10% per-domain sample
for manual review of annotation quality before the catalog is finalized.

qualityPrior rubric (0-1):
  0.9+  flagship university/industry certificates and canonical resources
  0.8   official docs and vendor training, top-rated platforms and courses
  0.7   solid community resources and well-reviewed niche courses
  0.6   useful but unvetted or lightweight resources
"""

from __future__ import annotations

import json
import random
import sys
from collections import defaultdict
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
REPO_ROOT = PIPELINE_DIR.parent
BUILD_DIR = PIPELINE_DIR / "build"
DATA_DIR = REPO_ROOT / "src" / "data"

CATALOG_FIELDS = [
    "id",
    "kind",
    "title",
    "provider",
    "url",
    "description",
    "skillsTaught",
    "skillsRequired",
    "difficulty",
    "durationHours",
    "format",
    "cost",
    "qualityPrior",
]

SPOTCHECK_SEED = 42
SPOTCHECK_FRACTION = 0.10


def load_items() -> list[dict]:
    items: list[dict] = []
    for path in sorted((PIPELINE_DIR / "sources").glob("*.json")):
        for item in json.loads(path.read_text()):
            item["_domain"] = path.stem
            items.append(item)
    return items


def validate_annotations(items: list[dict], skill_ids: set[str]) -> list[str]:
    errors: list[str] = []
    for item in items:
        iid = item["id"]
        if not isinstance(item.get("difficulty"), int) or not 1 <= item["difficulty"] <= 5:
            errors.append(f"{iid}: difficulty must be an int in 1-5")
        qp = item.get("qualityPrior")
        if not isinstance(qp, (int, float)) or not 0 <= qp <= 1:
            errors.append(f"{iid}: qualityPrior must be in [0, 1]")
        taught = item.get("skillsTaught", [])
        if not taught:
            errors.append(f"{iid}: skillsTaught must not be empty")
        for key in ("skillsTaught", "skillsRequired"):
            for ref in item.get(key, []):
                if ref.get("skillId") not in skill_ids:
                    errors.append(f"{iid}: {key} references unknown skill {ref.get('skillId')!r}")
                if ref.get("level") not in (1, 2, 3):
                    errors.append(f"{iid}: {key}.{ref.get('skillId')} level must be 1-3")
        taught_ids = [r["skillId"] for r in taught]
        if len(taught_ids) != len(set(taught_ids)):
            errors.append(f"{iid}: duplicate skillId in skillsTaught")
    return errors


def write_spotcheck(items: list[dict]) -> Path:
    rng = random.Random(SPOTCHECK_SEED)
    by_domain: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        by_domain[item["_domain"]].append(item)

    lines = [
        "# Catalog spot-check sample",
        "",
        f"Deterministic ~{int(SPOTCHECK_FRACTION * 100)}% sample per domain (seed {SPOTCHECK_SEED}).",
        "Review each item: real URL, sensible skills/levels, difficulty, duration, cost, quality prior.",
        "",
    ]
    for domain in sorted(by_domain):
        pool = by_domain[domain]
        k = max(2, round(len(pool) * SPOTCHECK_FRACTION))
        sample = rng.sample(sorted(pool, key=lambda i: i["id"]), k)
        lines.append(f"## {domain} ({k} of {len(pool)})")
        lines.append("")
        for item in sample:
            taught = ", ".join(f"{r['skillId']}:{r['level']}" for r in item["skillsTaught"])
            req = ", ".join(f"{r['skillId']}:{r['level']}" for r in item["skillsRequired"]) or "-"
            lines.append(f"- **{item['title']}** ({item['kind']}, {item['provider']})")
            lines.append(f"  - {item['url']}")
            lines.append(
                f"  - teaches: {taught} | requires: {req} | difficulty {item['difficulty']}/5, "
                f"{item['durationHours']}h, {item['format']}, {item['cost']}, quality {item['qualityPrior']}"
            )
        lines.append("")

    BUILD_DIR.mkdir(exist_ok=True)
    out = BUILD_DIR / "spotcheck.md"
    out.write_text("\n".join(lines))
    return out


def main() -> int:
    skills = json.loads((DATA_DIR / "skills.json").read_text())
    skill_ids = {s["id"] for s in skills}

    items = load_items()
    errors = validate_annotations(items, skill_ids)
    if errors:
        print("Annotation validation FAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    catalog = [{k: item[k] for k in CATALOG_FIELDS} for item in items]
    out = DATA_DIR / "catalog.json"
    out.write_text(json.dumps(catalog, indent=2) + "\n")
    print(f"Wrote {out.relative_to(REPO_ROOT)} ({len(catalog)} items)")

    spot = write_spotcheck(items)
    print(f"Wrote {spot.relative_to(REPO_ROOT)} for manual review")
    return 0


if __name__ == "__main__":
    sys.exit(main())
