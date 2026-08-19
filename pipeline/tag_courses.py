"""Course -> skill tagging for the Coursera evidence (Ring 1) -> pipeline/evidence/course_skill_tags.json.

Ring 1 is every course that appears in an edge of pipeline/evidence/edges_coursera_course.json.
For each course the model may only emit skill ids from src/data/skills.json (the closed
vocabulary is an enum in the output schema, the same mechanism as src/llm/mapGoal.ts), through
messages.parse() with a schema that mirrors the Zod CourseTag shape (ARCHITECTURE §4.3).

Two passes with different objectives, then a code-side guard:
  Pass A  "which skills does this course teach, at what level 1-3?"
  Pass B  given only the course text and A's list: "refute each claimed skill".
A tag survives only if B does not refute it. Confidence: "high" when B agrees with every
claim and level, "medium" when B keeps every skill but disagrees on a level, "low" when B
refutes anything (mandatory human check). Granularity guard: a course carrying a skill and one
of its direct prerequisites at the same level keeps the more specific one unless the course
text names both.

Inputs per course: name, institution, URL, and the public description + "skills you'll gain"
list read from the schema.org Course JSON-LD on the Coursera page (`fetch`; cached in
pipeline/build/coursera/descriptions.json, gitignored); name + institution only when the page
cannot be read. Model calls are cached under pipeline/build/coursera/tag_cache/ so re-emitting
never re-spends; token usage from every response is summed into the output.

Commands (repo root; ANTHROPIC_API_KEY from the environment or .env.local):
  python pipeline/tag_courses.py fetch                 # course pages -> descriptions.json (polite, cached)
  python pipeline/tag_courses.py tag [--workers 4]     # passes A+B+guard -> course_skill_tags.json
  python pipeline/tag_courses.py spotcheck             # stratified 20 % sample -> pipeline/build/spotcheck_v2.md
  python pipeline/tag_courses.py score PATH [PATH...]  # filled sheets -> agreement numbers (Jaccard, exact-level)
  python pipeline/tag_courses.py check-schema
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import os
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

PIPELINE_DIR = Path(__file__).parent
REPO_ROOT = PIPELINE_DIR.parent
DATA_DIR = REPO_ROOT / "src" / "data"
BUILD_DIR = PIPELINE_DIR / "build" / "coursera"
CACHE_DIR = BUILD_DIR / "tag_cache"
EVIDENCE_DIR = PIPELINE_DIR / "evidence"
EDGES_PATH = EVIDENCE_DIR / "edges_coursera_course.json"
CATALOG_MAP_PATH = PIPELINE_DIR / "sources" / "coursera_catalog_map.json"
DESCRIPTIONS_PATH = BUILD_DIR / "descriptions.json"
OUT_PATH = EVIDENCE_DIR / "course_skill_tags.json"
SPOTCHECK_PATH = BUILD_DIR / "spotcheck_v2.md"

MODEL = "claude-sonnet-5"
EFFORT = "low"
PROMPT_VERSION = "v2"
SPOTCHECK_SEED = 42
SPOTCHECK_FRACTION = 0.20
SPOTCHECK_OVERLAP = 8  # courses both humans tag, for the human-human number
GATES = {"humanModelJaccard": 0.85, "humanHumanJaccard": 0.90}
# Sonnet 5 list price (intro pricing through 2026-08-31), USD per million tokens
PRICE = {"input": 2.0, "output": 10.0, "cacheWrite": 2.5, "cacheRead": 0.2}
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


def load_json(p: Path):
    return json.loads(p.read_text())


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def load_api_key() -> str | None:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    env = REPO_ROOT / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def ring1() -> dict[str, dict]:
    return load_json(EDGES_PATH)["courses"]


# ---------------------------------------------------------------- fetch

def parse_course_page(text: str) -> dict | None:
    """schema.org Course JSON-LD first (full description + 'about' skills), then the meta description."""
    for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', text, re.S):
        try:
            doc = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        docs = doc if isinstance(doc, list) else [doc]
        for d in docs:
            if isinstance(d, dict) and d.get("@type") == "Course" and d.get("description"):
                about = d.get("about") or []
                return {"source": "coursera-jsonld", "description": html.unescape(d["description"]).strip(),
                        "skillsListed": [html.unescape(a) for a in about if isinstance(a, str)]}
    m = re.search(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', text)
    if m and not m.group(1).startswith("Choose from hundreds"):  # a browse-page redirect, not the course
        return {"source": "coursera-meta", "description": html.unescape(m.group(1)).strip(), "skillsListed": []}
    return None


def fetch(delay: float) -> int:
    import requests

    courses = ring1()
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    cache = load_json(DESCRIPTIONS_PATH) if DESCRIPTIONS_PATH.exists() else {}
    todo = [c for c in sorted(courses) if c not in cache]
    print(f"{len(courses)} Ring-1 courses, {len(cache)} cached, {len(todo)} to fetch")
    for i, cid in enumerate(todo, 1):
        url = courses[cid]["url"]
        entry = {"url": url, "source": "name-institution-only", "description": "", "skillsListed": []}
        try:
            r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
            entry["http"] = r.status_code
            if r.ok:
                parsed = parse_course_page(r.text)
                if parsed:
                    entry.update(parsed)
        except requests.RequestException as exc:
            entry["error"] = type(exc).__name__
        cache[cid] = entry
        DESCRIPTIONS_PATH.write_text(json.dumps(cache, indent=2, ensure_ascii=False, sort_keys=True) + "\n")
        print(f"  [{i}/{len(todo)}] {cid}: {entry['source']} ({entry.get('http', entry.get('error'))})")
        time.sleep(delay)
    from collections import Counter
    print("sources:", dict(Counter(e["source"] for e in cache.values())))
    return 0


# ---------------------------------------------------------------- vocabulary + schemas

def vocabulary() -> tuple[list[dict], dict[str, dict]]:
    skills = load_json(DATA_DIR / "skills.json")
    return skills, {s["id"]: s for s in skills}


def vocabulary_digest(skills: list[dict]) -> str:
    by_domain: dict[str, list[dict]] = {}
    for s in skills:
        by_domain.setdefault(s["domain"], []).append(s)
    lines = ["Skill vocabulary (id — name, level band 1=foundational 2=intermediate 3=advanced — description), grouped by domain:"]
    for domain in sorted(by_domain):
        lines.append(f"\n[{domain}]")
        for s in sorted(by_domain[domain], key=lambda x: x["id"]):
            lines.append(f"- {s['id']} — {s['name']}, band {s['levelBand']} — {s['description']}")
    return "\n".join(lines)


def build_models(skill_ids: list[str]):
    """Pydantic mirrors of the Zod shapes; the skill enum is the closed vocabulary."""
    from pydantic import BaseModel, Field

    SkillId = Literal[tuple(skill_ids)]  # type: ignore[valid-type]

    class TaughtSkill(BaseModel):
        skillId: SkillId  # type: ignore[valid-type]
        level: Literal[1, 2, 3]
        evidence: str = Field(description="the phrase or fact in the course text that shows this skill is taught, in ten words or fewer")

    class PassA(BaseModel):
        skillsTaught: list[TaughtSkill]

    class Verdict(BaseModel):
        skillId: SkillId  # type: ignore[valid-type]
        verdict: Literal["supported", "refuted"]
        levelAgrees: bool
        suggestedLevel: Literal[1, 2, 3]
        taughtInOwnRight: bool
        reason: str = Field(description="one sentence")

    class PassB(BaseModel):
        verdicts: list[Verdict]

    return PassA, PassB


PASS_A_SYSTEM = """You tag online courses with the skills they teach, using a closed skill vocabulary for a learning-path engine.

Rules:
- Emit only skills the course actually TEACHES: the learner comes out able to do them. Do not emit skills that are merely mentioned, assumed as prerequisites, used incidentally, or the general field a course belongs to.
- Level: 1 = introduces the basics, 2 = leaves the learner comfortable and productive, 3 = takes the learner to strong, advanced command. Most single MOOCs teach at level 1 or 2.
- Prefer the most specific skill in the vocabulary. Emit a broader skill in addition only when the course text explicitly covers it in its own right.
- Zero skills is a correct and common answer: many courses (psychology, nutrition, history, music, languages, finance, management) teach nothing in this vocabulary. Never stretch a course onto a skill because nothing else fits.
- Typical single course: 0-4 skills. Only broad multi-topic programmes reach 5 or more.
- The line "Skills the platform lists for it" is an auto-generated keyword list, not the syllabus: use it only to corroborate what the description or the course name says, never as the sole basis for a tag.
- The vocabulary below is complete; ids outside it are impossible.

"""

PASS_B_SYSTEM = """You audit skill tags proposed for an online course. You are given only the course text and a list of claimed (skill, level) tags. Your job is to REFUTE every claim you can.

For each claim decide:
- verdict "refuted" if the course text does not show the course teaching that skill (mentioned only, a prerequisite, a neighbouring topic, the general field rather than the skill, or a more specific vocabulary skill fits instead);
- verdict "supported" only if the text gives positive evidence the learner is taught it.
- levelAgrees / suggestedLevel: whether the claimed level (1 basics, 2 comfortable and productive, 3 strong advanced command) fits what the text supports, and the level you would give.
- taughtInOwnRight: true if the course teaches this skill as a subject of its own (a named topic, module or outcome); false if it is only implied by, assumed for, or a stepping stone towards another claimed skill.
- The line "Skills the platform lists for it" is an auto-generated keyword list, not the syllabus. A claim whose only support is that list is refuted; the description and the course name are the evidence.
Return exactly one verdict per claimed skill, no additions. Be strict: an over-tagged course does more harm to a learner's path than an under-tagged one.

"""


def course_text(cid: str, meta: dict, desc: dict | None) -> str:
    lines = [f"Course: {meta['name']}", f"Institution: {meta['institution']}", f"URL: {meta['url']}"]
    if desc and desc.get("description"):
        lines.append(f"Description: {desc['description']}")
    if desc and desc.get("skillsListed"):
        lines.append("Skills the platform lists for it: " + "; ".join(desc["skillsListed"]))
    if not (desc and desc.get("description")):
        lines.append("(No public description could be read; judge from the name and institution only.)")
    return "\n".join(lines)


# ---------------------------------------------------------------- model calls

class Tagger:
    def __init__(self, client, skills: list[dict]):
        self.client = client
        self.digest = vocabulary_digest(skills)
        self.PassA, self.PassB = build_models([s["id"] for s in skills])
        self.usage = {"calls": 0, "cached": 0, "input": 0, "output": 0, "cacheWrite": 0, "cacheRead": 0}
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _call(self, kind: str, system: str, user: str, model_cls) -> dict:
        key = sha256_text(json.dumps([PROMPT_VERSION, MODEL, EFFORT, kind, system, user]))
        path = CACHE_DIR / f"{key}.json"
        if path.exists():
            hit = load_json(path)
            self.usage["cached"] += 1
            return hit["parsed"]
        resp = self.client.messages.parse(
            model=MODEL,
            max_tokens=2048,
            system=[{"type": "text", "text": system + self.digest, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
            output_format=model_cls,
            output_config={"effort": EFFORT},
        )
        if resp.stop_reason == "refusal" or resp.parsed_output is None:
            raise RuntimeError(f"{kind}: no parsed output (stop_reason={resp.stop_reason})")
        parsed = resp.parsed_output.model_dump()
        u = resp.usage
        usage = {"input": u.input_tokens, "output": u.output_tokens,
                 "cacheWrite": u.cache_creation_input_tokens or 0, "cacheRead": u.cache_read_input_tokens or 0}
        path.write_text(json.dumps({"kind": kind, "model": resp.model, "usage": usage, "parsed": parsed}, indent=1) + "\n")
        self.usage["calls"] += 1
        for k, v in usage.items():
            self.usage[k] += v
        return parsed

    def tag(self, cid: str, text: str) -> dict:
        a = self._call("A", PASS_A_SYSTEM, text, self.PassA)
        claims = a["skillsTaught"]
        # dedupe A's claims on skillId (keep the first)
        seen, uniq = set(), []
        for c in claims:
            if c["skillId"] not in seen:
                seen.add(c["skillId"])
                uniq.append(c)
        claims = uniq
        if not claims:
            return {"a": [], "b": [], "survivors": [], "confidence": "high"}
        claim_lines = "\n".join(f"- {c['skillId']} at level {c['level']}" for c in claims)
        b = self._call("B", PASS_B_SYSTEM, f"{text}\n\nClaimed tags:\n{claim_lines}", self.PassB)
        verdicts = {v["skillId"]: v for v in b["verdicts"]}
        survivors, refuted, level_disagree = [], 0, 0
        for c in claims:
            v = verdicts.get(c["skillId"])
            if v is None or v["verdict"] == "refuted":
                refuted += 1  # a missing verdict counts as unconfirmed, i.e. dropped
                continue
            if not v["levelAgrees"]:
                level_disagree += 1
            survivors.append({"skillId": c["skillId"], "level": c["level"]})
        confidence = "low" if refuted else ("medium" if level_disagree else "high")
        own_right = {v["skillId"] for v in b["verdicts"] if v.get("taughtInOwnRight")}
        return {"a": claims, "b": b["verdicts"], "survivors": survivors, "confidence": confidence, "ownRight": sorted(own_right)}


GENERIC_SUFFIXES = ("fundamentals", "basics", "essentials", "foundations")


def skill_aliases(s: dict) -> list[str]:
    """Ways a course text names a skill: full name, name without a generic suffix, id with spaces."""
    name = re.sub(r"\s*\(.*?\)", "", s["name"].lower()).strip()
    out = {name, s["id"].replace("-", " ")}
    words = name.split()
    if len(words) > 1 and words[-1] in GENERIC_SUFFIXES:
        out.add(" ".join(words[:-1]))
    return sorted(a for a in out if a)


def granularity_guard(survivors: list[dict], text: str, by_id: dict[str, dict], own_right: set[str]) -> tuple[list[dict], list[dict]]:
    """A course carrying a skill and one of its direct prerequisites at the same level keeps the more
    specific one, unless the prerequisite is taught in its own right: named in the course text
    (name, name without a generic suffix, or id) or judged taughtInOwnRight by Pass B."""
    low = text.lower()

    def named(sid: str) -> bool:
        return sid in own_right or any(a in low for a in skill_aliases(by_id[sid]))

    levels = {s["skillId"]: s["level"] for s in survivors}
    dropped = []
    for s in list(survivors):
        for p in by_id[s["skillId"]]["prereqs"]:
            if p in levels and levels[p] == s["level"] and not named(p):
                dropped.append({"skillId": p, "level": levels[p], "keptInstead": s["skillId"]})
    drop_ids = {d["skillId"] for d in dropped}
    kept = [s for s in survivors if s["skillId"] not in drop_ids]
    # de-duplicate the dropped list (a prereq of two skills)
    uniq, seen = [], set()
    for d in dropped:
        if d["skillId"] not in seen:
            seen.add(d["skillId"])
            uniq.append(d)
    return kept, uniq


def cost_usd(usage: dict) -> float:
    return round(sum(usage[k] * PRICE[k] for k in PRICE) / 1e6, 4)


def tag(workers: int) -> int:
    import anthropic

    key = load_api_key()
    if not key:
        print("ANTHROPIC_API_KEY not set (environment or .env.local)")
        return 2
    if not DESCRIPTIONS_PATH.exists():
        print("run `fetch` first (pipeline/build/coursera/descriptions.json missing)")
        return 2
    client = anthropic.Anthropic(api_key=key)
    skills, by_id = vocabulary()
    courses = ring1()
    descs = load_json(DESCRIPTIONS_PATH)
    cmap = load_json(CATALOG_MAP_PATH)
    catalog_of = {r["courseId"]: r["catalogItemId"] for r in cmap["rows"]}
    tagger = Tagger(client, skills)
    ids = sorted(courses)
    texts = {cid: course_text(cid, courses[cid], descs.get(cid)) for cid in ids}

    def work(cid: str):
        for attempt in range(3):
            try:
                return cid, tagger.tag(cid, texts[cid])
            except anthropic.RateLimitError:
                time.sleep(10 * (attempt + 1))
            except (anthropic.APIConnectionError, anthropic.InternalServerError):
                time.sleep(3 * (attempt + 1))
        return cid, tagger.tag(cid, texts[cid])

    t0 = time.time()
    results: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for i, (cid, res) in enumerate(ex.map(work, ids), 1):
            results[cid] = res
            if i % 20 == 0 or i == len(ids):
                print(f"  {i}/{len(ids)} tagged ({tagger.usage['calls']} calls, {tagger.usage['cached']} cached)")

    tags = []
    stats = {"ring1Courses": len(ids), "coursesWithSkills": 0, "tagsTotal": 0, "byConfidence": {"high": 0, "medium": 0, "low": 0},
             "claimsPassA": 0, "refutedByPassB": 0, "guardDropped": 0, "descriptionSources": {}}
    for cid in ids:
        r = results[cid]
        kept, dropped = granularity_guard(r["survivors"], texts[cid], by_id, set(r.get("ownRight", [])))
        kept.sort(key=lambda s: s["skillId"])
        d = descs.get(cid) or {"source": "name-institution-only", "description": "", "skillsListed": []}
        stats["descriptionSources"][d["source"]] = stats["descriptionSources"].get(d["source"], 0) + 1
        stats["claimsPassA"] += len(r["a"])
        stats["refutedByPassB"] += len(r["a"]) - len(r["survivors"])
        stats["guardDropped"] += len(dropped)
        stats["tagsTotal"] += len(kept)
        stats["coursesWithSkills"] += bool(kept)
        stats["byConfidence"][r["confidence"]] += 1
        rec = {
            "courseId": cid,
            "name": courses[cid]["name"],
            "institution": courses[cid]["institution"],
            "url": courses[cid]["url"],
            "skillsTaught": kept,
            "confidence": r["confidence"],
            "spotChecked": False,
            "input": {"source": d["source"], "description": d.get("description", ""), "skillsListed": d.get("skillsListed", [])},
            "passes": {"a": r["a"], "b": r["b"], "guardDropped": dropped},
        }
        if cid in catalog_of:
            rec["catalogItemId"] = catalog_of[cid]
        tags.append(rec)

    usage = dict(tagger.usage)
    usage["estimatedUsd"] = cost_usd(usage)
    usage["priceUsdPerMTok"] = PRICE
    doc = {
        "source": "coursera",
        "model": MODEL,
        "effort": EFFORT,
        "promptVersion": PROMPT_VERSION,
        "method": "Pass A (skills taught + level) then Pass B (refute each claim) with the same closed vocabulary; a tag survives only if B does not refute it; "
                  "confidence high = B agrees on every skill and level, medium = every skill kept but a level disputed, low = a claim refuted; "
                  "granularity guard drops a direct prerequisite carried at the same level as its dependent unless the prerequisite is named in the course text or judged taught in its own right by Pass B",
        "vocabularySha256": sha256_file(DATA_DIR / "skills.json"),
        "inputs": {"edges_coursera_course.json": sha256_file(EDGES_PATH), "coursera_catalog_map.json": sha256_file(CATALOG_MAP_PATH),
                   "descriptions.json": sha256_file(DESCRIPTIONS_PATH)},
        "usage": usage,
        "stats": stats,
        "spotCheck": {"gates": GATES, "status": "pending", "sheet": "pipeline/build/spotcheck_v2.md (gitignored)"},
        "tags": tags,
    }
    dump(OUT_PATH, doc, "tags")
    print(f"wrote {OUT_PATH.relative_to(REPO_ROOT)}: {len(tags)} courses, {stats['tagsTotal']} tags, "
          f"confidence {stats['byConfidence']}, {time.time() - t0:.0f}s")
    print(f"usage: {json.dumps(usage)}")
    return 0


def dump(path: Path, obj: dict, list_key: str) -> None:
    head = {k: v for k, v in obj.items() if k != list_key}
    text = json.dumps(head, indent=2, sort_keys=True, ensure_ascii=False)
    assert text.endswith("\n}")
    lines = [json.dumps(item, sort_keys=True, ensure_ascii=False, separators=(",", ":")) for item in obj[list_key]]
    text = text[:-2] + f',\n  "{list_key}": [\n    ' + ",\n    ".join(lines) + "\n  ]\n}\n"
    path.write_text(text)


# ---------------------------------------------------------------- spot-check

def stratify(tags: list[dict]) -> list[dict]:
    """Deterministic stratified sample: strata = confidence x (has skills)."""
    rng = random.Random(SPOTCHECK_SEED)
    strata: dict[tuple, list[dict]] = {}
    for t in tags:
        strata.setdefault((t["confidence"], bool(t["skillsTaught"])), []).append(t)
    target = math.ceil(SPOTCHECK_FRACTION * len(tags))
    sample: list[dict] = []
    for key in sorted(strata):
        pool = sorted(strata[key], key=lambda t: t["courseId"])
        k = max(1, round(SPOTCHECK_FRACTION * len(pool)))
        sample.extend(rng.sample(pool, min(k, len(pool))))
    while len(sample) < target:
        rest = sorted([t for t in tags if t not in sample], key=lambda t: t["courseId"])
        sample.append(rng.choice(rest))
    return sample[:max(target, len(sample))]


def spotcheck() -> int:
    doc = load_json(OUT_PATH)
    tags = doc["tags"]
    sample = stratify(tags)
    rng = random.Random(SPOTCHECK_SEED + 1)
    order = sorted(sample, key=lambda t: t["courseId"])
    rng.shuffle(order)
    overlap = order[:SPOTCHECK_OVERLAP]
    rest = order[SPOTCHECK_OVERLAP:]
    half_a = rest[: len(rest) // 2] + overlap
    half_b = rest[len(rest) // 2:] + overlap
    rng.shuffle(half_a)
    rng.shuffle(half_b)
    manifest = {"sample": [t["courseId"] for t in order], "overlap": [t["courseId"] for t in overlap],
                "anmol": [t["courseId"] for t in half_a], "riyan": [t["courseId"] for t in half_b]}
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    (BUILD_DIR / "spotcheck_v2.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    def sheet(name: str, items: list[dict]) -> list[str]:
        L = [f"## Reviewer: {name} — {len(items)} courses", "",
             "For each course write your own tags on the `Your tags:` line BEFORE opening the fold: "
             "`skill-id:level` pairs separated by commas (levels 1 basics, 2 comfortable, 3 strong), or `none` if the course "
             "teaches nothing in the vocabulary. Ids must come from the vocabulary list at the end of this file.", ""]
        for t in items:
            L += [f"### {t['courseId']} — {t['name']} ({t['institution']})", "",
                  f"{t['url']}", "",
                  (t["input"]["description"] or "(no public description could be read)"), ""]
            if t["input"]["skillsListed"]:
                L += ["Platform-listed skills: " + "; ".join(t["input"]["skillsListed"]), ""]
            L += [f"Your tags ({name}): ", "",
                  "<details><summary>Model tags (open only after writing yours)</summary>", "",
                  "Model tags: " + (", ".join(f"{s['skillId']}:{s['level']}" for s in t["skillsTaught"]) or "none")
                  + f"  (confidence {t['confidence']})", "", "</details>", ""]
        return L

    skills, _ = vocabulary()
    L = ["# Coursera Ring-1 tagging — blind spot-check v2", "",
         f"Stratified {int(SPOTCHECK_FRACTION * 100)} % of Ring 1 ({len(sample)} of {len(tags)} courses; strata = confidence × has-skills), "
         f"split into two halves with {SPOTCHECK_OVERLAP} courses on both sheets so human–human agreement can be measured. "
         "Neither reviewer sees the other's sheet or the model's tags before writing their own.", "",
         "Scoring (`python pipeline/tag_courses.py score <this file>`): per course, Jaccard of the skill-id sets and exact-level "
         "agreement (skills tagged by both at the same level ÷ union); both are 1.0 when both sides say `none`. "
         f"Gates: mean human–model Jaccard ≥ {GATES['humanModelJaccard']:.2f}, mean human–human Jaccard ≥ {GATES['humanHumanJaccard']:.2f}.", ""]
    L += sheet("anmol", half_a)
    L += sheet("riyan", half_b)
    L += ["## Vocabulary", "", "```", vocabulary_digest(skills), "```", ""]
    SPOTCHECK_PATH.write_text("\n".join(L))
    print(f"wrote {SPOTCHECK_PATH.relative_to(REPO_ROOT)}: {len(sample)} courses (anmol {len(half_a)}, riyan {len(half_b)}, overlap {len(overlap)})")
    return 0


TAG_RE = re.compile(r"^Your tags \((\w+)\):\s*(.*)$")
HEAD_RE = re.compile(r"^### (\S+) — ")


def parse_sheet(path: Path) -> dict[str, dict[str, dict[str, int] | None]]:
    """-> {courseId: {reviewer: {skillId: level} | None(if blank)}}"""
    out: dict[str, dict] = {}
    cid = None
    for line in path.read_text().splitlines():
        m = HEAD_RE.match(line)
        if m:
            cid = m.group(1)
            out.setdefault(cid, {})
            continue
        m = TAG_RE.match(line)
        if m and cid:
            reviewer, raw = m.group(1), m.group(2).strip()
            if not raw:
                out[cid][reviewer] = None
                continue
            tags: dict[str, int] = {}
            if raw.lower() not in ("none", "-", "—"):
                for part in re.split(r"[,\s]+", raw):
                    if not part:
                        continue
                    sid, _, lvl = part.partition(":")
                    tags[sid.strip()] = int(lvl) if lvl.strip().isdigit() else 0
            out[cid][reviewer] = tags
    return out


def agreement(x: dict[str, int], y: dict[str, int]) -> tuple[float, float]:
    sx, sy = set(x), set(y)
    union = sx | sy
    if not union:
        return 1.0, 1.0
    jaccard = len(sx & sy) / len(union)
    exact = sum(1 for s in sx & sy if x[s] == y[s]) / len(union)
    return jaccard, exact


def score(paths: list[Path]) -> int:
    doc = load_json(OUT_PATH)
    model = {t["courseId"]: {s["skillId"]: s["level"] for s in t["skillsTaught"]} for t in doc["tags"]}
    _, by_id = vocabulary()
    human: dict[str, dict[str, dict]] = {}
    for p in paths:
        for cid, revs in parse_sheet(p).items():
            for r, tags in revs.items():
                if tags is not None:
                    human.setdefault(cid, {})[r] = tags
    unknown = sorted({s for revs in human.values() for t in revs.values() for s in t if s not in by_id})
    if unknown:
        print(f"WARNING unknown skill ids in human tags (they count as disagreements): {unknown}")
    hm: dict[str, list[tuple[float, float]]] = {}
    hh: list[tuple[str, float, float]] = []
    rows = []
    for cid, revs in sorted(human.items()):
        for r, t in revs.items():
            j, e = agreement(t, model[cid])
            hm.setdefault(r, []).append((j, e))
            rows.append((cid, r, "model", round(j, 2), round(e, 2), t, model[cid]))
        if len(revs) >= 2:
            (r1, t1), (r2, t2) = list(revs.items())[:2]
            j, e = agreement(t1, t2)
            hh.append((cid, j, e))
            rows.append((cid, r1, r2, round(j, 2), round(e, 2), t1, t2))
    print(f"filled human tags: {sum(len(v) for v in human.values())} course-reviews over {len(human)} courses")
    all_hm = [x for v in hm.values() for x in v]
    result = {}
    for r, v in sorted(hm.items()):
        result[f"humanModel.{r}"] = {"n": len(v), "jaccard": round(sum(j for j, _ in v) / len(v), 4), "exactLevel": round(sum(e for _, e in v) / len(v), 4)}
    if all_hm:
        result["humanModel.all"] = {"n": len(all_hm), "jaccard": round(sum(j for j, _ in all_hm) / len(all_hm), 4), "exactLevel": round(sum(e for _, e in all_hm) / len(all_hm), 4)}
    if hh:
        result["humanHuman"] = {"n": len(hh), "jaccard": round(sum(j for _, j, _ in hh) / len(hh), 4), "exactLevel": round(sum(e for _, _, e in hh) / len(hh), 4)}
    for k, v in result.items():
        print(f"{k}: {json.dumps(v)}")
    gate_hm = result.get("humanModel.all", {}).get("jaccard", 0) >= GATES["humanModelJaccard"]
    gate_hh = result.get("humanHuman", {}).get("jaccard", 0) >= GATES["humanHumanJaccard"] if hh else None
    print(f"gate human-model (>= {GATES['humanModelJaccard']}): {'PASS' if gate_hm else 'FAIL'}; "
          f"gate human-human (>= {GATES['humanHumanJaccard']}): {'PASS' if gate_hh else ('FAIL' if gate_hh is False else 'no overlap filled yet')}")
    print("\nper course (course, side1, side2, jaccard, exactLevel, side1 tags, side2 tags):")
    for row in rows:
        print("  ", row)
    (BUILD_DIR / "spotcheck_v2.score.json").write_text(json.dumps({"results": result, "gates": GATES, "rows": [list(map(str, r)) for r in rows]}, indent=2) + "\n")
    return 0


# ---------------------------------------------------------------- schema

def _require(cond: bool, msg: str, errors: list[str]) -> None:
    if not cond:
        errors.append(msg)


def check_schema() -> int:
    """Pipeline-side mirror of the CourseTag shape (ARCHITECTURE §4.3)."""
    errors: list[str] = []
    _, by_id = vocabulary()
    doc = load_json(OUT_PATH)
    for key in ("source", "model", "promptVersion", "method", "vocabularySha256", "inputs", "usage", "stats", "spotCheck", "tags"):
        _require(key in doc, f"course_skill_tags.json: missing {key}", errors)
    _require(doc.get("vocabularySha256") == sha256_file(DATA_DIR / "skills.json"), "course_skill_tags.json: vocabulary changed since tagging (re-run tag)", errors)
    ring = set(ring1())
    seen = set()
    catalog_ids = {c["id"] for c in load_json(DATA_DIR / "catalog.json")}
    for t in doc.get("tags", []):
        cid = t.get("courseId")
        _require(cid not in seen, f"duplicate course {cid}", errors)
        seen.add(cid)
        _require(cid in ring, f"{cid}: not a Ring-1 course", errors)
        for f in ("name", "institution", "url"):
            _require(isinstance(t.get(f), str) and t[f], f"{cid}: missing {f}", errors)
        _require(t.get("confidence") in ("high", "medium", "low"), f"{cid}: confidence", errors)
        _require(isinstance(t.get("spotChecked"), bool), f"{cid}: spotChecked", errors)
        if "catalogItemId" in t:
            _require(t["catalogItemId"] in catalog_ids, f"{cid}: unknown catalogItemId {t['catalogItemId']}", errors)
        sids = set()
        for s in t.get("skillsTaught", []):
            _require(s.get("skillId") in by_id, f"{cid}: unknown skill {s.get('skillId')}", errors)
            _require(s.get("level") in (1, 2, 3), f"{cid}: level {s.get('level')}", errors)
            _require(s.get("skillId") not in sids, f"{cid}: duplicate skill {s.get('skillId')}", errors)
            sids.add(s.get("skillId"))
    _require(seen == ring, f"tags cover {len(seen)} courses, Ring 1 has {len(ring)}", errors)
    if errors:
        print("check-schema FAILED:")
        for m in errors[:30]:
            print(f"  - {m}")
        return 1
    print(f"check-schema OK: {len(seen)} courses tagged, {sum(len(t['skillsTaught']) for t in doc['tags'])} tags")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch")
    f.add_argument("--delay", type=float, default=1.0)
    t = sub.add_parser("tag")
    t.add_argument("--workers", type=int, default=4)
    sub.add_parser("spotcheck")
    s = sub.add_parser("score")
    s.add_argument("paths", nargs="+", type=Path)
    sub.add_parser("check-schema")
    a = ap.parse_args()
    if a.cmd == "fetch":
        return fetch(a.delay)
    if a.cmd == "tag":
        return tag(a.workers)
    if a.cmd == "spotcheck":
        return spotcheck()
    if a.cmd == "score":
        return score(a.paths)
    return check_schema()


if __name__ == "__main__":
    sys.exit(main())
