-- Current list backing query (SQL Server syntax)
SELECT
  CONVERT(varchar(10), dt, 23) AS dt,
  region,
  soc_code AS socCode,
  soc_title AS title,
  COALESCE(soc_title_zh, soc_title) AS titleZh,
  major_group AS majorGroup,
  label,
  summary_text AS summary,
  COALESCE(summary_text_zh, summary_text) AS summaryZh,
  CAST(airs_score AS float) AS airs,
  CAST(replacement_score AS float) AS replacement,
  CAST(augmentation_score AS float) AS augmentation,
  CAST(hiring_realization_score AS float) AS hiring,
  CAST(historical_ai_score AS float) AS historical,
  CAST(posting_count AS int) AS postings
FROM mart_airs_daily_api
WHERE dt = @date
  AND (@region = 'all' OR region = @region)
  AND (@majorGroup = 'all' OR major_group = @majorGroup)
  AND (@label = 'all' OR label = @label)
  AND (
    @q = ''
    OR LOWER(soc_code) LIKE '%' + LOWER(@q) + '%'
    OR LOWER(soc_title) LIKE '%' + LOWER(@q) + '%'
    OR LOWER(COALESCE(soc_title_zh, '')) LIKE '%' + LOWER(@q) + '%'
  )
ORDER BY airs_score ASC, soc_code ASC;

-- 12-month series backing query for all filtered occupations
WITH monthly AS (
  SELECT
    soc_code,
    DATEFROMPARTS(YEAR(dt), MONTH(dt), 1) AS month_start,
    AVG(CAST(airs_score AS float)) AS airs
  FROM mart_airs_daily_api
  WHERE dt <= @date
    AND (@region = 'all' OR region = @region)
    AND soc_code IN (@soc0, @soc1)
  GROUP BY soc_code, DATEFROMPARTS(YEAR(dt), MONTH(dt), 1)
),
ranked AS (
  SELECT
    soc_code AS socCode,
    month_start,
    airs,
    ROW_NUMBER() OVER (PARTITION BY soc_code ORDER BY month_start DESC) AS rn
  FROM monthly
)
SELECT
  socCode,
  CONVERT(varchar(10), month_start, 23) AS monthStart,
  airs
FROM ranked
WHERE rn <= 12
ORDER BY socCode ASC, monthStart ASC;

-- Detail evidence backing query
SELECT
  evidence_text AS evidence,
  COALESCE(evidence_text_zh, evidence_text) AS evidenceZh
FROM mart_airs_evidence_api
WHERE dt = @date
  AND (@region = 'all' OR region = @region)
  AND soc_code = @socCode
ORDER BY sort_order ASC, evidence_text ASC;

-- Detail task exposure backing query
SELECT
  task_name AS name,
  COALESCE(task_name_zh, task_name) AS nameZh,
  CAST(exposure_score AS float) AS score
FROM mart_airs_task_exposure_api
WHERE soc_code = @socCode
ORDER BY exposure_score DESC, task_name ASC;
