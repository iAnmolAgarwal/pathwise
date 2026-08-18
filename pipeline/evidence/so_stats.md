# Stack Overflow question-order mining — stats

Produced by `python pipeline/mine_so.py emit`; every number below is computed, none is typed in.

- Map signed off by both humans: **False** ({"anmol": null, "riyan": null})
- Cohort rule: For pair (A,B) count only users whose first-ever question is >= 12 months after both technologies existed (birth = first appearance of any of the skill's tags on the site); same-day ties dropped; users with 2-40 mapped skills only
- Caveat on every number: Stack Overflow question order (first question per tag), users who started after both technologies existed; asking ≠ completing

## Coverage

- usersWithQuestions: 4657919
- usersWithAnyMappedSkill: 3548262
- usersEligible: 2168095
- skillsMapped: 151
- skillsObserved: 151
- skillsObservedMirror: 148
- skillsObservedSede: 151
- skillsInKeptEdges: 149
- pairsSeen: 10547
- pairsAtFloor: 8586
- authoredEdges: 193
- authoredEdgesEndpointsObserved: 185
- authoredEdgesAtFloor: 167
- authoredEdgesReverseWins: 31
- skillsNoDataByConstruction (8): data-storytelling, incident-response, llm-evaluation, open-source-contribution, prompt-engineering, responsible-ai, technical-writing, threat-modeling
- skillsMappedButUnobserved (0): —

## Cohort filter effect (12-month rule)

- pairs at floor (n ≥ 20): 9049 before → 8586 after
- ordered observations: 27397530 before → 24679857 after; same-day ties dropped: 3527700

## Top 20 edges by support

| from | to | support | reverse | conf | n |
|---|---|---|---|---|---|
| javascript | html | 115832 | 68457 | 0.629 | 184289 |
| javascript | css | 114771 | 57124 | 0.668 | 171895 |
| javascript | sql | 85991 | 66028 | 0.566 | 152019 |
| java | javascript | 83285 | 62412 | 0.572 | 145697 |
| javascript | mysql | 74177 | 58785 | 0.558 | 132962 |
| javascript | nodejs | 70714 | 22082 | 0.762 | 92796 |
| javascript | api-integration | 66430 | 10781 | 0.860 | 77211 |
| javascript | python | 64154 | 62043 | 0.508 | 126197 |
| java | sql | 59376 | 35951 | 0.623 | 95327 |
| html | css | 56959 | 32739 | 0.635 | 89698 |
| java | html | 56257 | 39671 | 0.586 | 95928 |
| javascript | web-servers | 55127 | 26053 | 0.679 | 81180 |
| html | sql | 54983 | 48509 | 0.531 | 103492 |
| java | python | 53139 | 35624 | 0.599 | 88763 |
| python | python-data-analysis | 52690 | 5887 | 0.899 | 58577 |
| javascript | react | 50293 | 14171 | 0.780 | 64464 |
| html | mysql | 48905 | 44224 | 0.525 | 93129 |
| javascript | regex | 46443 | 20297 | 0.696 | 66740 |
| javascript | nosql-databases | 44920 | 16828 | 0.727 | 61748 |
| python | html | 44256 | 41919 | 0.514 | 86175 |

## 20 lowest-confidence authored edges (the noise, not hidden)

Confidence here is for the AUTHORED direction (prereq before dependent); < 0.5 means learners asked in the opposite order more often.

| authored from | authored to | support | reverse | conf | n | sample |
|---|---|---|---|---|---|---|
| statistics-fundamentals | r-programming | 750 | 4770 | 0.136 | 5520 | full-mirror |
| deep-learning | tensorflow | 1257 | 3381 | 0.271 | 4638 | full-mirror |
| javascript-advanced | api-integration | 2596 | 6581 | 0.283 | 9177 | full-mirror |
| javascript-advanced | nodejs | 5078 | 9540 | 0.347 | 14618 | full-mirror |
| programming-basics | java | 11694 | 19471 | 0.375 | 31165 | full-mirror |
| programming-basics | python | 16482 | 26745 | 0.381 | 43227 | full-mirror |
| programming-basics | javascript | 20620 | 32719 | 0.387 | 53339 | full-mirror |
| networking-basics | api-integration | 6054 | 8857 | 0.406 | 14911 | full-mirror |
| deep-learning | computer-vision | 1438 | 2062 | 0.411 | 3500 | full-mirror |
| data-structures | algorithms | 4747 | 6772 | 0.412 | 11519 | full-mirror |
| sql | mysql | 27188 | 36897 | 0.424 | 64085 | full-mirror |
| javascript-advanced | web-animations | 601 | 801 | 0.429 | 1402 | full-mirror |
| model-deployment | mlops | 26 | 34 | 0.433 | 60 | full-mirror |
| network-security | ethical-hacking-basics | 63 | 77 | 0.450 | 140 | full-mirror |
| neural-networks | deep-learning | 1019 | 1223 | 0.455 | 2242 | full-mirror |
| supervised-learning | scikit-learn | 814 | 968 | 0.457 | 1782 | full-mirror |
| networking-basics | web-servers | 8487 | 9941 | 0.461 | 18428 | full-mirror |
| web-security | ethical-hacking-basics | 40 | 46 | 0.465 | 86 | full-mirror |
| docker | model-deployment | 68 | 77 | 0.469 | 145 | full-mirror |
| javascript-advanced | react | 4965 | 5575 | 0.471 | 10540 | full-mirror |

## LLM-era top-up (SEDE, 5 % user sample)

- {"llmEraSkills": ["ai-agents", "ai-app-development", "embeddings-vector-search", "fine-tuning", "llm-apis", "llm-evaluation", "llm-fundamentals", "local-llms", "multimodal-ai", "prompt-engineering", "rag", "responsible-ai", "vector-databases"], "orderedObservations": 67850, "pairsAtFloor": 295, "pairsSeen": 1368, "sample": "Stack Exchange Data Explorer, current data: users with >= 1 LLM-era question among posts with Id >= 73000000, OwnerUserId % 1 = 0 (100 % of users), full history per user; pairs with an LLM-era endpoint only", "status": "ingested"}

## Branches

- {"fromSkills": 290, "fromSkillsMinSupportMet": 175, "fromSkillsWithListed": 227, "listedTransitions": 16112}

_Stack Overflow content is CC BY-SA 4.0 (https://stackoverflow.com/help/licensing); aggregate counts only._
