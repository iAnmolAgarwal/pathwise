-- Shared prefix for every BigQuery job in mine_so.py. Rendered by mine_so.py:
--   <TAG_SKILL_MAP>  -> UNNEST([...]) built from pipeline/sources/tag_skill_map.json
--   <MIN_SKILLS>, <MAX_SKILLS>, <COHORT_MONTHS> -> parameters (defaults 2, 40, 12)
-- Signal: for each user, the date of their FIRST question carrying each tag; a skill's
-- first date is the min over its tags. Technology birth = first appearance of any of the
-- skill's tags on the site. Eligible users have between MIN_SKILLS and MAX_SKILLS mapped
-- skills. The cohort predicate (start_d >= birth + COHORT_MONTHS) is applied per pair.
WITH tag_skill_map AS (
  SELECT tag, skill_id FROM UNNEST([{{TAG_SKILL_MAP}}])
),
pq AS (
  SELECT owner_user_id AS uid, DATE(creation_date) AS d, tags
  FROM `bigquery-public-data.stackoverflow.posts_questions`
  WHERE owner_user_id IS NOT NULL
),
u0 AS (
  SELECT uid, MIN(d) AS start_d FROM pq GROUP BY uid
),
q AS (
  SELECT uid, d, tag
  FROM pq, UNNEST(SPLIT(tags, '|')) AS tag
  WHERE tag IN (SELECT tag FROM tag_skill_map)
),
m AS (
  SELECT uid, skill_id, MIN(d) AS first_d
  FROM q JOIN tag_skill_map USING (tag)
  GROUP BY 1, 2
),
birth AS (
  SELECT skill_id, MIN(first_d) AS birth_d FROM m GROUP BY 1
),
elig AS (
  SELECT uid, COUNT(*) AS n_skills
  FROM m GROUP BY uid
  HAVING n_skills BETWEEN {{MIN_SKILLS}} AND {{MAX_SKILLS}}
)
