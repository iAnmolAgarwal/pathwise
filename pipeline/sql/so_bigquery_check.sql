-- Reachability / freshness / tag-presence check. Cheap: scans creation_date and the tags table.
-- Rendered by mine_so.py (<TAG_SKILL_MAP>).
WITH tag_skill_map AS (
  SELECT tag, skill_id FROM UNNEST([{{TAG_SKILL_MAP}}])
)
SELECT 'max_creation_date' AS metric, CAST(MAX(creation_date) AS STRING) AS value
FROM `bigquery-public-data.stackoverflow.posts_questions`
UNION ALL
SELECT 'min_creation_date', CAST(MIN(creation_date) AS STRING)
FROM `bigquery-public-data.stackoverflow.posts_questions`
UNION ALL
SELECT 'questions_total', CAST(COUNT(*) AS STRING)
FROM `bigquery-public-data.stackoverflow.posts_questions`
UNION ALL
SELECT 'questions_with_owner', CAST(COUNTIF(owner_user_id IS NOT NULL) AS STRING)
FROM `bigquery-public-data.stackoverflow.posts_questions`
UNION ALL
SELECT CONCAT('tag_count:', t.tag), CAST(COALESCE(tg.count, 0) AS STRING)
FROM tag_skill_map t
LEFT JOIN `bigquery-public-data.stackoverflow.tags` tg ON tg.tag_name = t.tag
ORDER BY metric
