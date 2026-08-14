"""Assemble and sanity-check the raw catalog from per-domain source files.

Reads pipeline/sources/*.json (hand-curated per-domain item lists), validates the
raw (non-taxonomy) fields, and writes pipeline/build/catalog.raw.json.

Usage:
    uv run python curate.py              # validate + assemble
    uv run python curate.py --check-urls # additionally verify every URL is reachable

URL checking notes: some providers block scripted requests (403/405/999); those are
reported as "blocked" and treated as reachable-unknown rather than broken. YouTube
returns 200 for any video id, so video URLs are verified via the oembed endpoint,
which 404s for nonexistent videos.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
SOURCES_DIR = PIPELINE_DIR / "sources"
BUILD_DIR = PIPELINE_DIR / "build"

KINDS = {"course", "project", "assessment"}
FORMATS = {"video", "interactive", "text", "project"}
COSTS = {"free", "freemium", "paid"}

RAW_FIELDS = [
    "id",
    "kind",
    "title",
    "provider",
    "url",
    "description",
    "durationHours",
    "format",
    "cost",
]


def load_sources() -> list[dict]:
    items: list[dict] = []
    for path in sorted(SOURCES_DIR.glob("*.json")):
        domain = path.stem
        for item in json.loads(path.read_text()):
            item["_domain"] = domain
            items.append(item)
    return items


def validate_raw(items: list[dict]) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    seen_urls: dict[str, str] = {}
    for item in items:
        iid = item.get("id", "<missing id>")
        for field in RAW_FIELDS:
            if not item.get(field):
                errors.append(f"{iid}: missing or empty field '{field}'")
        if iid in seen:
            errors.append(f"{iid}: duplicate id")
        seen.add(iid)
        url = item.get("url", "")
        if url in seen_urls and seen_urls[url] != iid:
            errors.append(f"{iid}: url duplicates {seen_urls[url]} ({url})")
        seen_urls.setdefault(url, iid)
        if item.get("kind") not in KINDS:
            errors.append(f"{iid}: bad kind {item.get('kind')!r}")
        if item.get("format") not in FORMATS:
            errors.append(f"{iid}: bad format {item.get('format')!r}")
        if item.get("cost") not in COSTS:
            errors.append(f"{iid}: bad cost {item.get('cost')!r}")
        if not isinstance(item.get("durationHours"), (int, float)) or item["durationHours"] <= 0:
            errors.append(f"{iid}: durationHours must be a positive number")
        if not str(url).startswith(("http://", "https://")):
            errors.append(f"{iid}: url must be http(s): {url}")
    return errors


def check_urls(items: list[dict]) -> list[str]:
    import requests

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }
    broken: list[str] = []
    blocked = 0
    for n, item in enumerate(items, 1):
        url = item["url"]
        target = url
        if "youtube.com/watch" in url:
            target = f"https://www.youtube.com/oembed?url={url}&format=json"
        try:
            resp = requests.get(target, headers=headers, timeout=15, stream=True)
            status = resp.status_code
            resp.close()
        except requests.exceptions.SSLError:
            # Some sites fail local cert-chain verification while being fine in
            # browsers; confirm the host responds at all and classify as blocked.
            try:
                resp = requests.get(target, headers=headers, timeout=15, stream=True, verify=False)
                resp.close()
                blocked += 1
                print(f"  [blocked ssl-unverified] {item['id']}: {url}")
            except requests.RequestException as exc:
                broken.append(f"{item['id']}: {url} -> {type(exc).__name__}")
            continue
        except requests.RequestException as exc:
            broken.append(f"{item['id']}: {url} -> {type(exc).__name__}")
            continue
        if status in (403, 405, 429, 999):
            blocked += 1
            print(f"  [blocked {status}] {item['id']}: {url}")
        elif status >= 400:
            broken.append(f"{item['id']}: {url} -> HTTP {status}")
        if n % 40 == 0:
            print(f"  ...checked {n}/{len(items)}")
    print(f"URL check: {len(items)} checked, {blocked} blocked (assumed ok), {len(broken)} broken")
    return broken


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-urls", action="store_true", help="verify every URL responds")
    args = parser.parse_args()

    items = load_sources()
    errors = validate_raw(items)
    if errors:
        print("Raw validation FAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    kinds = Counter(i["kind"] for i in items)
    domains = Counter(i["_domain"] for i in items)
    print(f"Loaded {len(items)} items: {dict(kinds)}")
    print(f"Per domain: {dict(sorted(domains.items()))}")

    if args.check_urls:
        broken = check_urls(items)
        if broken:
            print("Broken URLs:")
            for b in broken:
                print(f"  - {b}")
            return 1

    BUILD_DIR.mkdir(exist_ok=True)
    raw = [{k: item[k] for k in RAW_FIELDS} | {"domain": item["_domain"]} for item in items]
    out = BUILD_DIR / "catalog.raw.json"
    out.write_text(json.dumps(raw, indent=2) + "\n")
    print(f"Wrote {out.relative_to(PIPELINE_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
