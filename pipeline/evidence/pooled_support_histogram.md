# Pooled support histogram — Coursera course→course edges lifted to skills

Produced by `python pipeline/pool.py run` from the committed Ring-1 course tags and course-level edges; every number is computed. This is the first output of the pooling stage (ARCHITECTURE §15.4): the "1,617" figure in the original proposal was illustrative, this is the measurement.

- Caveat on every number: Coursera learners 2015–2020; sequences reconstructed from review order; pseudo-users by reviewer name
- Inputs: 290 course edges (conf ≥ 0.85, support ≥ 20) over 170 Ring-1 courses; 99 of those courses carry ≥ 1 skill tag (255 tags); 153 course edges have a tagged course at both ends and lift to 1409 (course pair, skill pair) contributions.
- Pooled skill→skill edges: **577** over **77** skills; 53 sit on an authored edge, 53 inside the authored prerequisite closure, 471 cross-domain candidates (see cross_domain_candidates.md).
- Authored edges (193) with a pooled Coursera observation in either direction: **53**.

Pooled confidence is computed from course pairs that passed the course-level 0.85 floor, so a pooled reverse count can come only from kept course pairs whose skills point the other way; a single-course-pair edge inherits that pair's confidence. The histogram therefore says how much support each skill pair collects, not how often learners went the other way at course level below the floor.

## Support per pooled edge

| support | edges |
|---|---|
| 1–19 | 0 |
| 20–49 | 118 |
| 50–99 | 89 |
| 100–199 | 87 |
| 200–499 | 160 |
| 500–999 | 78 |
| 1000+ | 45 |

## n (support + reverse) per pooled edge

| n | edges |
|---|---|
| 1–19 | 0 |
| 20–49 | 99 |
| 50–99 | 97 |
| 100–199 | 81 |
| 200–499 | 144 |
| 500–999 | 100 |
| 1000+ | 56 |

## Confidence per pooled edge

| confidence | edges |
|---|---|
| 0.50–0.70 | 69 |
| 0.70–0.85 | 72 |
| 0.85–0.95 | 360 |
| 0.95–1.00 | 76 |

## Course pairs per pooled edge

| nCoursePairs | edges |
|---|---|
| 1–1 | 263 |
| 2–2 | 132 |
| 3–4 | 114 |
| 5–9 | 60 |
| 10+ | 8 |

## Against the promotion thresholds (§15.6: conf ≥ 0.85, support ≥ 50, ≥ 2 course pairs)

- pooled edges meeting all three: 173 (of which 134 cross-domain, 156 without an authored counterpart)
- pooled edges at conf ≥ 0.70 and n ≥ 20 (the §15.5 confirm floor): 508

## Branches (transition shares, same floors as Stack Overflow: nTotal ≥ 50, listed at n ≥ 5, α = 20)

- from-skills observed: 81; with nTotal ≥ 50: **81**; listed transitions: 3981; course-level transitions lifted: 96435

| nTotal | from-skills |
|---|---|
| 1–4 | 0 |
| 5–19 | 0 |
| 20–49 | 0 |
| 50–99 | 4 |
| 100–499 | 13 |
| 500+ | 64 |

## Top 20 pooled edges by support

| from | to | support | reverse | conf | n | course pairs | relation |
|---|---|---|---|---|---|---|---|
| Deep Learning | Model Evaluation | 5065 | 2831 | 0.641 | 7896 | 16 | unrelated |
| Neural Networks | Model Evaluation | 4874 | 443 | 0.917 | 5317 | 6 | unrelated |
| Neural Networks | Deep Learning | 4737 | 2212 | 0.682 | 6949 | 10 | direct |
| Python | Working with APIs | 4657 | 912 | 0.836 | 5569 | 10 | unrelated |
| Programming Basics | Python | 3217 | 491 | 0.868 | 3708 | 6 | direct |
| Deep Learning | TensorFlow & Keras | 3072 | 2082 | 0.596 | 5154 | 13 | direct |
| Neural Networks | TensorFlow & Keras | 2802 | 184 | 0.938 | 2986 | 7 | ancestor |
| Python | Regular Expressions | 2719 | 690 | 0.798 | 3409 | 4 | unrelated |
| Python | Networking & How the Web Works | 2658 | 700 | 0.792 | 3358 | 5 | unrelated |
| Data Structures | Working with APIs | 2434 | 213 | 0.920 | 2647 | 3 | unrelated |
| Python | Data Structures | 2255 | 2243 | 0.501 | 4498 | 6 | unrelated |
| Deep Learning | Natural Language Processing | 2209 | 291 | 0.884 | 2500 | 11 | direct |
| Networking & How the Web Works | Identity & Access Management | 2135 | 195 | 0.916 | 2330 | 5 | ancestor |
| Python | SQL | 2098 | 178 | 0.922 | 2276 | 5 | unrelated |
| Programming Basics | Data Structures | 2064 | 286 | 0.878 | 2350 | 3 | direct |
| Python | Object-Oriented Programming | 1984 | 224 | 0.899 | 2208 | 5 | unrelated |
| Python | Data Modeling | 1952 | 177 | 0.917 | 2129 | 3 | unrelated |
| Neural Networks | Natural Language Processing | 1937 | 143 | 0.931 | 2080 | 8 | ancestor |
| Model Evaluation | Natural Language Processing | 1790 | 109 | 0.943 | 1899 | 7 | unrelated |
| Google Cloud Fundamentals | Cloud Networking | 1710 | 1468 | 0.538 | 3178 | 10 | unrelated |
