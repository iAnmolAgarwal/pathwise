# Evaluation

Pathwise makes three claims that can be measured without users: that the order it puts
skills in matches the order real learners took them, that the embedding model behind its
similarity signal retrieves the right skills for a catalog item, and that the narrated
explanation of a path item says nothing the underlying evidence does not. Each claim has a
script under `pipeline/evaluate/`, each script writes its result under `pipeline/evidence/`,
and the numbers below are copied from those files. Nothing here is trained; no number is
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
That gives 2,451 unique ordered pairs (6,164 occurrences across paths). Each pair is looked
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
| Stack Overflow question order | 1,934 | **68.5 %** | 83 / 97 (85.6 %) | 154 / 161 (95.7 %) | 3 / 10 (30.0 %) | 1,085 / 1,666 (65.1 %) |
| Coursera review order | 329 | **62.9 %** | 26 / 30 (86.7 %) | 31 / 39 (79.5 %) | 1 / 9 (11.1 %) | 149 / 251 (59.4 %) |

Two further views of the same pairs: restricted to pairs that cross a phase boundary (the
order a learner actually experiences as "later"), agreement is 74.6 % on Stack Overflow
(1,301 pairs) and 57.1 % on Coursera (191); restricted to the pairs the sources are surest
about (n ≥ 50 and a majority of at least 70 %), it is 83.5 % on Stack Overflow (407 pairs)
and 65.8 % on Coursera (228).

**Reading it.** Where the engine's order comes from a prerequisite claim — an authored edge
or anything derived from one — learners agree with it 86–96 % of the time on Stack Overflow
and 80–87 % on Coursera. Where the engine had no prerequisite reason for an order (the
*unrelated* column, four fifths of all observed pairs), agreement drops to 65 % and 59 %:
that order comes from scores and time budget, not from a claim about what comes first, and
the learner data says it is a little better than a coin toss. The disagreeing prerequisite
pairs are listed in full in the report; the largest are *Networking & How the Web Works →
Working with APIs* (Stack Overflow saw 40 % in that order, n = 15,008), *Modern JavaScript →
Node.js* (34 %, n = 14,683) and *Statistics Fundamentals → R Programming* (13 %, n = 5,539) —
pairs where the order people first ask about things may simply differ from the order a
curriculum teaches them, and which are now candidates for an authoring review. On Coursera,
*Supervised Learning → Model Evaluation* (20 %, n = 659) and *Supervised Learning →
scikit-learn* (23 %, n = 579) disagree: reviewers reached the evaluation and scikit-learn
courses before the supervised-learning ones roughly four times in five.

The *graph-inverted* column is a finding about the engine rather than about learners: in 16
of 2,451 pairs the engine taught a skill before one of its own prerequisites — almost always a
phase project that touches a skill at level 1 before the course that teaches its prerequisite
arrives in the next phase (for example *DevOps Fundamentals* before *Git & Version Control*
in seven paths), plus one cycle-broken soft edge (*Model Evaluation* before *Inferential
Statistics*). Learners side with the graph in those cases (3 of 10 and 1 of 9 agree), which
is the direction the fix should take.

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
(model-annotated, human spot-checked, 246 items over 159 skills). For every item, all 159
skills are ranked by cosine to the item; P@1, P@3 and MRR of the first correct skill are
averaged over items. Because 103 of the 246 items teach a single skill and 182 teach at most
two, P@3 cannot reach 1.0 — its ceiling, the mean best achievable P@3, is 0.614. Five models
ran locally on Apple silicon (MPS); `nomic-embed-text-v1.5` received its required
`search_query:` / `search_document:` prefixes, the others plain text. Each candidate is
compared to the shipped baseline with a paired bootstrap over items (2,000 resamples); a
candidate is "clearly better" only if every metric's 95 % interval lies above zero.

**Result** (`pipeline/evidence/eval_embedding_bakeoff.md`):

| Model | Dim | P@1 | P@3 (ceiling 0.614) | MRR | Δ vs shipped: P@1 · P@3 · MRR (95 % interval) |
|---|---|---|---|---|---|
| all-MiniLM-L6-v2 (shipped) | 384 | 0.756 | 0.401 | 0.843 | — |
| BAAI/bge-small-en-v1.5 | 384 | 0.748 | 0.382 | 0.830 | −0.008 [−0.061, +0.041] · −0.019 [−0.043, +0.005] · −0.013 [−0.046, +0.020] |
| BAAI/bge-base-en-v1.5 | 768 | 0.776 | 0.390 | 0.844 | +0.020 [−0.020, +0.061] · −0.011 [−0.033, +0.011] · +0.001 [−0.027, +0.027] |
| thenlper/gte-base | 768 | **0.789** | **0.402** | **0.862** | +0.033 [−0.008, +0.073] · +0.001 [−0.019, +0.022] · +0.018 [−0.008, +0.043] |
| nomic-ai/nomic-embed-text-v1.5 | 768 | 0.736 | 0.362 | 0.818 | −0.020 [−0.073, +0.033] · −0.039 [−0.062, −0.016] · −0.025 [−0.059, +0.009] |

By item kind the ranking is stable: courses are easy (MiniLM P@1 0.836, gte-base 0.863),
projects and assessments are hard for every model (P@1 0.44–0.63), because their text
describes a task rather than a topic.

**Decision.** `gte-base` leads on all three metrics, but by +0.033 / +0.001 / +0.018 with
every interval straddling zero — eight more items right at rank 1 out of 246, at twice the
vector size. That is not "clearly better", so the shipped model stays `all-MiniLM-L6-v2` and
the table is the result. The rule that would change it — all three intervals above zero, and
a reviewed diff of every fixture path the swap would alter — is in the script.

## 3. Narration groundedness

_Measured in the next revision of this document._

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
npx tsx pipeline/evaluate/dump_paths.ts --out pipeline/build/evaluate/paths.json   # the 50-path corpus (the scripts run this themselves)
python pipeline/evaluate/sequencing_agreement.py
python pipeline/evaluate/embedding_bakeoff.py
python pipeline/evaluate/narration_groundedness.py   # needs ANTHROPIC_API_KEY; model calls are cached under pipeline/build/
```
