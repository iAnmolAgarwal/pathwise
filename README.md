# Pathwise

AI-powered personalized learning path recommender. A deterministic knowledge-graph and
embedding engine decides what to learn and in what order; a conversational mentor built on
the Claude API elicits your goals and explains every recommendation from the engine's own
evidence.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Drizzle ORM + Neon
Postgres · Anthropic API · Vitest

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values.
3. `npm run db:migrate` to apply migrations to your Postgres database.
4. `npm run dev` and open http://localhost:3000

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres pooled connection string |
| `ANTHROPIC_API_KEY` | Anthropic API key for the mentor / LLM layer |

Both live in `.env.local` locally (gitignored) and in Vercel project env vars in
production. Neither is ever committed.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Vitest suite |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |

## Data pipeline

`pipeline/` is an offline Python (uv) pipeline; everything it produces is committed as small
JSON under `src/data/` and `pipeline/evidence/`, and nothing in it runs at request time.
`python pipeline/validate.py` re-checks the committed data and writes
`pipeline/validation-report.json`, which the Vitest suite pins, so `npm test` fails on drift.

The evidence stages run in this order (each is documented below; raw inputs never enter the
repo, and a stage whose raw inputs are absent is skipped — its committed outputs stand):

```
python pipeline/mine_so.py run --project <gcp-project> && python pipeline/mine_so.py emit   # Stack Overflow -> evidence/edges_so.json, branches_so.json
python pipeline/mine_coursera.py run     # Coursera -> evidence/edges_coursera_course.json, branches_coursera_course.json
python pipeline/tag_courses.py tag       # Ring-1 course -> skill tags -> evidence/course_skill_tags.json (gated, see below)
python pipeline/pool.py run              # course edges -> skill edges + branch shares -> evidence/edges_coursera.json, branches_coursera.json
python pipeline/merge_edges.py run       # authored ∪ mined -> src/data/skill_edges.json, branches.json, evidence/agreement_report.md
python pipeline/validate.py              # schema, DAG over path-driving edges, evidence integrity -> validation-report.json
```

**What the evidence says today** (`pipeline/evidence/agreement_report.md`, computed, not typed):
> Of the 193 authored prerequisite edges, 188 were observable in real learner sequences (Stack Overflow question order for 186, Coursera review order for 84); 39.4 % of the observable edges were confirmed by at least one source and 5.9 % by both; 6 contradictions were raised and 6 resolved; 0 novel edges were promoted after human review.

### Learner-sequence evidence — Stack Overflow

`pipeline/mine_so.py` mines the order in which real learners first asked about each skill on
Stack Overflow and writes `pipeline/evidence/edges_so.json` (directional pair counts per
skill pair: support, reverse, confidence, n) and `pipeline/evidence/branches_so.json`
("what did learners ask about next", as transition shares). Tags map to skills through the
hand-built `pipeline/sources/tag_skill_map.json`, which two people check row by row; no
language model is involved anywhere in this source. Cohort rule, in one sentence: for a pair
of skills (A, B) only users whose first-ever question came at least 12 months after both
technologies existed on the site are counted, so that "newer thing comes later" cannot pass
for "prerequisite". Every number carries the caveat that asking is not completing.

```
python pipeline/mine_so.py check --project <gcp-project>   # mirror reachability, MAX(creation_date), tag presence
python pipeline/mine_so.py run   --project <gcp-project>   # BigQuery: pairs / branches / skills -> pipeline/build/so/*.csv
python pipeline/mine_so.py render-sede                     # LLM-era top-up queries for the Stack Exchange Data Explorer
python pipeline/mine_so.py emit                            # CSVs -> pipeline/evidence/edges_so.json, branches_so.json, so_stats.md
```

The queries run against the BigQuery public mirror `bigquery-public-data.stackoverflow`
(the SQL is in `pipeline/sql/`); because that mirror ends in 2022, pairs involving LLM-era
skills are re-measured on current data with a Stack Exchange Data Explorer query over a 5 %
user sample, run by hand in the browser. Raw query results stay in the gitignored
`pipeline/build/`; only the aggregated files under `pipeline/evidence/` are committed, and
they are byte-identical for identical inputs.

Stack Overflow content is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
(see [Stack Overflow's licensing terms](https://stackoverflow.com/help/licensing)); Pathwise
publishes aggregate counts only, with attribution wherever they are shown.

### Learner-sequence evidence — Coursera

`pipeline/mine_coursera.py` reproduces Riyan Garg's review-order mining over the Kaggle
corpus [Course Reviews on Coursera](https://www.kaggle.com/datasets/imuhammad/course-reviews-on-coursera)
(imuhammad; 1.45 M reviews of 623 courses, 2015–2020, CC0). Each reviewer display name is a
pseudo-learner and the order of their reviews stands in for the order they took the courses:
literal duplicate rows are dropped (the scrape repeats most reviews two to five times), the
placeholder "By Deleted A" is dropped, names with 2–15 distinct reviews are kept, and per name
every ordered pair of distinct courses is counted once by first review date (same-day pairs
carry no order and are dropped). A course pair becomes an edge at support ≥ 20 and
confidence = AB/(AB+BA) ≥ 0.85 — his own recommended floor, after his 0.70 run kept
cross-topic coincidences. The run recomputes his published 0.70 baseline from the same rows
(it reproduces exactly) so the cost of the higher floor is visible in
`pipeline/evidence/coursera_stats.md`, and asserts that his four within-specialization
chains survive and his three cross-topic chains do not.

```
mkdir -p pipeline/build/coursera && cd pipeline/build/coursera
curl -L -o coursera.zip https://www.kaggle.com/api/v1/datasets/download/imuhammad/course-reviews-on-coursera
unzip coursera.zip && rm coursera.zip && cd ../../..     # Coursera_reviews.csv, Coursera_courses.csv (gitignored)
python pipeline/mine_coursera.py run                    # -> pipeline/evidence/edges_coursera_course.json, coursera_stats.md
```

One streaming pass, ~8 s and ~450 MB peak memory on an 8 GB laptop; review text is hashed
for the duplicate check and never leaves `pipeline/build/`. The output is course-level
(`fromCourseId → toCourseId` with support, reverse, n, confidence) and byte-identical for
identical inputs; the caveat "sequences reconstructed from review order; pseudo-users by
reviewer name" travels with every number.

### Course → skill tags — Coursera Ring 1

Course-level edges only become skill evidence through a course → skill table, so that table is
made inspectable. `pipeline/tag_courses.py` tags Ring 1 (every course in a mined edge) with
skills from the closed vocabulary in `src/data/skills.json` — the skill id is an enum in the
structured-output schema, the same mechanism the app's goal mapper uses — using
`claude-sonnet-5` at low effort in two passes with different objectives: pass A names the
skills a course teaches and at what level, pass B sees only the course text and A's list and
tries to refute each claim. A tag survives only if B does not refute it; any disagreement marks
the course `low` confidence for a mandatory human look. A granularity guard then drops a
direct prerequisite carried at the same level as its dependent unless the course text names it
or B judged it taught in its own right. Inputs are the course name, institution, URL and the
public description read from the Coursera page (name and institution alone when the page is
gone). Model calls are cached under `pipeline/build/`, token usage is summed into the output,
and `pipeline/sources/coursera_catalog_map.json` (hand-built) links each mined course to the
catalog item it belongs to.

```
python pipeline/tag_courses.py fetch       # course pages -> pipeline/build/coursera/descriptions.json
python pipeline/tag_courses.py tag         # two passes + guard -> pipeline/evidence/course_skill_tags.json
python pipeline/tag_courses.py spotcheck   # stratified 20 % blind sample -> pipeline/build/spotcheck_v2.md
python pipeline/tag_courses.py score pipeline/build/spotcheck_v2.md   # Jaccard + exact-level agreement vs the gates
```

The tags are gated, not assumed. A stratified 20 % sample of Ring 1 is checked blind against
the pipeline's tags and the file ships only if reviewer–model skill-set agreement (mean
Jaccard) is ≥ 0.85; below the gate the inputs, prompts or guard are fixed and the ring is
re-run and re-sampled (the first run failed at 0.80 on truncated descriptions and was re-run
on the full course pages). For the shipped file the check was done by one reviewer with an
independent, context-free model pass as a second opinion (`pipeline/sources/coursera_tag_resolutions.json`
records every adjudication); the file states that process and its numbers in its `spotCheck`
block — it does not claim a two-person human check.

### Pooling and merge — the tiered skill graph

`pipeline/pool.py` lifts the Coursera course edges to skill level through the Ring-1 tags: a
course edge pools onto every (skill taught by the from-course, skill taught by the to-course)
pair, both orientations are combined, and each pooled edge keeps support, reverse, confidence,
the number of distinct course pairs behind it and the top-5 course pairs. Its first output is
the measured histogram `pipeline/evidence/pooled_support_histogram.md`; pairs outside the
authored prerequisite closure are listed in `cross_domain_candidates.md` rather than dropped.
Course-level immediate-successor counts lift the same way into transition shares
(`branches_coursera.json`), under the same floors as the Stack Overflow branches (listed at
n ≥ 5, `minSupportMet` at nTotal ≥ 50, shrunk with α = 20).

`pipeline/merge_edges.py` annotates every authored edge (`skills.json.prereqs`) with each
source's numbers and gives it a status — `confirmed-both`, `confirmed-one-source`,
`contradicted-in-review` (a source shows the opposite direction at confidence ≥ 0.85, n ≥ 50)
or `no-data` — and writes every mined pair with no authored counterpart as a `candidate`
(`drivesPath: false`). Authored edges drive paths; evidence annotates them; nothing automatic
flips, removes or promotes an edge. Humans record decisions in
`pipeline/sources/evidence_resolutions.json`; `contradictions.md` and `promotions.md` are
rendered from the queues plus those decisions, and a recorded promotion is applied only if the
edge still meets the thresholds, keeps level bands monotone and keeps the path-driving graph
acyclic (the merge refuses otherwise). Outputs: `src/data/skill_edges.json`,
`src/data/branches.json`, `pipeline/evidence/agreement_report.md/.json`.

## Data sources and attribution

- **Stack Overflow** question metadata via the BigQuery public dataset (`bigquery-public-data.stackoverflow`) and the Stack Exchange Data Explorer, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — Pathwise publishes aggregate counts only, with this attribution wherever they are shown.
- **Coursera** review order from the Kaggle dataset [Course Reviews on Coursera](https://www.kaggle.com/datasets/imuhammad/course-reviews-on-coursera) (imuhammad), CC0 — only review order is used; review text never leaves the gitignored build directory.
- The learner-sequence mining method, its measured validation (successes and failures shown side by side) and the "neither graph is strictly superior — use both and say which" conclusion are **Riyan Garg's**; Pathwise reproduces his method in the repository and credits it wherever the Coursera numbers appear.
- Catalog items link to their original providers (Coursera, edX, freeCodeCamp, Kaggle, official documentation, YouTube); Pathwise stores titles, URLs and its own annotations, never course content.
