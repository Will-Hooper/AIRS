import { withTranslatedOccupationTitle } from "./occupation-translation.js";

const DATA_URL = "./backend/data/airs_data.json";

let datasetPromise = null;

export class AirsDataUnavailableError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AirsDataUnavailableError";
    this.status = options.status ?? 503;
    this.cause = options.cause;
  }
}

function updatedAtFromDataset(dataset) {
  const lastDate = Array.isArray(dataset?.dates) && dataset.dates.length
    ? dataset.dates[dataset.dates.length - 1]
    : null;
  return lastDate ? `${lastDate}T12:00:00-05:00` : new Date().toISOString();
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value)))];
}

function resolveDate(requestedDate, dates) {
  if (requestedDate && dates.includes(requestedDate)) return requestedDate;
  return dates.length ? dates[dates.length - 1] : "";
}

function resolveRegion(requestedRegion, regions) {
  if (requestedRegion && regions.includes(requestedRegion)) return requestedRegion;
  return regions.includes("National") ? "National" : (regions[0] || "National");
}

function getDatasetMeta(dataset) {
  const dates = uniqueStrings(dataset?.dates);
  const regions = uniqueStrings(dataset?.regions?.length
    ? dataset.regions
    : dataset?.occupations?.flatMap((occupation) => Object.keys(occupation.regions || {})));
  const labels = uniqueStrings(dataset?.labels?.length
    ? dataset.labels
    : dataset?.occupations?.map((occupation) => occupation.label));
  const groups = uniqueStrings(dataset?.groups?.length
    ? dataset.groups
    : dataset?.occupations?.map((occupation) => occupation.majorGroup)).sort();

  return { dates, regions, labels, groups };
}

function regionMetricsFor(occupation, region) {
  if (occupation?.regions?.[region]) return occupation.regions[region];
  if (occupation?.regions?.National) return occupation.regions.National;
  const firstRegion = Object.values(occupation?.regions || {})[0];
  return firstRegion || {};
}

function percentLabel(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function chineseDemandPhrase(summary = "") {
  if (summary.includes("still active")) return "仍然偏活跃";
  if (summary.includes("already weak")) return "已经明显走弱";
  return "处于中性区间";
}

function chineseDriverLabel(row) {
  const pairs = [
    ["replacement", "替代压力"],
    ["augmentation", "岗位改写"],
    ["hiring", "招聘兑现"],
    ["historical", "历史累计渗透"]
  ];

  return pairs
    .map(([key, label]) => ({ key, label, value: Number(row?.[key] || 0) }))
    .sort((a, b) => b.value - a.value)[0]?.label || "综合影响";
}

function extractDemandPercentile(evidence = []) {
  const demandLine = (evidence || []).find((line) => String(line).includes("percentile"));
  const match = demandLine ? String(demandLine).match(/(\d+)%/) : null;
  return match ? `${match[1]}%` : "—";
}

function buildChineseSummary(row, englishSummary) {
  return `该职业当前得分主要受${chineseDriverLabel(row)}影响；相对同类岗位，招聘${chineseDemandPhrase(englishSummary)}。`;
}

function buildChineseEvidence(row, englishEvidence) {
  return [
    `标准化 BLS 职业大类：${row.majorGroup || "Other"}`,
    `当前招聘数：${Number(row.postings || 0)}；同类岗位招聘热度分位：${extractDemandPercentile(englishEvidence)}`,
    `替代压力 ${percentLabel(row.replacement)}，岗位改写 ${percentLabel(row.augmentation)}，招聘兑现 ${percentLabel(row.hiring)}，历史累计渗透 ${percentLabel(row.historical)}。`
  ];
}

function mapJsonOccupation(occupation, region) {
  const metrics = regionMetricsFor(occupation, region);
  const englishSummary = occupation.summary || "";
  const englishEvidence = occupation.evidence || [];
  const zhRow = {
    ...metrics,
    majorGroup: occupation.majorGroup
  };
  const summaryZh = buildChineseSummary(zhRow, englishSummary);
  const evidenceZh = buildChineseEvidence(zhRow, englishEvidence);

  return withTranslatedOccupationTitle({
    socCode: occupation.socCode,
    title: occupation.title,
    titleZh: occupation.titleZh,
    majorGroup: occupation.majorGroup,
    label: occupation.label,
    summary: englishSummary,
    summaryZh: summaryZh || occupation.summaryZh || englishSummary,
    monthlyAirs: occupation.monthlyAirs || [],
    evidence: englishEvidence,
    evidenceZh: evidenceZh.length ? evidenceZh : (occupation.evidenceZh || englishEvidence),
    tasks: occupation.tasks || [],
    regionMetrics: occupation.regions || {},
    ...metrics
  });
}

function applyClientFilters(rows, params = {}) {
  let nextRows = rows.slice();

  if (params.majorGroup && params.majorGroup !== "all") {
    nextRows = nextRows.filter((row) => row.majorGroup === params.majorGroup);
  }
  if (params.label && params.label !== "all") {
    nextRows = nextRows.filter((row) => row.label === params.label);
  }
  if (params.q) {
    const q = String(params.q).trim().toLowerCase();
    nextRows = nextRows.filter((row) =>
      row.title.toLowerCase().includes(q) ||
      (row.titleZh || "").toLowerCase().includes(q) ||
      row.socCode.toLowerCase().includes(q)
    );
  }

  return nextRows;
}

function summarizeRows(rows, updatedAt) {
  return {
    mode: "json",
    source: "json",
    updatedAt,
    avgAirs: rows.reduce((sum, row) => sum + Number(row.airs || 0), 0) / (rows.length || 1),
    highRiskCount: rows.filter((row) => row.label === "high_risk").length,
    occupationCount: rows.length
  };
}

async function loadDataset() {
  if (!datasetPromise) {
    datasetPromise = fetch(DATA_URL, { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) {
          throw new AirsDataUnavailableError(`json request failed: ${response.status}`, { status: response.status });
        }

        const payload = await response.json();
        if (!payload || !Array.isArray(payload.occupations)) {
          throw new AirsDataUnavailableError("invalid json dataset");
        }

        return payload;
      })
      .catch((error) => {
        datasetPromise = null;
        if (error instanceof AirsDataUnavailableError) throw error;
        throw new AirsDataUnavailableError("json request failed", { cause: error });
      });
  }

  return datasetPromise;
}

function buildRows(dataset, params = {}) {
  const meta = getDatasetMeta(dataset);
  const region = resolveRegion(params.region, meta.regions);
  return applyClientFilters(
    dataset.occupations.map((occupation) => mapJsonOccupation(occupation, region)),
    params
  );
}

export async function getSummary(params = {}) {
  const dataset = await loadDataset();
  const updatedAt = updatedAtFromDataset(dataset);
  const rows = buildRows(dataset, params);
  const meta = getDatasetMeta(dataset);

  return {
    ...summarizeRows(rows, updatedAt),
    date: resolveDate(params.date, meta.dates)
  };
}

export async function getOccupations(params = {}) {
  const dataset = await loadDataset();
  const meta = getDatasetMeta(dataset);
  const date = resolveDate(params.date, meta.dates);
  const region = resolveRegion(params.region, meta.regions);
  const occupations = applyClientFilters(
    dataset.occupations.map((occupation) => mapJsonOccupation(occupation, region)),
    params
  );

  return {
    mode: "json",
    source: "json",
    updatedAt: updatedAtFromDataset(dataset),
    date,
    dates: meta.dates,
    regions: meta.regions,
    labels: meta.labels,
    groups: meta.groups,
    occupations
  };
}

export async function getOccupationDetail(socCode, params = {}) {
  const dataset = await loadDataset();
  const meta = getDatasetMeta(dataset);
  const date = resolveDate(params.date, meta.dates);
  const region = resolveRegion(params.region, meta.regions);
  const matched = dataset.occupations.find((occupation) => occupation.socCode === socCode) || dataset.occupations[0];

  return {
    mode: "json",
    source: "json",
    updatedAt: updatedAtFromDataset(dataset),
    date,
    dates: meta.dates,
    regions: meta.regions,
    occupation: mapJsonOccupation(matched, region)
  };
}
