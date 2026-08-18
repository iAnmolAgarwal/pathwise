# Stack Overflow question-order mining — stats

Produced by `python pipeline/mine_so.py emit`; every number below is computed, none is typed in.

- Map signed off by both humans: **False** ({"anmol": "2026-08-19", "riyan": null})
- Cohort rule: For pair (A,B) count only users whose first-ever question is >= 12 months after both technologies existed (birth = first appearance of any of the skill's tags on the site); same-day ties dropped; users with 2-40 mapped skills only
- Caveat on every number: Stack Overflow question order (first question per tag), users who started after both technologies existed; asking ≠ completing

## Coverage

- usersWithQuestions: 4657919
- usersWithAnyMappedSkill: 3543231
- usersEligible: 2153482
- skillsMapped: 153
- skillsObserved: 148
- skillsObservedMirror: 148
- skillsObservedSede: 0
- skillsInKeptEdges: 146
- pairsSeen: 10476
- pairsAtFloor: 8555
- authoredEdges: 193
- authoredEdgesEndpointsObserved: 177
- authoredEdgesAtFloor: 165
- authoredEdgesReverseWins: 31
- skillsNoDataByConstruction (6): data-storytelling, incident-response, llm-evaluation, open-source-contribution, prompt-engineering, threat-modeling
- skillsMappedButUnobserved (5): ai-agents, fine-tuning, llm-apis, local-llms, rag

## Cohort filter effect (12-month rule)

- pairs at floor (n ≥ 20): 9008 before → 8555 after
- ordered observations: 26786310 before → 24071670 after; same-day ties dropped: 3458873

## Top 20 edges by support

| from | to | support | reverse | conf | n |
|---|---|---|---|---|---|
| javascript | css | 115187 | 57063 | 0.669 | 172250 |
| javascript | html | 114778 | 67398 | 0.630 | 182176 |
| javascript | sql | 83949 | 64572 | 0.565 | 148521 |
| java | javascript | 83760 | 62689 | 0.572 | 146449 |
| javascript | mysql | 74618 | 58865 | 0.559 | 133483 |
| javascript | nodejs | 70910 | 22078 | 0.763 | 92988 |
| javascript | api-integration | 66691 | 10764 | 0.861 | 77455 |
| javascript | python | 64478 | 62237 | 0.509 | 126715 |
| java | sql | 58751 | 35152 | 0.626 | 93903 |
| javascript | web-servers | 55439 | 26073 | 0.680 | 81512 |
| html | css | 55352 | 32608 | 0.629 | 87960 |
| java | html | 55236 | 38994 | 0.586 | 94230 |
| java | python | 53192 | 35650 | 0.599 | 88842 |
| python | python-data-analysis | 52736 | 5888 | 0.900 | 58624 |
| html | sql | 52511 | 46536 | 0.530 | 99047 |
| javascript | react | 50394 | 14175 | 0.780 | 64569 |
| html | mysql | 48034 | 43793 | 0.523 | 91827 |
| javascript | regex | 46805 | 20340 | 0.697 | 67145 |
| javascript | nosql-databases | 46376 | 17480 | 0.726 | 63856 |
| python | html | 43662 | 41177 | 0.515 | 84839 |

## 20 lowest-confidence authored edges (the noise, not hidden)

Confidence here is for the AUTHORED direction (prereq before dependent); < 0.5 means learners asked in the opposite order more often.

| authored from | authored to | support | reverse | conf | n | sample |
|---|---|---|---|---|---|---|
| statistics-fundamentals | r-programming | 756 | 4780 | 0.137 | 5536 | full-mirror |
| deep-learning | tensorflow | 1258 | 3383 | 0.271 | 4641 | full-mirror |
| javascript-advanced | api-integration | 2604 | 6623 | 0.282 | 9227 | full-mirror |
| javascript-advanced | nodejs | 5091 | 9572 | 0.347 | 14663 | full-mirror |
| programming-basics | java | 11706 | 19506 | 0.375 | 31212 | full-mirror |
| programming-basics | python | 16508 | 26780 | 0.381 | 43288 | full-mirror |
| programming-basics | javascript | 20670 | 32911 | 0.386 | 53581 | full-mirror |
| networking-basics | api-integration | 6085 | 8891 | 0.406 | 14976 | full-mirror |
| deep-learning | computer-vision | 1440 | 2064 | 0.411 | 3504 | full-mirror |
| data-structures | algorithms | 4752 | 6804 | 0.411 | 11556 | full-mirror |
| sql | mysql | 26293 | 36325 | 0.420 | 62618 | full-mirror |
| javascript-advanced | web-animations | 608 | 806 | 0.430 | 1414 | full-mirror |
| math-for-ml | neural-networks | 236 | 298 | 0.442 | 534 | full-mirror |
| model-deployment | mlops | 28 | 35 | 0.444 | 63 | full-mirror |
| network-security | ethical-hacking-basics | 63 | 77 | 0.450 | 140 | full-mirror |
| neural-networks | deep-learning | 1011 | 1224 | 0.452 | 2235 | full-mirror |
| supervised-learning | scikit-learn | 819 | 974 | 0.457 | 1793 | full-mirror |
| docker | model-deployment | 65 | 76 | 0.461 | 141 | full-mirror |
| networking-basics | web-servers | 8534 | 9968 | 0.461 | 18502 | full-mirror |
| web-security | ethical-hacking-basics | 40 | 46 | 0.465 | 86 | full-mirror |

## LLM-era top-up (Stack Exchange Data Explorer, current data)

- {"llmEraSkills": ["ai-agents", "ai-app-development", "embeddings-vector-search", "fine-tuning", "llm-apis", "llm-evaluation", "llm-fundamentals", "local-llms", "multimodal-ai", "prompt-engineering", "rag", "responsible-ai", "vector-databases"], "note": "run `mine_so.py render-sede`, execute the query on data.stackexchange.com, save the CSV to pipeline/build/so/sede_llm_pairs.csv, re-run emit", "status": "pending"}

## Branches

- {"fromSkills": 147, "fromSkillsMinSupportMet": 144, "fromSkillsWithListed": 145, "listedTransitions": 15572}

_Stack Overflow content is CC BY-SA 4.0 (https://stackoverflow.com/help/licensing); aggregate counts only._
