-- Per-skill coverage: birth date, users with the skill (all / eligible), plus totals.
{{COMMON}}
SELECT
  m.skill_id,
  CAST(birth.birth_d AS STRING) AS birth_d,
  COUNT(DISTINCT m.uid) AS users_all,
  COUNT(DISTINCT IF(elig.uid IS NULL, NULL, m.uid)) AS users_eligible
FROM m
JOIN birth USING (skill_id)
LEFT JOIN elig USING (uid)
GROUP BY 1, 2
UNION ALL
SELECT '_users_with_any_mapped_skill', NULL, COUNT(DISTINCT uid), 0 FROM m
UNION ALL
SELECT '_users_eligible', NULL, 0, COUNT(*) FROM elig
UNION ALL
SELECT '_users_with_questions', NULL, COUNT(*), 0 FROM u0
ORDER BY 1
