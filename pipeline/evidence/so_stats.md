# Stack Overflow question-order mining — stats

Produced by `python pipeline/mine_so.py emit`; every number below is computed, none is typed in.

- Map signed off by both humans: **False** ({"anmol": "2026-08-19", "riyan": null})
- Cohort rule: For pair (A,B) count only users whose first-ever question is >= 12 months after both technologies existed (birth = first appearance of any of the skill's tags on the site); same-day ties dropped; users with 2-40 mapped skills only
- Caveat on every number: Stack Overflow question order (first question per tag), users who started after both technologies existed; asking ≠ completing

## Coverage

- usersWithQuestions: 4657919
- usersWithAnyMappedSkill: 3536377
- usersEligible: 2137848
- skillsMapped: 153
- skillsObserved: 153
- skillsObservedMirror: 146
- skillsObservedSede: 153
- skillsInKeptEdges: 147
- pairsSeen: 10174
- pairsAtFloor: 8260
- authoredEdges: 193
- authoredEdgesEndpointsObserved: 186
- authoredEdgesAtFloor: 165
- authoredEdgesReverseWins: 31
- skillsNoDataByConstruction (6): data-storytelling, incident-response, llm-evaluation, open-source-contribution, prompt-engineering, threat-modeling
- skillsMappedButUnobserved (0): —

## Cohort filter effect (12-month rule)

- pairs at floor (n ≥ 20): 8709 before → 8260 after
- ordered observations: 26404750 before → 23707403 after; same-day ties dropped: 3413791

## Top 20 edges by support

| from | to | support | reverse | conf | n |
|---|---|---|---|---|---|
| javascript | css | 115217 | 57080 | 0.669 | 172297 |
| javascript | html | 114805 | 67420 | 0.630 | 182225 |
| javascript | sql | 83980 | 64596 | 0.565 | 148576 |
| java | javascript | 83780 | 62715 | 0.572 | 146495 |
| javascript | mysql | 74640 | 58889 | 0.559 | 133529 |
| javascript | nodejs | 70944 | 22082 | 0.763 | 93026 |
| javascript | api-integration | 66730 | 10767 | 0.861 | 77497 |
| javascript | python | 64514 | 62244 | 0.509 | 126758 |
| java | sql | 58775 | 35170 | 0.626 | 93945 |
| javascript | web-servers | 55470 | 26089 | 0.680 | 81559 |
| html | css | 55372 | 32623 | 0.629 | 87995 |
| java | html | 55261 | 39014 | 0.586 | 94275 |
| java | python | 53215 | 35658 | 0.599 | 88873 |
| html | sql | 52538 | 46565 | 0.530 | 99103 |
| python | python-data-analysis | 51421 | 2646 | 0.951 | 54067 |
| javascript | react | 50419 | 14176 | 0.781 | 64595 |
| html | mysql | 48052 | 43821 | 0.523 | 91873 |
| javascript | regex | 46836 | 20351 | 0.697 | 67187 |
| javascript | nosql-databases | 46415 | 17487 | 0.726 | 63902 |
| python | html | 43669 | 41211 | 0.514 | 84880 |

## 20 lowest-confidence authored edges (the noise, not hidden)

Confidence here is for the AUTHORED direction (prereq before dependent); < 0.5 means learners asked in the opposite order more often.

| authored from | authored to | support | reverse | conf | n | sample |
|---|---|---|---|---|---|---|
| statistics-fundamentals | r-programming | 756 | 4783 | 0.136 | 5539 | full-mirror |
| deep-learning | tensorflow | 1260 | 3385 | 0.271 | 4645 | full-mirror |
| javascript-advanced | api-integration | 2612 | 6640 | 0.282 | 9252 | full-mirror |
| javascript-advanced | nodejs | 5095 | 9588 | 0.347 | 14683 | full-mirror |
| programming-basics | java | 11715 | 19516 | 0.375 | 31231 | full-mirror |
| programming-basics | python | 16519 | 26788 | 0.381 | 43307 | full-mirror |
| programming-basics | javascript | 20676 | 32933 | 0.386 | 53609 | full-mirror |
| networking-basics | api-integration | 6093 | 8915 | 0.406 | 15008 | full-mirror |
| deep-learning | computer-vision | 1441 | 2066 | 0.411 | 3507 | full-mirror |
| data-structures | algorithms | 4760 | 6808 | 0.411 | 11568 | full-mirror |
| sql | mysql | 26307 | 36343 | 0.420 | 62650 | full-mirror |
| javascript-advanced | web-animations | 610 | 807 | 0.430 | 1417 | full-mirror |
| math-for-ml | neural-networks | 236 | 299 | 0.441 | 535 | full-mirror |
| model-deployment | mlops | 28 | 35 | 0.444 | 63 | full-mirror |
| network-security | ethical-hacking-basics | 63 | 77 | 0.450 | 140 | full-mirror |
| neural-networks | deep-learning | 1012 | 1224 | 0.453 | 2236 | full-mirror |
| supervised-learning | scikit-learn | 819 | 975 | 0.457 | 1794 | full-mirror |
| networking-basics | web-servers | 8543 | 9991 | 0.461 | 18534 | full-mirror |
| docker | model-deployment | 65 | 76 | 0.461 | 141 | full-mirror |
| web-security | ethical-hacking-basics | 40 | 46 | 0.465 | 86 | full-mirror |

## LLM-era top-up (Stack Exchange Data Explorer, current data)

- {"llmEraSkills": ["ai-agents", "ai-app-development", "embeddings-vector-search", "fine-tuning", "llm-apis", "llm-evaluation", "llm-fundamentals", "local-llms", "multimodal-ai", "prompt-engineering", "rag", "responsible-ai", "vector-databases"], "orderedObservations": 56192, "pairsAtFloor": 82, "pairsSeen": 1339, "sample": "Stack Exchange Data Explorer, current data: users with >= 1 LLM-era question among posts with Id >= 73000000, OwnerUserId % 1 = 0 (100 % of users), full history per user; pairs with an LLM-era endpoint only", "status": "ingested"}

## Branches

- {"fromSkills": 278, "fromSkillsMinSupportMet": 150, "fromSkillsWithListed": 201, "listedTransitions": 15243}

_Stack Overflow content is CC BY-SA 4.0 (https://stackoverflow.com/help/licensing); aggregate counts only._
