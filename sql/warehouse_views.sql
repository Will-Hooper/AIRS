-- API-facing example views for the AIRS website.
-- Adjust source table names and translation joins to match your warehouse.

CREATE OR ALTER VIEW mart_airs_daily_api AS
SELECT
  f.dt,
  f.region,
  f.soc_code,
  s.soc_title,
  CAST(NULL AS NVARCHAR(255)) AS soc_title_zh,
  s.major_group_title AS major_group,
  f.label,
  f.summary_text,
  CAST(NULL AS NVARCHAR(MAX)) AS summary_text_zh,
  f.replacement_score,
  f.augmentation_score,
  f.hiring_realization_score,
  f.historical_ai_score,
  f.impact_score,
  f.airs_score,
  f.posting_count
FROM occupation_daily_features f
JOIN dim_soc_occupation s
  ON s.soc_code = f.soc_code;

CREATE OR ALTER VIEW mart_airs_evidence_api AS
SELECT
  e.dt,
  e.region,
  e.soc_code,
  e.sort_order,
  e.evidence_text,
  CAST(NULL AS NVARCHAR(MAX)) AS evidence_text_zh
FROM occupation_evidence_daily e;

CREATE OR ALTER VIEW mart_airs_task_exposure_api AS
SELECT
  t.soc_code,
  t.task_name,
  CAST(NULL AS NVARCHAR(255)) AS task_name_zh,
  t.exposure_score
FROM occupation_task_exposure t;
