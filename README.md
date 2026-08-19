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
