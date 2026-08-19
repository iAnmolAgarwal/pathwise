# Coursera review-order mining — stats

Produced by `python pipeline/mine_coursera.py run`; every number below is computed, none is typed in.

- Method: literal duplicate rows dropped on (reviewer, course, date, rating, text); 'By Deleted A' dropped; names with 2-15 distinct reviews; per name the first review date of each distinct course; every ordered pair of distinct courses counted once per name; same-day pairs dropped; support >= 20; confidence = AB/(AB+BA) >= 0.85
- Caveat on every number: Coursera learners 2015–2020; sequences reconstructed from review order; pseudo-users by reviewer name

## Rows and names

- rowsTotal: 1454711
- rowsDeletedName: 5412
- rowsLiteralDuplicates: 931282
- rowsDistinct: 518017
- namesDistinct: 287807
- namesOneReview: 210178
- namesAboveBand: 2036
- namesInBand: 75593
- rowsUsed: 251711
- namesWithPairs: 72774
- sameDayPairsDropped: 12402
- coursesInCorpus: 623

## Edges at the shipped floors (support ≥ 20, confidence ≥ 0.85)

- orderedPairsSeen: 109413
- pairsAtSupportFloor: 2939
- edgesKept: 290
- distinctCourses: 170

- same rows at confidence ≥ 0.7: {"orderedPairsSeen": 109413, "pairsAtSupportFloor": 2939, "edgesKept": 967, "distinctCourses": 268, "confidenceFloor": 0.7}
- same rows if same-day ties were kept in file order: {"orderedPairsSeen": 110126, "pairsAtSupportFloor": 2986, "edgesKept": 290, "distinctCourses": 176, "confidenceFloor": 0.85}

## Riyan's baseline, recomputed from the same CSVs

- procedure: no literal-duplicate drop; 'By Deleted A' dropped; names with 2-15 raw rows; per name the first review date of each distinct course; ordered pairs once per name; same-day pairs kept in file order
- names: one-review 23647, above band 10816, in band 253344; rows used 1054450
- at 0.70: {"orderedPairsSeen": 58939, "pairsAtSupportFloor": 714, "edgesKept": 287, "distinctCourses": 171, "confidenceFloor": 0.7}
- at 0.85 (his procedure, our floor): {"orderedPairsSeen": 58939, "pairsAtSupportFloor": 714, "edgesKept": 172, "distinctCourses": 137, "confidenceFloor": 0.85}
- published by Riyan: {"rowsUsed": 1054450, "orderedPairsSeen": 58939, "pairsAtSupportFloor": 714, "edgesKept": 287, "distinctCourses": 171, "confidenceFloor": 0.7}
- reproduces the published numbers exactly: **True**

| run | rows used | ordered pairs | pairs ≥ 20 | edges | courses |
|---|---|---|---|---|---|
| Riyan published (0.70) | 1054450 | 58939 | 714 | 287 | 171 |
| his procedure recomputed (0.70) | 1054450 | 58939 | 714 | 287 | 171 |
| his procedure at 0.85 | 1054450 | 58939 | 714 | 172 | 137 |
| shipped: dedup, ties dropped (0.70) | 251711 | 109413 | 2939 | 967 | 268 |
| **shipped: dedup, ties dropped (0.85)** | 251711 | 109413 | 2939 | **290** | **170** |

## Chain checks (shipped edge set)

- all four success chains survive: **True**
- no nonsense chain survives: **True**

### Success chains at 0.85 (shipped rows)

- **python-for-everybody** — SURVIVES
  - Programming for Everybody (Getting Started with Python) → Python Data Structures: 1867 vs 235, conf 0.8882 — kept
  - Python Data Structures → Using Python to Access Web Data: 1592 vs 148, conf 0.9149 — kept
  - Using Python to Access Web Data → Capstone: Retrieving, Processing, and Visualizing Data with Python: 388 vs 22, conf 0.9463 — kept
- **ibm-cybersecurity** — SURVIVES
  - Introduction to Cybersecurity Tools & Cyber Attacks → Cybersecurity Roles, Processes & Operating System Security: 104 vs 7, conf 0.9369 — kept
  - Cybersecurity Roles, Processes & Operating System Security → Cybersecurity Compliance Framework & System Administration: 44 vs 3, conf 0.9362 — kept
- **uci-project-management** — SURVIVES
  - Initiating and Planning Projects → Budgeting and Scheduling Projects: 259 vs 19, conf 0.9317 — kept
  - Budgeting and Scheduling Projects → Managing Project Risks and Changes: 141 vs 16, conf 0.8981 — kept
- **ml-to-tensorflow** — SURVIVES
  - Machine Learning → Convolutional Neural Networks in TensorFlow: 61 vs 6, conf 0.9104 — kept
  - Convolutional Neural Networks in TensorFlow → Sequences, Time Series and Prediction: 101 vs 7, conf 0.9352 — kept

### Nonsense chains at 0.85 (shipped rows)

- **food-health-python-css** — does not survive
  - Stanford Introduction to Food and Health → Python Data Structures: 54 vs 55, conf 0.4954 — not kept
  - Python Data Structures → Introduction to CSS3: 74 vs 54, conf 0.5781 — not kept
- **customer-analytics-deep-learning** — does not survive
  - Customer Analytics → Neural Networks and Deep Learning: 59 vs 36, conf 0.6211 — not kept
- **python-css** — does not survive
  - Programming for Everybody (Getting Started with Python) → Python Data Structures: 1867 vs 235, conf 0.8882 — kept
  - Python Data Structures → Introduction to CSS3: 74 vs 54, conf 0.5781 — not kept

### Success chains at 0.85 on Riyan's rows

- **python-for-everybody** — SURVIVES
  - Programming for Everybody (Getting Started with Python) → Python Data Structures: 1534 vs 105, conf 0.9359 — kept
  - Python Data Structures → Using Python to Access Web Data: 1283 vs 65, conf 0.9518 — kept
  - Using Python to Access Web Data → Capstone: Retrieving, Processing, and Visualizing Data with Python: 264 vs 12, conf 0.9565 — kept
- **ibm-cybersecurity** — SURVIVES
  - Introduction to Cybersecurity Tools & Cyber Attacks → Cybersecurity Roles, Processes & Operating System Security: 80 vs 5, conf 0.9412 — kept
  - Cybersecurity Roles, Processes & Operating System Security → Cybersecurity Compliance Framework & System Administration: 36 vs 2, conf 0.9474 — kept
- **uci-project-management** — SURVIVES
  - Initiating and Planning Projects → Budgeting and Scheduling Projects: 270 vs 12, conf 0.9574 — kept
  - Budgeting and Scheduling Projects → Managing Project Risks and Changes: 169 vs 13, conf 0.9286 — kept
- **ml-to-tensorflow** — SURVIVES
  - Machine Learning → Convolutional Neural Networks in TensorFlow: 25 vs 0, conf 1.0 — kept
  - Convolutional Neural Networks in TensorFlow → Sequences, Time Series and Prediction: 54 vs 3, conf 0.9474 — kept

### Nonsense chains at 0.70 on Riyan's rows (should survive there — that was his finding)

- **food-health-python-css** — SURVIVES
  - Stanford Introduction to Food and Health → Python Data Structures: 24 vs 10, conf 0.7059 — kept
  - Python Data Structures → Introduction to CSS3: 42 vs 18, conf 0.7 — kept
- **customer-analytics-deep-learning** — SURVIVES
  - Customer Analytics → Neural Networks and Deep Learning: 21 vs 8, conf 0.7241 — kept
- **python-css** — SURVIVES
  - Programming for Everybody (Getting Started with Python) → Python Data Structures: 1534 vs 105, conf 0.9359 — kept
  - Python Data Structures → Introduction to CSS3: 42 vs 18, conf 0.7 — kept

## Top 20 edges by support

| from | to | support | reverse | conf | n |
|---|---|---|---|---|---|
| Neural Networks and Deep Learning | Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization | 1928 | 115 | 0.944 | 2043 |
| Programming for Everybody (Getting Started with Python) | Python Data Structures | 1867 | 235 | 0.888 | 2102 |
| Python Data Structures | Using Python to Access Web Data | 1592 | 148 | 0.915 | 1740 |
| Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization | Structuring Machine Learning Projects | 1477 | 142 | 0.912 | 1619 |
| Neural Networks and Deep Learning | Structuring Machine Learning Projects | 1428 | 126 | 0.919 | 1554 |
| Technical Support Fundamentals | The Bits and Bytes of Computer Networking | 1334 | 126 | 0.914 | 1460 |
| Programming for Everybody (Getting Started with Python) | Using Python to Access Web Data | 913 | 151 | 0.858 | 1064 |
| What is Data Science? | Tools for Data Science | 859 | 55 | 0.940 | 914 |
| Using Python to Access Web Data | Using Databases with Python | 831 | 58 | 0.935 | 889 |
| Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization | Sequence Models | 804 | 39 | 0.954 | 843 |
| Neural Networks and Deep Learning | Sequence Models | 745 | 45 | 0.943 | 790 |
| Python Data Structures | Using Databases with Python | 720 | 64 | 0.918 | 784 |
| Excel Skills for Business: Essentials | Excel Skills for Business: Intermediate I | 717 | 35 | 0.953 | 752 |
| Structuring Machine Learning Projects | Sequence Models | 711 | 42 | 0.944 | 753 |
| Technical Support Fundamentals | Operating Systems and You: Becoming a Power User | 678 | 61 | 0.917 | 739 |
| The Bits and Bytes of Computer Networking | Operating Systems and You: Becoming a Power User | 638 | 61 | 0.913 | 699 |
| The Data Scientist’s Toolbox | R Programming | 637 | 98 | 0.867 | 735 |
| What is Data Science? | Data Science Methodology | 543 | 28 | 0.951 | 571 |
| Technical Support Fundamentals | System Administration and IT Infrastructure Services | 530 | 49 | 0.915 | 579 |
| What is Data Science? | Python for Data Science and AI | 489 | 60 | 0.891 | 549 |
