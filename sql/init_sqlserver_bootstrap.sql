USE master;
GO

IF DB_ID(N'airs') IS NULL
BEGIN
  CREATE DATABASE airs;
END
GO

USE airs;
GO

IF OBJECT_ID(N'dbo.mart_airs_daily_api', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.mart_airs_daily_api (
    dt date NOT NULL,
    region nvarchar(50) NOT NULL,
    soc_code varchar(10) NOT NULL,
    soc_title nvarchar(255) NOT NULL,
    soc_title_zh nvarchar(255) NULL,
    major_group nvarchar(255) NOT NULL,
    label varchar(32) NOT NULL,
    summary_text nvarchar(max) NULL,
    summary_text_zh nvarchar(max) NULL,
    replacement_score float NOT NULL,
    augmentation_score float NOT NULL,
    hiring_realization_score float NOT NULL,
    historical_ai_score float NOT NULL,
    impact_score float NULL,
    airs_score float NOT NULL,
    posting_count int NOT NULL,
    CONSTRAINT PK_mart_airs_daily_api PRIMARY KEY (dt, region, soc_code)
  );
END
GO

IF OBJECT_ID(N'dbo.mart_airs_evidence_api', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.mart_airs_evidence_api (
    dt date NOT NULL,
    region nvarchar(50) NOT NULL,
    soc_code varchar(10) NOT NULL,
    sort_order int NOT NULL,
    evidence_text nvarchar(max) NOT NULL,
    evidence_text_zh nvarchar(max) NULL,
    CONSTRAINT PK_mart_airs_evidence_api PRIMARY KEY (dt, region, soc_code, sort_order)
  );
END
GO

IF OBJECT_ID(N'dbo.mart_airs_task_exposure_api', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.mart_airs_task_exposure_api (
    soc_code varchar(10) NOT NULL,
    task_name nvarchar(255) NOT NULL,
    task_name_zh nvarchar(255) NULL,
    exposure_score float NOT NULL,
    CONSTRAINT PK_mart_airs_task_exposure_api PRIMARY KEY (soc_code, task_name)
  );
END
GO

DELETE FROM dbo.mart_airs_evidence_api;
DELETE FROM dbo.mart_airs_task_exposure_api;
DELETE FROM dbo.mart_airs_daily_api;
GO

DECLARE @Regions TABLE (
  region nvarchar(50) NOT NULL PRIMARY KEY
);

INSERT INTO @Regions (region)
VALUES
  (N'National'),
  (N'West'),
  (N'Midwest'),
  (N'South'),
  (N'Northeast');

DECLARE @OccupationSeed TABLE (
  soc_code varchar(10) NOT NULL PRIMARY KEY,
  soc_title nvarchar(255) NOT NULL,
  soc_title_zh nvarchar(255) NOT NULL,
  major_group nvarchar(255) NOT NULL,
  label varchar(32) NOT NULL,
  summary_text nvarchar(max) NOT NULL,
  summary_text_zh nvarchar(max) NOT NULL,
  replacement_score float NOT NULL,
  augmentation_score float NOT NULL,
  hiring_realization_score float NOT NULL,
  historical_ai_score float NOT NULL
);

INSERT INTO @OccupationSeed (
  soc_code,
  soc_title,
  soc_title_zh,
  major_group,
  label,
  summary_text,
  summary_text_zh,
  replacement_score,
  augmentation_score,
  hiring_realization_score,
  historical_ai_score
)
VALUES
  ('15-1252', N'Software Developers', N'Software Developers', N'Computer and Mathematical', 'augmenting', N'Coding copilots reshape hiring, but firms still recruit for design, review, and product delivery.', N'Coding copilots reshape hiring, but firms still recruit for design, review, and product delivery.', 0.49, 0.88, 0.56, 0.61),
  ('43-9021', N'Data Entry Keyers', N'Data Entry Keyers', N'Office and Administrative Support', 'high_risk', N'OCR, RPA, and generative parsing compress most standard data entry demand.', N'OCR, RPA, and generative parsing compress most standard data entry demand.', 0.94, 0.31, 0.91, 0.84),
  ('43-4051', N'Customer Service Representatives', N'Customer Service Representatives', N'Office and Administrative Support', 'restructuring', N'AI absorbs first-line requests while humans retain escalation and empathy-heavy work.', N'AI absorbs first-line requests while humans retain escalation and empathy-heavy work.', 0.81, 0.57, 0.79, 0.71),
  ('13-2011', N'Accountants and Auditors', N'Accountants and Auditors', N'Business and Financial Operations', 'restructuring', N'Matching and classification automate fast, while judgment and compliance stay human-led.', N'Matching and classification automate fast, while judgment and compliance stay human-led.', 0.68, 0.71, 0.63, 0.58),
  ('29-1141', N'Registered Nurses', N'Registered Nurses', N'Healthcare Practitioners and Technical', 'stable', N'AI supports records and triage, but bedside care and accountability remain human.', N'AI supports records and triage, but bedside care and accountability remain human.', 0.16, 0.38, 0.21, 0.28),
  ('23-1011', N'Lawyers', N'Lawyers', N'Legal', 'light', N'Search, summarization, and drafting accelerate, but representation and liability stay human.', N'Search, summarization, and drafting accelerate, but representation and liability stay human.', 0.34, 0.73, 0.39, 0.49);

DECLARE @NationalSeries TABLE (
  dt date NOT NULL,
  soc_code varchar(10) NOT NULL,
  airs_score float NOT NULL,
  posting_count int NOT NULL
);

INSERT INTO @NationalSeries (dt, soc_code, airs_score, posting_count)
VALUES
  ('2025-04-30', '15-1252', 74, 14200),
  ('2025-05-31', '15-1252', 73, 14080),
  ('2025-06-30', '15-1252', 72, 13920),
  ('2025-07-31', '15-1252', 70, 13700),
  ('2025-08-31', '15-1252', 69, 13580),
  ('2025-09-30', '15-1252', 68, 13460),
  ('2025-10-31', '15-1252', 67, 13380),
  ('2025-11-30', '15-1252', 67, 13280),
  ('2025-12-31', '15-1252', 66, 13190),
  ('2026-01-31', '15-1252', 65, 13080),
  ('2026-02-28', '15-1252', 64, 12920),
  ('2026-03-08', '15-1252', 63, 12840),

  ('2025-04-30', '43-9021', 24, 940),
  ('2025-05-31', '43-9021', 23, 900),
  ('2025-06-30', '43-9021', 22, 860),
  ('2025-07-31', '43-9021', 21, 820),
  ('2025-08-31', '43-9021', 19, 770),
  ('2025-09-30', '43-9021', 18, 720),
  ('2025-10-31', '43-9021', 17, 680),
  ('2025-11-30', '43-9021', 16, 640),
  ('2025-12-31', '43-9021', 15, 610),
  ('2026-01-31', '43-9021', 14, 580),
  ('2026-02-28', '43-9021', 13, 540),
  ('2026-03-08', '43-9021', 12, 510),

  ('2025-04-30', '43-4051', 42, 4580),
  ('2025-05-31', '43-4051', 41, 4510),
  ('2025-06-30', '43-4051', 40, 4450),
  ('2025-07-31', '43-4051', 39, 4390),
  ('2025-08-31', '43-4051', 37, 4300),
  ('2025-09-30', '43-4051', 36, 4230),
  ('2025-10-31', '43-4051', 35, 4170),
  ('2025-11-30', '43-4051', 34, 4110),
  ('2025-12-31', '43-4051', 34, 4060),
  ('2026-01-31', '43-4051', 33, 4010),
  ('2026-02-28', '43-4051', 32, 3970),
  ('2026-03-08', '43-4051', 31, 3920),

  ('2025-04-30', '13-2011', 57, 4520),
  ('2025-05-31', '13-2011', 56, 4470),
  ('2025-06-30', '13-2011', 55, 4420),
  ('2025-07-31', '13-2011', 54, 4380),
  ('2025-08-31', '13-2011', 53, 4340),
  ('2025-09-30', '13-2011', 52, 4300),
  ('2025-10-31', '13-2011', 51, 4260),
  ('2025-11-30', '13-2011', 50, 4220),
  ('2025-12-31', '13-2011', 49, 4190),
  ('2026-01-31', '13-2011', 48, 4180),
  ('2026-02-28', '13-2011', 47, 4170),
  ('2026-03-08', '13-2011', 47, 4160),

  ('2025-04-30', '29-1141', 90, 10120),
  ('2025-05-31', '29-1141', 90, 10060),
  ('2025-06-30', '29-1141', 89, 10010),
  ('2025-07-31', '29-1141', 89, 9970),
  ('2025-08-31', '29-1141', 89, 9920),
  ('2025-09-30', '29-1141', 88, 9870),
  ('2025-10-31', '29-1141', 88, 9790),
  ('2025-11-30', '29-1141', 87, 9710),
  ('2025-12-31', '29-1141', 87, 9650),
  ('2026-01-31', '29-1141', 87, 9570),
  ('2026-02-28', '29-1141', 86, 9460),
  ('2026-03-08', '29-1141', 86, 9380),

  ('2025-04-30', '23-1011', 78, 2980),
  ('2025-05-31', '23-1011', 77, 2940),
  ('2025-06-30', '23-1011', 77, 2910),
  ('2025-07-31', '23-1011', 76, 2890),
  ('2025-08-31', '23-1011', 75, 2860),
  ('2025-09-30', '23-1011', 75, 2840),
  ('2025-10-31', '23-1011', 74, 2810),
  ('2025-11-30', '23-1011', 73, 2790),
  ('2025-12-31', '23-1011', 73, 2770),
  ('2026-01-31', '23-1011', 72, 2760),
  ('2026-02-28', '23-1011', 71, 2750),
  ('2026-03-08', '23-1011', 71, 2740);

INSERT INTO dbo.mart_airs_daily_api (
  dt,
  region,
  soc_code,
  soc_title,
  soc_title_zh,
  major_group,
  label,
  summary_text,
  summary_text_zh,
  replacement_score,
  augmentation_score,
  hiring_realization_score,
  historical_ai_score,
  impact_score,
  airs_score,
  posting_count
)
SELECT
  s.dt,
  r.region,
  o.soc_code,
  o.soc_title,
  o.soc_title_zh,
  o.major_group,
  o.label,
  o.summary_text,
  o.summary_text_zh,
  o.replacement_score,
  o.augmentation_score,
  o.hiring_realization_score,
  o.historical_ai_score,
  CAST(1.0 - (s.airs_score / 100.0) AS float) AS impact_score,
  s.airs_score,
  s.posting_count
FROM @NationalSeries s
JOIN @OccupationSeed o
  ON o.soc_code = s.soc_code
CROSS JOIN @Regions r;

DECLARE @RegionalLatest TABLE (
  dt date NOT NULL,
  region nvarchar(50) NOT NULL,
  soc_code varchar(10) NOT NULL,
  airs_score float NOT NULL,
  replacement_score float NOT NULL,
  augmentation_score float NOT NULL,
  hiring_realization_score float NOT NULL,
  historical_ai_score float NOT NULL,
  posting_count int NOT NULL
);

INSERT INTO @RegionalLatest (
  dt,
  region,
  soc_code,
  airs_score,
  replacement_score,
  augmentation_score,
  hiring_realization_score,
  historical_ai_score,
  posting_count
)
VALUES
  ('2026-03-08', N'West',      '15-1252', 60, 0.52, 0.90, 0.59, 0.61, 4320),
  ('2026-03-08', N'Midwest',   '15-1252', 65, 0.46, 0.84, 0.52, 0.61, 2110),
  ('2026-03-08', N'South',     '15-1252', 64, 0.47, 0.86, 0.54, 0.61, 3890),
  ('2026-03-08', N'Northeast', '15-1252', 62, 0.50, 0.89, 0.57, 0.61, 2520),

  ('2026-03-08', N'West',      '43-9021', 10, 0.95, 0.33, 0.93, 0.84, 122),
  ('2026-03-08', N'Midwest',   '43-9021', 14, 0.92, 0.28, 0.88, 0.84, 96),
  ('2026-03-08', N'South',     '43-9021', 13, 0.93, 0.30, 0.90, 0.84, 189),
  ('2026-03-08', N'Northeast', '43-9021', 11, 0.94, 0.32, 0.92, 0.84, 103),

  ('2026-03-08', N'West',      '43-4051', 28, 0.83, 0.58, 0.81, 0.71, 840),
  ('2026-03-08', N'Midwest',   '43-4051', 34, 0.78, 0.54, 0.74, 0.71, 780),
  ('2026-03-08', N'South',     '43-4051', 30, 0.81, 0.57, 0.80, 0.71, 1560),
  ('2026-03-08', N'Northeast', '43-4051', 32, 0.80, 0.57, 0.77, 0.71, 740),

  ('2026-03-08', N'West',      '13-2011', 45, 0.70, 0.73, 0.65, 0.58, 830),
  ('2026-03-08', N'Midwest',   '13-2011', 50, 0.65, 0.69, 0.60, 0.58, 910),
  ('2026-03-08', N'South',     '13-2011', 48, 0.67, 0.70, 0.62, 0.58, 1500),
  ('2026-03-08', N'Northeast', '13-2011', 46, 0.69, 0.72, 0.64, 0.58, 920),

  ('2026-03-08', N'West',      '29-1141', 85, 0.17, 0.40, 0.23, 0.28, 1880),
  ('2026-03-08', N'Midwest',   '29-1141', 87, 0.15, 0.34, 0.20, 0.28, 2110),
  ('2026-03-08', N'South',     '29-1141', 86, 0.16, 0.37, 0.21, 0.28, 3660),
  ('2026-03-08', N'Northeast', '29-1141', 85, 0.17, 0.39, 0.22, 0.28, 1730),

  ('2026-03-08', N'West',      '23-1011', 69, 0.36, 0.74, 0.41, 0.49, 630),
  ('2026-03-08', N'Midwest',   '23-1011', 73, 0.32, 0.70, 0.36, 0.49, 520),
  ('2026-03-08', N'South',     '23-1011', 72, 0.33, 0.72, 0.38, 0.49, 810),
  ('2026-03-08', N'Northeast', '23-1011', 70, 0.35, 0.74, 0.40, 0.49, 780);

UPDATE d
SET
  d.replacement_score = r.replacement_score,
  d.augmentation_score = r.augmentation_score,
  d.hiring_realization_score = r.hiring_realization_score,
  d.historical_ai_score = r.historical_ai_score,
  d.impact_score = CAST(1.0 - (r.airs_score / 100.0) AS float),
  d.airs_score = r.airs_score,
  d.posting_count = r.posting_count
FROM dbo.mart_airs_daily_api d
JOIN @RegionalLatest r
  ON r.dt = d.dt
 AND r.region = d.region
 AND r.soc_code = d.soc_code;

DECLARE @EvidenceSeed TABLE (
  soc_code varchar(10) NOT NULL,
  sort_order int NOT NULL,
  evidence_text nvarchar(max) NOT NULL,
  evidence_text_zh nvarchar(max) NOT NULL
);

INSERT INTO @EvidenceSeed (soc_code, sort_order, evidence_text, evidence_text_zh)
VALUES
  ('15-1252', 1, N'Mentions of copilots, LLMs, and AI-assisted coding keep rising.', N'Mentions of copilots, LLMs, and AI-assisted coding keep rising.'),
  ('15-1252', 2, N'Entry-level coding output matters less than architecture and review quality.', N'Entry-level coding output matters less than architecture and review quality.'),
  ('15-1252', 3, N'Junior slots shrink faster than senior engineering roles.', N'Junior slots shrink faster than senior engineering roles.'),

  ('43-9021', 1, N'Document extraction and form-fill automation replaced standard entry work.', N'Document extraction and form-fill automation replaced standard entry work.'),
  ('43-9021', 2, N'New hiring is mostly for exception handling instead of persistent input labor.', N'New hiring is mostly for exception handling instead of persistent input labor.'),
  ('43-9021', 3, N'Basic input duties are folded into broader operations roles.', N'Basic input duties are folded into broader operations roles.'),

  ('43-4051', 1, N'Tier-one answers route to AI agents more often.', N'Tier-one answers route to AI agents more often.'),
  ('43-4051', 2, N'Human roles focus on escalations, churn prevention, and QA review.', N'Human roles focus on escalations, churn prevention, and QA review.'),
  ('43-4051', 3, N'Knowledge-base operations become a core hybrid function.', N'Knowledge-base operations become a core hybrid function.'),

  ('13-2011', 1, N'Automated reconciliation and anomaly detection appear in more finance JDs.', N'Automated reconciliation and anomaly detection appear in more finance JDs.'),
  ('13-2011', 2, N'Higher-value judgment and regulator-facing work still need people.', N'Higher-value judgment and regulator-facing work still need people.'),
  ('13-2011', 3, N'Shared-service teams keep compressing low-complexity work.', N'Shared-service teams keep compressing low-complexity work.'),

  ('29-1141', 1, N'AI is used for charting, reminders, and early risk alerts.', N'AI is used for charting, reminders, and early risk alerts.'),
  ('29-1141', 2, N'Bedside care and patient trust still require direct human presence.', N'Bedside care and patient trust still require direct human presence.'),
  ('29-1141', 3, N'Hiring volume is driven more by care demand than AI substitution.', N'Hiring volume is driven more by care demand than AI substitution.'),

  ('23-1011', 1, N'Search and summarization cycles are shorter, but final responsibility is unchanged.', N'Search and summarization cycles are shorter, but final responsibility is unchanged.'),
  ('23-1011', 2, N'Firms increasingly hire for legal expertise plus AI governance fluency.', N'Firms increasingly hire for legal expertise plus AI governance fluency.'),
  ('23-1011', 3, N'Demand skews toward analysis and client communication.', N'Demand skews toward analysis and client communication.');

INSERT INTO dbo.mart_airs_evidence_api (
  dt,
  region,
  soc_code,
  sort_order,
  evidence_text,
  evidence_text_zh
)
SELECT
  s.dt,
  r.region,
  e.soc_code,
  e.sort_order,
  e.evidence_text,
  e.evidence_text_zh
FROM (SELECT DISTINCT dt FROM @NationalSeries) s
CROSS JOIN @Regions r
JOIN @EvidenceSeed e
  ON 1 = 1;

INSERT INTO dbo.mart_airs_task_exposure_api (
  soc_code,
  task_name,
  task_name_zh,
  exposure_score
)
VALUES
  ('15-1252', N'Coding', N'Coding', 0.82),
  ('15-1252', N'Code review', N'Code review', 0.55),
  ('15-1252', N'System design', N'System design', 0.29),
  ('15-1252', N'Cross-team alignment', N'Cross-team alignment', 0.22),

  ('43-9021', N'Structured input', N'Structured input', 0.97),
  ('43-9021', N'Error checking', N'Error checking', 0.52),
  ('43-9021', N'Formatting', N'Formatting', 0.89),
  ('43-9021', N'System transfer', N'System transfer', 0.91),

  ('43-4051', N'Standard answers', N'Standard answers', 0.90),
  ('43-4051', N'Complaint handling', N'Complaint handling', 0.38),
  ('43-4051', N'Emotion management', N'Emotion management', 0.29),
  ('43-4051', N'Escalation', N'Escalation', 0.44),

  ('13-2011', N'Classification', N'Classification', 0.88),
  ('13-2011', N'Exception review', N'Exception review', 0.58),
  ('13-2011', N'Compliance judgment', N'Compliance judgment', 0.34),
  ('13-2011', N'Regulator communication', N'Regulator communication', 0.19),

  ('29-1141', N'Documentation', N'Documentation', 0.56),
  ('29-1141', N'Bedside care', N'Bedside care', 0.12),
  ('29-1141', N'Patient communication', N'Patient communication', 0.18),
  ('29-1141', N'Order execution', N'Order execution', 0.21),

  ('23-1011', N'Case search', N'Case search', 0.79),
  ('23-1011', N'Drafting', N'Drafting', 0.72),
  ('23-1011', N'Court representation', N'Court representation', 0.14),
  ('23-1011', N'Client strategy', N'Client strategy', 0.26);

SELECT
  COUNT(*) AS daily_rows,
  MIN(dt) AS earliest_dt,
  MAX(dt) AS latest_dt
FROM dbo.mart_airs_daily_api;

SELECT COUNT(*) AS evidence_rows
FROM dbo.mart_airs_evidence_api;

SELECT COUNT(*) AS task_rows
FROM dbo.mart_airs_task_exposure_api;
