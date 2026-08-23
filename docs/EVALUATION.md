# Evaluation

Pathwise makes three claims that can be measured without users: that the order it puts
skills in matches the order real learners took them, that the embedding model behind its
similarity signal retrieves the right skills for a catalog item, and that the narrated
explanation of a path item says nothing the underlying evidence does not. Each claim has a
script under `pipeline/evaluate/`, each script writes its result under `pipeline/evidence/`,
and the numbers below are copied from those files. A fourth section measures how much the
engine's scoring weights matter, for the same reason. Nothing here is trained; no number is
quoted that a script did not produce.

All three start from the same corpus of generated paths: the five fixture learners the test
suite pins, plus every one of the 15 goal templates under three canonical profiles — *empty*
(no skills, 6 h/week, standard pace), *partial* (holds the foundations of the goal's
prerequisite closure at level 2 and the next tier at level 1) and *time-poor* (no skills,
3 h/week, intense pace) — 50 paths in all, produced by `pipeline/evaluate/dump_paths.ts`,
which runs the engine exactly as the product does.

## 1. Sequencing agreement

**Method.** For each of the 50 paths, every ordered pair of taught skills is a sequencing
decision: skill A's first teaching item precedes skill B's first teaching item (assessments
do not teach, and an item teaches a skill only above the level the learner already holds).
That gives 2,732 unique ordered pairs (6,587 occurrences across paths). Each pair is looked
up in the learner-sequence evidence: Stack Overflow question order (the date of a user's
first question per skill, users who started after both technologies existed) and Coursera
review order (review sequence per pseudo-user, 2015–2020). Where a source observed the pair
with n ≥ 20 and a strict majority, the engine's order is checked against the observed
majority direction. Every pair is also classed by its relation to the prerequisite graph:
*authored edge* (A → B is an authored prerequisite), *graph-derived* (A is a transitive
prerequisite of B, so the graph forced the order), *graph-inverted* (the graph says B before
A, yet the engine taught A first) and *unrelated* (no graph relation either way; the order
came from scoring and phasing).

**Result** (`pipeline/evidence/eval_sequencing_agreement.md`):

| Source | Pairs observed (n ≥ 20) | Agreement | Authored edges | Graph-derived | Graph-inverted | Unrelated |
|---|---|---|---|---|---|---|
| Stack Overflow question order | 2,265 | **65.4 %** | 95 / 112 (84.8 %) | 167 / 174 (96.0 %) | 4 / 27 (14.8 %) | 1,215 / 1,952 (62.2 %) |
| Coursera review order | 400 | **61.8 %** | 29 / 36 (80.6 %) | 33 / 41 (80.5 %) | 3 / 11 (27.3 %) | 182 / 312 (58.3 %) |

Two further views of the same pairs: restricted to pairs that cross a phase boundary (the
order a learner actually experiences as "later"), agreement is 72.1 % on Stack Overflow
(1,522 pairs) and 65.9 % on Coursera (226); restricted to the pairs the sources are surest
about (n ≥ 50 and a majority of at least 70 %), it is 78.3 % on Stack Overflow (474 pairs)
and 61.2 % on Coursera (281).

**Reading it.** Where the engine's order comes from a prerequisite claim — an authored edge
or anything derived from one — learners agree with it 85–96 % of the time on Stack Overflow
and 80–81 % on Coursera. Where the engine had no prerequisite reason for an order (the
*unrelated* column, more than four fifths of all observed pairs), agreement drops to 62 % and 58 %:
that order comes from scores and time budget, not from a claim about what comes first, and
the learner data says it is a little better than a coin toss. The disagreeing prerequisite
pairs are listed in full in the report; the largest are *Networking & How the Web Works →
Working with APIs* (Stack Overflow saw 41 % in that order, n = 15,008), *Modern JavaScript →
Node.js* (35 %, n = 14,683) and *Statistics Fundamentals → R Programming* (14 %, n = 5,539) —
pairs where the order people first ask about things may simply differ from the order a
curriculum teaches them, and which are now candidates for an authoring review. On Coursera,
*Model Evaluation → Neural Networks* (8 %, n = 5,317) and *SQL → Python* (8 %, n = 2,276)
disagree hardest: reviewers overwhelmingly reached the neural-network and Python courses
first — orders that came from scoring, not from any prerequisite claim.

The *graph-inverted* column is a finding about the engine rather than about learners: in 35
of 2,732 pairs the engine taught a skill before one of its own prerequisites — almost always a
phase project or a broad course that touches a skill at level 1 before the course that
teaches its prerequisite arrives in a later phase (for example *Cloud Architecture* before
*AWS Fundamentals* in five paths), plus cycle-broken soft edges. Learners side with the
graph in those cases (4 of 27 and 3 of 11 agree with the engine), which is the direction
the fix should take.

**The confound, stated.** The engine's order is partly *derived* from the authored graph, and
that same graph is what the sources were checked against when the evidence was merged; high
agreement on authored and graph-derived pairs therefore partly re-measures the agreement
report, not an independent fact about the engine. The *unrelated* column is the only one
free of that circularity, and it is the weakest. A source's majority direction is also an
order of asking or reviewing, not of mastering — the caveat that travels with every number in
the product applies here too.

## 2. Embedding bake-off

**Method.** The engine's similarity signal is a cosine between a catalog item's text
("title. description") and a skill's text ("name. description"), both encoded offline by
`pipeline/embed.py`. Ground truth for the bake-off is each item's annotated `skillsTaught`
(model-annotated, human spot-checked, 370 items over 159 skills). For every item, all 159
skills are ranked by cosine to the item; P@1, P@3 and MRR of the first correct skill are
averaged over items. Because 135 of the 370 items teach a single skill and 260 teach at most
two, P@3 cannot reach 1.0 — its ceiling, the mean best achievable P@3, is 0.644. Five models
ran locally on Apple silicon (MPS); `nomic-embed-text-v1.5` received its required
`search_query:` / `search_document:` prefixes, the others plain text. Each candidate is
compared to the shipped baseline with a paired bootstrap over items (2,000 resamples); a
candidate is "clearly better" only if every metric's 95 % interval lies above zero.

**Result** (`pipeline/evidence/eval_embedding_bakeoff.md`):

| Model | Dim | P@1 | P@3 (ceiling 0.644) | MRR | Δ vs shipped: P@1 · P@3 · MRR (95 % interval) |
|---|---|---|---|---|---|
| all-MiniLM-L6-v2 (shipped) | 384 | 0.776 | 0.419 | 0.857 | — |
| BAAI/bge-small-en-v1.5 | 384 | 0.757 | 0.408 | 0.838 | −0.019 [−0.059, +0.022] · −0.011 [−0.030, +0.008] · −0.018 [−0.044, +0.007] |
| BAAI/bge-base-en-v1.5 | 768 | 0.795 | 0.420 | 0.859 | +0.019 [−0.013, +0.051] · +0.001 [−0.018, +0.019] · +0.002 [−0.020, +0.024] |
| thenlper/gte-base | 768 | **0.803** | **0.431** | **0.874** | +0.027 [−0.008, +0.065] · +0.013 [−0.004, +0.029] · +0.017 [−0.004, +0.038] |
| nomic-ai/nomic-embed-text-v1.5 | 768 | 0.741 | 0.385 | 0.826 | −0.035 [−0.073, +0.003] · −0.034 [−0.052, −0.016] · −0.031 [−0.055, −0.005] |

By item kind the ranking is stable: courses are easy (MiniLM P@1 0.827, gte-base 0.850),
projects and assessments are hard for every model (P@1 0.44–0.63), because their text
describes a task rather than a topic.

**Decision.** `gte-base` leads on all three metrics, but by +0.027 / +0.013 / +0.017 with
every interval straddling zero — ten more items right at rank 1 out of 370, at twice the
vector size. That is not "clearly better", so the shipped model stays `all-MiniLM-L6-v2` and
the table is the result. The rule that would change it — all three intervals above zero, and
a reviewed diff of every fixture path the swap would alter — is in the script.

## 3. Narration groundedness

**Method.** The product renders an explanation twice: as a structural evidence object built
by the engine, and as a short narration written by the model from nothing but that object and
a one-paragraph profile summary. The claim is that the narration adds no facts. To measure
it, 60 evidence objects are drawn from the corpus (one from each of the 50 paths plus two
more from each fixture path; seeded, so the sample is fixed): 46 courses, 9 projects,
5 assessments; 27 carry learner-sequence links and 26 a "what learners did next" share.
Each is narrated exactly as `POST /api/explain` narrates it — `pipeline/evaluate/narrate.ts`
calls the same function with the same prompt, model (`claude-sonnet-5`) and effort (low).
A second pass with a different objective then reads the profile summary, the evidence object
and the narration and lists every factual claim not traceable to a field of either input
(paraphrase, arithmetic over fields and a direct qualitative reading of a field count as
traceable; encouragement and framing are not claims), classing each flag as an
*invented fact* (absent from every input), a *misstated field* (present but misquoted or
misread) or an *interpretive gloss* (a qualitative reading beyond what a field says, without
a new fact). The checker runs at medium effort with structured output, and every flagged
sentence is listed in the report.

**Result** (`pipeline/evidence/eval_narration_groundedness.md`):

| Metric | Value |
|---|---|
| Narrations | 60 (mean 127 words, 273 sentences) |
| Narrations with at least one unsupported claim | **37 (61.7 %)** |
| — with an invented fact or a misstated field | **15 (25.0 %)** |
| Unsupported claims | 60 — 11 invented facts, 7 misstated fields, 42 interpretive glosses |
| Unsupported claims per 100 sentences | 22.0 |
| Narrations that cite learner numbers | 37, of which 21 flagged (one misstatement of a number) |
| Cost | narration 59,324 in / 15,133 out ($0.27); checker 54,414 in / 67,409 out, 75,516 cached reads ($0.80) — about $1.07 for the pass |

**Reading it.** Strict by construction, the checker flags three narrations in five, but the
flags sort cleanly. Seven in ten are interpretive glosses: a quality score of 0.8 narrated
as "a well-regarded resource", an empty `sequencedAfter` as "foundational", a difficulty of 3
as "a deeper level". Those are tone, and whether they count as claims is a judgement the
report leaves to the reader by listing them. The quarter that matters is the 15 narrations
with an invented fact or a misstated field: "level fit is good, meaning the difficulty
matches where you're at" for a learner whose profile records no skills (flagged as an invented
fact twice and as a gloss eight more times — the single most common flag); "hands-on practice" for an assessment whose evidence carries no
format; a sequencing reason the evidence does not give ("REST API Design naturally leads into
Caching"); and one genuine number error, "94 out of 913 pseudo-users" where the evidence said
94 % of 913. The learner-sequence numbers themselves — the counts, shares and source names
the product lets the narrator cite — were reproduced correctly in 36 of the 37 narrations that
used them. The concrete follow-up is a prompt clause, not a model change: do not describe a
level fit when the profile records no skills, and never turn a score into a reputation.

## 4. Weight sensitivity

**Why.** The five scoring weights (§5.2 of the architecture: coverage 0.40, level fit 0.15,
preference fit 0.15, quality 0.10, similarity 0.20) were set by judgement, not tuned. This
study does not tune them either; it measures how much each one matters, so a reader knows
whether the paths above are a property of the engine or of one particular setting.

**Method.** `pipeline/evaluate/weight_sensitivity.ts` takes the 66-learner corpus the
property tests sweep — the five fixture learners plus every goal template under four learner
shapes and one two-goal learner — generates every path at the committed weights (982 path
items), then moves one weight at a time by ±25 % and regenerates. For each perturbation it
counts learners whose path changed at all, items added and removed (as a share of the 982),
learners whose shared items came out in a different order, and phase-order flips (the same
phase titles in a different sequence). The weights are passed into the engine as an option;
the product never sets it.

**Result** (`pipeline/evidence/weight_sensitivity.json`):

| axis | Δ | learners changed | items added | items removed | items changed (% of 982) | learners reordered | phase-order flips |
|---|---|---|---|---|---|---|---|
| coverage | +25 % | 7/66 | 6 | 6 | 12 (1.22 %) | 4 | 0 |
| coverage | −25 % | 12/66 | 30 | 18 | 48 (4.89 %) | 8 | 0 |
| levelFit | +25 % | 17/66 | 21 | 18 | 39 (3.97 %) | 4 | 0 |
| levelFit | −25 % | 17/66 | 19 | 18 | 37 (3.77 %) | 2 | 0 |
| preferenceFit | +25 % | 2/66 | 11 | 7 | 18 (1.83 %) | 1 | 0 |
| preferenceFit | −25 % | 5/66 | 4 | 3 | 7 (0.71 %) | 3 | 0 |
| quality | +25 % | 7/66 | 6 | 7 | 13 (1.32 %) | 1 | 0 |
| quality | −25 % | 8/66 | 11 | 10 | 21 (2.14 %) | 1 | 0 |
| similarity | +25 % | 10/66 | 22 | 16 | 38 (3.87 %) | 4 | 0 |
| similarity | −25 % | 16/66 | 19 | 17 | 36 (3.67 %) | 6 | 0 |

No learner's phase order flips under any perturbation — fixture or sweep. Among the five
fixtures the changes are single-item substitutions between resources of similar size and
level (a practice set for a practice set, one SQL course for another) and a handful of
same-phase order inversions; no fixture gains or loses more than one item under any axis.

**Reading it.** Coverage and level fit are the most sensitive axes and preference fit the
least; at ±25 % no axis moves more than 4.9 % of items and no learner's phase order changes.
Most of what a path contains is decided by the gap and the prerequisite graph before the weights
break ties among courses that cover the same skills — which is the intended division of
labour (§5.1–5.3). The weights are not changed on the strength of this; the study is an
input to any future change, and its numbers are what the documentation quotes.

## Limitations

- **No users.** Pathwise has had no learners at the time of writing. Nothing here measures
  whether a generated path helped anyone; the sequencing measurement compares to what other
  platforms' learners did, not to what Pathwise's learners will do.
- **No A/B.** There is one engine, one prompt and one embedding model in production; the
  bake-off compares models offline, and the groundedness sample measures one prompt.
- **The sequencing confound.** The engine's order and the evidence it is compared to share
  the authored graph (see section 1). The unrelated-pairs column is the independent part, and
  it is the weakest.
- **Sources measure asking and reviewing, not mastery.** Every Stack Overflow and Coursera
  number carries that caveat in the product, and it applies to every number above.
- **Ground truth for the bake-off is itself annotated by a model** and spot-checked by
  people; the bake-off measures agreement with those annotations, not with an oracle.
- **The groundedness checker is itself a model**; its flags are listed in full so they can be
  read, and it is held to a fixed prompt and effort so the rate is comparable across runs.

## Reproducing

```
npm exec -- tsx pipeline/evaluate/dump_paths.ts --out pipeline/build/evaluate/paths.json   # the 50-path corpus (the scripts run this themselves)
python pipeline/evaluate/sequencing_agreement.py
python pipeline/evaluate/embedding_bakeoff.py
python pipeline/evaluate/narration_groundedness.py   # needs ANTHROPIC_API_KEY; model calls are cached under pipeline/build/
npm exec -- tsx pipeline/evaluate/weight_sensitivity.ts --out pipeline/evidence/weight_sensitivity.json --md
```
