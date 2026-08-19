# Contradictions — authored edges a source opposes

Rendered by `python pipeline/merge_edges.py run` from the current evidence plus the human decisions in `evidence_resolutions.json` (edit that file, never this one). A contradiction is an authored edge a → b where a source shows b → a at confidence ≥ 0.85 with n ≥ 50. The authored edge keeps driving paths until a human resolves it; a `flip`, `remove` or `both-valid-drop-edge` decision is applied through the taxonomy source files (pipeline/sources/*.json) and re-validated, then the merge is re-run — never by editing src/data/.

- Open: 0 · Resolved: 6 · Historical (edge since flipped/removed): 0

## CSS → Web Accessibility  (`css` → `web-accessibility`)

- stackoverflow: 1540 vs 377 (conf 0.803, n 1917, sample full-mirror) (confirms)
- coursera: 9 vs 101 (conf 0.082, n 110, 1 course pairs) ← contradicts
  - top course pair behind the authored direction: introcss → html (9)
- **Resolution: keep-authored** — owner decision: keep the authored graph unchanged this block; one Coursera course pair (introcss → html); Stack Overflow confirms the authored direction (0.803, n 1917) (anmol, 2026-08-19)

## Programming Basics → JavaScript  (`programming-basics` → `javascript`)

- stackoverflow: 20676 vs 32933 (conf 0.386, n 53609, sample full-mirror)
- coursera: 16 vs 141 (conf 0.102, n 157, 1 course pairs) ← contradicts
  - top course pair behind the authored direction: java-programming → duke-programming-web (16)
- **Resolution: keep-authored** — owner decision: keep the authored graph unchanged this block; one Coursera course pair inside one specialization (java-programming → duke-programming-web); Stack Overflow is inconclusive at large n (anmol, 2026-08-19)

## Security Fundamentals → Identity & Access Management  (`security-fundamentals` → `identity-access-management`)

- stackoverflow: 1362 vs 915 (conf 0.598, n 2277, sample full-mirror)
- coursera: 35 vs 427 (conf 0.076, n 462, 2 course pairs) ← contradicts
  - top course pair behind the authored direction: it-security → system-administration-it-infrastructure-services (28)
- **Resolution: keep-authored** — owner decision: keep the authored graph unchanged this block; two Coursera course pairs inside the Google IT Support certificate order; Stack Overflow is inconclusive (anmol, 2026-08-19)

## Security Fundamentals → Network Security  (`security-fundamentals` → `network-security`)

- stackoverflow: 2270 vs 1627 (conf 0.582, n 3897, sample full-mirror)
- coursera: 7 vs 104 (conf 0.063, n 111, 1 course pairs) ← contradicts
  - top course pair behind the authored direction: cybersecurity-roles-processes-operating-system-security → introduction-cybersecurity-cyber-attacks (7)
- **Resolution: keep-authored** — owner decision: keep the authored graph unchanged this block; one Coursera course pair inside the IBM cybersecurity chain order; Stack Overflow is inconclusive (anmol, 2026-08-19)

## SQL → Advanced SQL  (`sql` → `advanced-sql`)

- stackoverflow: 18388 vs 2772 (conf 0.869, n 21160, sample full-mirror) (confirms)
- coursera: 2 vs 86 (conf 0.023, n 88, 1 course pairs) ← contradicts
  - top course pair behind the authored direction: applied-data-science-capstone → sql-data-science (2)
- **Resolution: keep-authored** — owner decision: keep the authored graph unchanged this block; one Coursera course pair (applied-data-science-capstone → sql-data-science, 2 vs 86); Stack Overflow confirms the authored direction (0.869, n 21160) (anmol, 2026-08-19)

## Statistics Fundamentals → R Programming  (`statistics-fundamentals` → `r-programming`)

- stackoverflow: 756 vs 4783 (conf 0.136, n 5539, sample full-mirror) ← contradicts
- **Resolution: keep-authored** — owner decision: keep the authored graph unchanged this block; Stack Overflow shows R questions before statistics questions (0.136, n 5539); asking order is not completion order and the authored ordering is a curriculum choice — authored graph kept unchanged (anmol, 2026-08-19)
