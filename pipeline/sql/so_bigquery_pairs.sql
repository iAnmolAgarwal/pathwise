-- Ordered pairs of skills per eligible user, with and without the cohort-bias filter.
-- One row per unordered pair {a, b} with a < b (skill id order); the emitter re-orients
-- each pair so that support >= reverse. No support floor here: mine_so.py applies it,
-- so "pairs seen" and the cohort filter's effect can be measured from the same file.
{{COMMON}}
, me AS (
  SELECT m.uid, m.skill_id, m.first_d, u0.start_d
  FROM m JOIN elig USING (uid) JOIN u0 USING (uid)
)
SELECT
  a.skill_id AS s_from,
  b.skill_id AS s_to,
  COUNTIF(a.first_d < b.first_d
          AND a.start_d >= DATE_ADD(GREATEST(ba.birth_d, bb.birth_d), INTERVAL {{COHORT_MONTHS}} MONTH)) AS support,
  COUNTIF(a.first_d > b.first_d
          AND a.start_d >= DATE_ADD(GREATEST(ba.birth_d, bb.birth_d), INTERVAL {{COHORT_MONTHS}} MONTH)) AS reverse,
  COUNTIF(a.first_d < b.first_d) AS support_all,
  COUNTIF(a.first_d > b.first_d) AS reverse_all,
  COUNTIF(a.first_d = b.first_d) AS ties_all
FROM me a
JOIN me b ON a.uid = b.uid AND a.skill_id < b.skill_id
JOIN birth ba ON ba.skill_id = a.skill_id
JOIN birth bb ON bb.skill_id = b.skill_id
GROUP BY 1, 2
ORDER BY 1, 2
