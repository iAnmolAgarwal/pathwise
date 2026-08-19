# Agreement report — authored prerequisite graph vs. learner-sequence evidence

Produced by `python pipeline/merge_edges.py run`; every number is computed by the pipeline, none is typed in. Thresholds and definitions are printed below the tables.

> Of the 193 authored prerequisite edges, 188 were observable in real learner sequences (Stack Overflow question order for 186, Coursera review order for 84); 39.4 % of the observable edges were confirmed by at least one source and 5.9 % by both; 6 contradictions were raised and 6 resolved; 0 novel edges were promoted after human review.

| Metric | Stack Overflow | Coursera | ≥ 1 source | both |
|---|---|---|---|---|
| Observable authored edges (both endpoints have data) | 186 | 84 | 188 | |
| Authored edges holding the pair at the mining floor | 165 | 53 | 167 | |
| Confirmed (conf ≥ 0.70, n ≥ 20) | 48 | 37 | 74 | 11 |
| Confirmed as % of observable (≥ 1 source) | | | 39.4 % | 5.9 % |
| Contradicted (reverse conf ≥ 0.85, n ≥ 50) | 1 | 5 | 6 | |
| Unobserved (below floor in every source) | | | 26 | |
| Observed but inconclusive (numbers kept, no verdict) | | | 89 | |
| Novel candidates meeting the §15.6 thresholds | 78 | 120 | 194 | |
| Promoted by a human | | | 0 | |
| Skills with data (of 159) | 147 | 77 | 150 | |
| Branch from-skills above the floor (nTotal ≥ 50) | 146 | 81 | | |

## Status of the authored edges

| status | edges |
|---|---|
| confirmed-both | 11 |
| confirmed-one-source | 61 |
| contradicted-in-review | 6 |
| no-data | 115 |

## Cohort filter effect (Stack Overflow)

The 12-month rule (count only users whose first-ever question is ≥ 12 months after both technologies existed) is what makes the direction claim defensible; this is what it cost:

| | before | after |
|---|---|---|
| pairs at the n ≥ 20 floor | 8709 | 8260 |
| ordered observations | 26404750 | 23707403 |
| same-day ties dropped | 3413791 | |

## Contradictions

| authored edge | contradicting source(s) | resolution |
|---|---|---|
| CSS → Web Accessibility | coursera | keep-authored — owner decision: keep the authored graph unchanged this block; one Coursera course pair (introcss → html); Stack Overflow confirms the authored direction (0.803, n 1917) (anmol, 2026-08-19) |
| Programming Basics → JavaScript | coursera | keep-authored — owner decision: keep the authored graph unchanged this block; one Coursera course pair inside one specialization (java-programming → duke-programming-web); Stack Overflow is inconclusive at large n (anmol, 2026-08-19) |
| Security Fundamentals → Identity & Access Management | coursera | keep-authored — owner decision: keep the authored graph unchanged this block; two Coursera course pairs inside the Google IT Support certificate order; Stack Overflow is inconclusive (anmol, 2026-08-19) |
| Security Fundamentals → Network Security | coursera | keep-authored — owner decision: keep the authored graph unchanged this block; one Coursera course pair inside the IBM cybersecurity chain order; Stack Overflow is inconclusive (anmol, 2026-08-19) |
| SQL → Advanced SQL | coursera | keep-authored — owner decision: keep the authored graph unchanged this block; one Coursera course pair (applied-data-science-capstone → sql-data-science, 2 vs 86); Stack Overflow confirms the authored direction (0.869, n 21160) (anmol, 2026-08-19) |
| Statistics Fundamentals → R Programming | stackoverflow | keep-authored — owner decision: keep the authored graph unchanged this block; Stack Overflow shows R questions before statistics questions (0.136, n 5539); asking order is not completion order and the authored ordering is a curriculum choice — authored graph kept unchanged (anmol, 2026-08-19) |

## Coverage

- Skills with ≥ 1 source of data: 150 of 159 (Stack Overflow 147, Coursera 77)
- Authored edges with ≥ 1 source of data: 167 of 193
- Coursera Ring-1 courses with tags: 99 of 170 (255 tags); pooled skill edges: 577
- Stack Overflow pairs at floor: 8260
- Mined-only candidate edges in skill_edges.json: 8219 (display and evidence only; drivesPath false unless promoted)

## Definitions and thresholds

- observable: both endpoints have data in the source: Stack Overflow = skill observed in the mirror or the SEDE top-up; Coursera = skill tagged on >= 1 Ring-1 course
- confirm: confidence(a->b) >= 0.70 with n >= 20
- contradict: confidence(b->a) >= 0.85 with n >= 50
- unobservedBelowFloor: no source holds the pair at its mining floor (Stack Overflow n >= 20 after the cohort filter; Coursera course pairs at support >= 20, confidence >= 0.85)
- observedButInconclusive: a source holds the pair but neither confirms nor contradicts it; the numbers are kept on the edge
- thresholds: {"confirmConfidence": 0.7, "confirmN": 20, "contradictConfidence": 0.85, "contradictN": 50, "promoteConfidence": 0.85, "promoteSupport": 50, "promoteCorroboration": 2}
