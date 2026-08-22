#!/usr/bin/env bash
# One entry point for the whole offline pipeline:
#
#   curate -> annotate -> embed -> mine (SO, Coursera) -> tag -> pool -> merge -> validate
#
# Everything runs offline on the dev machine and writes committed JSON under
# src/data/ and pipeline/evidence/; nothing here runs at request time and nothing
# writes to src/data/ except through the same scripts a hand run would use.
#
# Stages whose raw inputs are absent are SKIPPED with a notice — their committed
# outputs stand. Raw inputs never enter the repo (pipeline/build/ is gitignored):
#
#   mine-so        needs pipeline/build/so/{skills,pairs,branches}.csv
#                  (from `python mine_so.py run --project <gcp-project>` on a
#                  machine with BigQuery access, plus the hand-run SEDE CSVs)
#   mine-coursera  needs pipeline/build/coursera/Coursera_{reviews,courses}.csv
#                  (the Kaggle corpus; ask for the local path, never commit it)
#   tag            needs pipeline/build/coursera/descriptions.json (from
#                  `python tag_courses.py fetch`) and ANTHROPIC_API_KEY in the
#                  environment or .env.local; model calls are cached under
#                  pipeline/build/coursera/tag_cache/ so re-runs do not re-spend
#
# Usage, from the repo root or from pipeline/:
#
#   pipeline/refresh.sh
#
# Exits non-zero on the first failing stage. A clean `git status` afterwards
# means the committed data already matched what the pipeline produces.

set -euo pipefail
cd "$(dirname "$0")"

PY=(uv run python)

STAGES=()
record() { STAGES+=("$(printf '%-14s %s' "$1" "$2")"); }

run_stage() {
  local name="$1"; shift
  echo
  echo "=== ${name}: $*"
  if "$@"; then
    record "${name}" "ran"
  else
    record "${name}" "FAILED"
    summary
    exit 1
  fi
}

skip_stage() {
  local name="$1" why="$2"
  echo
  echo "=== ${name}: SKIPPED — ${why}"
  record "${name}" "skipped (${why})"
}

summary() {
  echo
  echo "=== refresh summary"
  printf '  %s\n' "${STAGES[@]}"
}

have_api_key() {
  [[ -n "${ANTHROPIC_API_KEY:-}" ]] && return 0
  [[ -f ../.env.local ]] && grep -q '^ANTHROPIC_API_KEY=' ../.env.local
}

# 1–3. Catalog: assemble sources, validate annotations, embed.
run_stage "curate"   "${PY[@]}" curate.py
run_stage "annotate" "${PY[@]}" annotate.py
run_stage "embed"    "${PY[@]}" embed.py

# 4. Stack Overflow mining — emit from the BigQuery/SEDE result CSVs.
if [[ -f build/so/skills.csv && -f build/so/pairs.csv && -f build/so/branches.csv ]]; then
  run_stage "mine-so" "${PY[@]}" mine_so.py emit
else
  skip_stage "mine-so" "no BigQuery result CSVs in pipeline/build/so/; committed edges_so.json stands"
fi

# 5. Coursera review-order mining — needs the raw Kaggle CSVs.
if [[ -f build/coursera/Coursera_reviews.csv && -f build/coursera/Coursera_courses.csv ]]; then
  run_stage "mine-coursera" "${PY[@]}" mine_coursera.py run
else
  skip_stage "mine-coursera" "no Kaggle CSVs in pipeline/build/coursera/; committed edges_coursera_course.json stands"
fi

# 6. Ring-1 course tagging — needs the fetched descriptions and an API key;
#    apply-review re-applies the human spot-check resolutions after a re-tag.
if [[ ! -f build/coursera/descriptions.json ]]; then
  skip_stage "tag" "no descriptions cache (run tag_courses.py fetch); committed course_skill_tags.json stands"
elif ! have_api_key; then
  skip_stage "tag" "ANTHROPIC_API_KEY not set (environment or .env.local); committed course_skill_tags.json stands"
else
  run_stage "tag"          "${PY[@]}" tag_courses.py tag
  run_stage "apply-review" "${PY[@]}" tag_courses.py apply-review
fi

# 7–9. Pool, merge, validate — read committed files only, always run.
run_stage "pool"     "${PY[@]}" pool.py run
run_stage "merge"    "${PY[@]}" merge_edges.py run
run_stage "validate" "${PY[@]}" validate.py

summary
echo
echo "Done. Review with git diff; committed data is the source the app ships."
