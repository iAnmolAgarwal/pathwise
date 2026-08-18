-- Immediate successors: for each eligible user, order skills by first date; every skill on
-- the NEXT DISTINCT date is a successor of every skill on the current date. Same-day ties
-- (from and to on one date) are unordered and never counted. Cohort predicate as for pairs.
{{COMMON}}
, d AS (
  SELECT DISTINCT m.uid, m.first_d FROM m JOIN elig USING (uid)
),
nd AS (
  SELECT uid, first_d, LEAD(first_d) OVER (PARTITION BY uid ORDER BY first_d) AS next_d FROM d
),
tr AS (
  SELECT a.uid, a.skill_id AS s_from, b.skill_id AS s_to, u0.start_d
  FROM m a
  JOIN nd ON nd.uid = a.uid AND nd.first_d = a.first_d
  JOIN m b ON b.uid = a.uid AND b.first_d = nd.next_d
  JOIN u0 ON u0.uid = a.uid
)
SELECT
  s_from, s_to,
  COUNTIF(start_d >= DATE_ADD(GREATEST(ba.birth_d, bb.birth_d), INTERVAL {{COHORT_MONTHS}} MONTH)) AS n,
  COUNT(*) AS n_all
FROM tr
JOIN birth ba ON ba.skill_id = s_from
JOIN birth bb ON bb.skill_id = s_to
GROUP BY 1, 2
ORDER BY 1, 2
