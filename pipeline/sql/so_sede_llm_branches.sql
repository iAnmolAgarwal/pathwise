-- SEDE companion of so_sede_llm_pairs.sql: immediate successors (next distinct date) for the
-- same sampled LLM-era users, kept only where the FROM or TO skill is LLM-era.
-- CSV download goes to pipeline/build/so/sede_llm_branches.csv.
-- Cost control (SEDE time limit): LLM-era users and LLM-era births are found only among posts
-- with Id >= MIN_POST_ID (the clustered key; ~Aug 2022, just before the mirror ends), which
-- is a range seek instead of a full PostTags scan; each such user's full history is then read
-- through the OwnerUserId index. Only the LLM-era tag ids are matched in that first step.
-- Rendered by: python pipeline/mine_so.py render-sede
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
llm_tagids AS (
  SELECT ti.TagId, ti.skill_id FROM tagids ti JOIN llm_skills ls ON ls.skill_id = ti.skill_id
),
recent AS (
  SELECT p.Id, p.OwnerUserId, p.CreationDate
  FROM Posts p
  WHERE p.Id >= {{MIN_POST_ID}} AND p.PostTypeId = 1 AND p.OwnerUserId IS NOT NULL
),
llm_users AS (
  SELECT DISTINCT r.OwnerUserId AS uid
  FROM recent r
  JOIN PostTags pt ON pt.PostId = r.Id
  JOIN llm_tagids ti ON ti.TagId = pt.TagId
  WHERE r.OwnerUserId % {{SAMPLE_MOD}} = 0
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
  SELECT ti.skill_id, MIN(CAST(r.CreationDate AS DATE)) AS birth_d
  FROM recent r
  JOIN PostTags pt ON pt.PostId = r.Id
  JOIN llm_tagids ti ON ti.TagId = pt.TagId
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
d AS (
  SELECT DISTINCT m.uid, m.first_d FROM m JOIN elig e ON e.uid = m.uid
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
  SUM(CASE WHEN start_d >= DATEADD(month, {{COHORT_MONTHS}}, CASE WHEN ba.birth_d > bb.birth_d THEN ba.birth_d ELSE bb.birth_d END)
           THEN 1 ELSE 0 END) AS n,
  COUNT(*) AS n_all
FROM tr
JOIN birth ba ON ba.skill_id = s_from
JOIN birth bb ON bb.skill_id = s_to
WHERE s_from IN (SELECT skill_id FROM llm_skills) OR s_to IN (SELECT skill_id FROM llm_skills)
GROUP BY s_from, s_to
ORDER BY s_from, s_to
