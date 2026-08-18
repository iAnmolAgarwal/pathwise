-- Stack Exchange Data Explorer (data.stackexchange.com/stackoverflow), run by hand in the
-- browser; the CSV download goes to pipeline/build/so/sede_llm_pairs.csv.
-- Purpose: the BigQuery mirror ends in 2022, so pairs that involve an LLM-era skill
-- (the ai-engineering domain) are re-measured on current data. Scope is kept small for the
-- SEDE time limit: a 5 % user sample (OwnerUserId % 20 = 0) restricted to users who asked at
-- least one LLM-era question; their full mapped-skill history is then reconstructed.
-- Cohort rule as in BigQuery: count a user for pair (A,B) only if their first-ever question
-- is >= COHORT_MONTHS after both technologies existed. Births of pre-2022 skills come from
-- the BigQuery run (<BIRTH_VALUES>); births of LLM-era skills are computed here and the
-- earlier of the two is used.
-- Rendered by: python pipeline/mine_so.py --render-sede
WITH map(tag, skill_id) AS (
  SELECT tag, skill_id FROM (VALUES {{TAG_SKILL_MAP_VALUES}}) v(tag, skill_id)
),
llm_skills(skill_id) AS (
  SELECT skill_id FROM (VALUES {{LLM_SKILLS_VALUES}}) v(skill_id)
),
bq_birth(skill_id, birth_d) AS (
  SELECT skill_id, CAST(birth_d AS DATE) FROM (VALUES {{BIRTH_VALUES}}) v(skill_id, birth_d)
),
tagids AS (
  SELECT t.Id AS TagId, m.skill_id FROM Tags t JOIN map m ON m.tag = t.TagName
),
llm_users AS (
  SELECT DISTINCT p.OwnerUserId AS uid
  FROM Posts p
  JOIN PostTags pt ON pt.PostId = p.Id
  JOIN tagids ti ON ti.TagId = pt.TagId
  JOIN llm_skills ls ON ls.skill_id = ti.skill_id
  WHERE p.PostTypeId = 1 AND p.OwnerUserId IS NOT NULL AND p.OwnerUserId % {{SAMPLE_MOD}} = 0
),
m AS (
  SELECT p.OwnerUserId AS uid, ti.skill_id, MIN(CAST(p.CreationDate AS DATE)) AS first_d
  FROM Posts p
  JOIN llm_users u ON u.uid = p.OwnerUserId
  JOIN PostTags pt ON pt.PostId = p.Id
  JOIN tagids ti ON ti.TagId = pt.TagId
  WHERE p.PostTypeId = 1
  GROUP BY p.OwnerUserId, ti.skill_id
),
u0 AS (
  SELECT p.OwnerUserId AS uid, MIN(CAST(p.CreationDate AS DATE)) AS start_d
  FROM Posts p JOIN llm_users u ON u.uid = p.OwnerUserId
  WHERE p.PostTypeId = 1
  GROUP BY p.OwnerUserId
),
sede_birth AS (
  SELECT ti.skill_id, MIN(CAST(p.CreationDate AS DATE)) AS birth_d
  FROM Posts p
  JOIN PostTags pt ON pt.PostId = p.Id
  JOIN tagids ti ON ti.TagId = pt.TagId
  JOIN llm_skills ls ON ls.skill_id = ti.skill_id
  WHERE p.PostTypeId = 1
  GROUP BY ti.skill_id
),
birth AS (
  SELECT skill_id, MIN(birth_d) AS birth_d FROM (
    SELECT skill_id, birth_d FROM bq_birth
    UNION ALL
    SELECT skill_id, birth_d FROM sede_birth
  ) b GROUP BY skill_id
),
elig AS (
  SELECT uid FROM m GROUP BY uid HAVING COUNT(*) BETWEEN {{MIN_SKILLS}} AND {{MAX_SKILLS}}
),
me AS (
  SELECT m.uid, m.skill_id, m.first_d, u0.start_d
  FROM m JOIN elig e ON e.uid = m.uid JOIN u0 ON u0.uid = m.uid
)
SELECT
  a.skill_id AS s_from,
  b.skill_id AS s_to,
  SUM(CASE WHEN a.first_d < b.first_d
            AND a.start_d >= DATEADD(month, {{COHORT_MONTHS}}, CASE WHEN ba.birth_d > bb.birth_d THEN ba.birth_d ELSE bb.birth_d END)
           THEN 1 ELSE 0 END) AS support,
  SUM(CASE WHEN a.first_d > b.first_d
            AND a.start_d >= DATEADD(month, {{COHORT_MONTHS}}, CASE WHEN ba.birth_d > bb.birth_d THEN ba.birth_d ELSE bb.birth_d END)
           THEN 1 ELSE 0 END) AS reverse,
  SUM(CASE WHEN a.first_d < b.first_d THEN 1 ELSE 0 END) AS support_all,
  SUM(CASE WHEN a.first_d > b.first_d THEN 1 ELSE 0 END) AS reverse_all,
  SUM(CASE WHEN a.first_d = b.first_d THEN 1 ELSE 0 END) AS ties_all
FROM me a
JOIN me b ON a.uid = b.uid AND a.skill_id < b.skill_id
JOIN birth ba ON ba.skill_id = a.skill_id
JOIN birth bb ON bb.skill_id = b.skill_id
WHERE a.skill_id IN (SELECT skill_id FROM llm_skills) OR b.skill_id IN (SELECT skill_id FROM llm_skills)
GROUP BY a.skill_id, b.skill_id
ORDER BY a.skill_id, b.skill_id
