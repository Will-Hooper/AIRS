import { translateOccupationTitle, withTranslatedOccupationTitle } from "./occupation-translation.js";

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

const SEARCH_CJK_RE = /[\u3400-\u9fff]/;

const MAJOR_GROUP_ZH = new Map([
  ["Management", "管理"],
  ["Business and Financial Operations", "商业与财务运营"],
  ["Computer and Mathematical", "计算机与数学"],
  ["Architecture and Engineering", "建筑与工程"],
  ["Life, Physical, and Social Science", "生命、物理与社会科学"],
  ["Community and Social Service", "社区与社会服务"],
  ["Legal", "法律"],
  ["Educational Instruction and Library", "教育与图书馆"],
  ["Arts, Design, Entertainment, Sports, and Media", "艺术、设计、娱乐、体育与媒体"],
  ["Healthcare Practitioners and Technical", "医疗专业与技术"],
  ["Healthcare Support", "医疗支持"],
  ["Protective Service", "保护服务"],
  ["Food Preparation and Serving Related", "餐饮制备与服务"],
  ["Building and Grounds Cleaning and Maintenance", "楼宇与场地清洁维护"],
  ["Personal Care and Service", "个人护理与服务"],
  ["Sales and Related", "销售及相关"],
  ["Office and Administrative Support", "办公室与行政支持"],
  ["Farming, Fishing, and Forestry", "农业、渔业与林业"],
  ["Construction and Extraction", "建筑与采掘"],
  ["Installation, Maintenance, and Repair", "安装、维护与维修"],
  ["Production", "生产制造"],
  ["Transportation and Material Moving", "运输与物料搬运"],
  ["Military Specific Occupations", "军事特定职业"],
  ["Other", "其他"]
]);

const SEARCH_ALIAS_RULES = [
  {
    pattern: /computer science|data science|information technology management|information technology student trainee|information technology|computer clerk/i,
    aliases: ["程序员", "软件工程师", "开发", "开发工程师", "前端", "后端", "算法", "数据分析", "数据岗", "信息技术", "计算机", "码农", "IT"]
  },
  {
    pattern: /management and program analysis|program management|information technology management|support services administration/i,
    aliases: ["产品经理", "项目经理", "项目管理", "项目专员"]
  },
  {
    pattern: /support services administration|logistics management|transportation operations|facility operations services|social insurance administration/i,
    aliases: ["运营", "运营经理"]
  },
  {
    pattern: /interior design|visual information|illustrat/i,
    aliases: ["设计师", "平面设计", "视觉设计", "插画师", "美工", "UI设计"]
  },
  {
    pattern: /public affairs|government information|writing and editing|visual information|audiovisual production/i,
    aliases: ["编辑", "文案", "记者", "媒体", "传媒", "公关", "新媒体", "媒体运营", "传播", "策划"]
  },
  {
    pattern: /music specialist|theater specialist|museum specialist|general arts and information|audiovisual production/i,
    aliases: ["艺术", "文娱", "演艺", "展馆", "博物馆"]
  },
  {
    pattern: /sports specialist|recreation specialist|recreation aid/i,
    aliases: ["体育", "康乐", "文体"]
  },
  {
    pattern: /contact representative/i,
    aliases: ["客服", "客户服务", "客诉", "呼叫中心"]
  },
  {
    pattern: /administrative officer|mail and file|secretary|passport and visa examining|office automation|financial clerical|administration and office support/i,
    aliases: ["行政", "文员", "前台", "内勤", "办公室", "行政助理"]
  },
  {
    pattern: /account|budget|finance|financial|purchasing|procurement|property disposal|contracting|accounting/i,
    aliases: ["财务", "会计", "出纳", "审计", "预算", "采购", "招采", "合同管理", "商务"]
  },
  {
    pattern: /legal|attorney|paralegal|law/i,
    aliases: ["法务", "律师", "法律", "法务专员", "合规法务"]
  },
  {
    pattern: /teacher|education|training|instructional|library|librarian/i,
    aliases: ["老师", "教师", "讲师", "培训", "教培", "教育", "图书馆"]
  },
  {
    pattern: /practical nurse|nursing assistant|nurse/i,
    aliases: ["护士", "护理", "护工"]
  },
  {
    pattern: /medical|health|physician|therap|pharmacist|dental|radiologic|laboratory|optometrist|audiology/i,
    aliases: ["医生", "药师", "医技", "医疗", "康复", "治疗师", "临床", "口腔", "检验"]
  },
  {
    pattern: /mechanic|maintenance|repair|electrician|machining|equipment mechanic|industrial equipment|technician/i,
    aliases: ["机械", "维修", "机修", "技工", "设备", "机电", "电工", "维护"]
  },
  {
    pattern: /security guard|security administration|police|investigation|border patrol|fire|ranger|protective/i,
    aliases: ["保安", "安保", "警察", "警务", "执法", "调查", "消防", "巡逻"]
  },
  {
    pattern: /transportation specialist|materials handler|packing|logistics management|inventory management|store working|warehousing|transportation/i,
    aliases: ["物流", "仓储", "运输", "配送", "分拣", "搬运", "调度", "仓管", "物料", "仓库管理员"]
  },
  {
    pattern: /chemistry|physics|meteorology|biology|social science|economics|geography|history|intelligence|foreign affairs|industrial hygiene/i,
    aliases: ["研究员", "科研", "科学家", "理科", "社会科学", "经济学", "情报", "外交", "研究岗"]
  },
  {
    pattern: /construction|carpentry|masonry|plumbing|welding|rigging|drill rig/i,
    aliases: ["施工", "建筑", "土建", "焊工", "水电", "木工", "装修", "工地"]
  },
  {
    pattern: /food|cooking|waiter|bartending|meatcutting/i,
    aliases: ["餐饮", "厨师", "服务员", "酒吧", "后厨", "餐服"]
  },
  {
    pattern: /student trainee|trainee/i,
    aliases: ["实习生", "见习岗", "校招"]
  }
];

const QUERY_EXPANSION_RULES = [
  { pattern: /程序员|软件工程师|开发|前端|后端|码农|算法|it/i, terms: ["computer", "software", "information technology", "data science", "信息技术", "计算机"] },
  { pattern: /产品经理|项目经理|项目管理/i, terms: ["program management", "management and program analysis", "information technology management", "项目管理", "项目分析"] },
  { pattern: /运营/i, terms: ["support services administration", "transportation operations", "facility operations services", "logistics management", "运营"] },
  { pattern: /设计师|平面设计|视觉设计|插画|美工|ui/i, terms: ["design", "visual information", "illustrating", "interior design", "设计"] },
  { pattern: /编辑|文案|记者/i, terms: ["writing and editing", "public affairs", "government information", "editing", "媒体"] },
  { pattern: /公关|新媒体|媒体运营|传媒/i, terms: ["public affairs", "government information", "audiovisual production", "visual information", "media"] },
  { pattern: /客服|客户服务|前台|内勤/i, terms: ["contact representative", "office", "administrative", "passport and visa examining", "联络代表"] },
  { pattern: /法务|律师|法律/i, terms: ["legal", "attorney", "paralegal", "法律"] },
  { pattern: /护士|护理/i, terms: ["nurse", "nursing assistant", "practical nurse", "护理"] },
  { pattern: /医生|医疗|医技|药师|检验/i, terms: ["medical", "health", "pharmacist", "laboratory", "therapist", "医疗"] },
  { pattern: /保安|安保|警察|消防|执法/i, terms: ["security guard", "security administration", "police", "protective", "fire"] },
  { pattern: /物流|仓储|仓库管理员|仓管|配送|分拣|搬运/i, terms: ["logistics", "materials handler", "packing", "inventory management", "warehouse", "transportation"] },
  { pattern: /老师|教师|讲师|培训/i, terms: ["education", "instructional", "training", "librarian", "teacher"] },
  { pattern: /采购|招采|合同/i, terms: ["purchasing", "procurement", "contracting", "property disposal"] },
  { pattern: /科研|研究员|科学家/i, terms: ["science", "research", "physics", "chemistry", "biology", "economics", "psychology"] }
];

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u3400-\u9fff\s/-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/[\s/-]+/g, "");
}

function tokenizeSearchText(value) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

function containsCjk(value) {
  return SEARCH_CJK_RE.test(String(value || ""));
}

function makeBigrams(value) {
  const text = compactSearchText(value);
  if (!text) return [];
  if (text.length === 1) return [text];
  const grams = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    grams.push(text.slice(index, index + 2));
  }
  return grams;
}

function diceCoefficient(a, b) {
  const left = makeBigrams(a);
  const right = makeBigrams(b);
  if (!left.length || !right.length) return 0;

  const counts = new Map();
  left.forEach((gram) => counts.set(gram, (counts.get(gram) || 0) + 1));

  let overlap = 0;
  right.forEach((gram) => {
    const count = counts.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  });

  return (2 * overlap) / (left.length + right.length);
}

function tokenOverlapScore(query, candidate) {
  const queryTokens = tokenizeSearchText(query);
  const candidateTokens = tokenizeSearchText(candidate);
  if (!queryTokens.length || !candidateTokens.length) return 0;

  let matches = 0;
  queryTokens.forEach((queryToken) => {
    if (candidateTokens.some((candidateToken) => candidateToken.includes(queryToken) || queryToken.includes(candidateToken))) {
      matches += 1;
    }
  });

  return matches / queryTokens.length;
}

function scoreSearchValue(query, candidate) {
  const queryNormalized = normalizeSearchText(query);
  const candidateNormalized = normalizeSearchText(candidate);
  const queryCompact = compactSearchText(query);
  const candidateCompact = compactSearchText(candidate);

  if (!queryCompact || !candidateCompact) return 0;

  let score = 0;

  if (queryCompact === candidateCompact) {
    score = Math.max(score, 240);
  } else if (candidateCompact.startsWith(queryCompact)) {
    score = Math.max(score, Math.max(170, 215 - Math.max(0, candidateCompact.length - queryCompact.length) * 3));
  } else if (candidateCompact.includes(queryCompact)) {
    score = Math.max(score, Math.max(130, 190 - Math.max(0, candidateCompact.length - queryCompact.length) * 2));
  } else if (queryCompact.length >= 3 && queryCompact.includes(candidateCompact)) {
    score = Math.max(score, Math.max(90, 150 - Math.max(0, queryCompact.length - candidateCompact.length) * 4));
  }

  const overlap = tokenOverlapScore(queryNormalized, candidateNormalized);
  if (overlap > 0) {
    score = Math.max(score, overlap * 110);
  }

  const similarity = diceCoefficient(queryCompact, candidateCompact);
  if (similarity > 0) {
    const multiplier = containsCjk(query) || containsCjk(candidate) ? 115 : 92;
    score = Math.max(score, similarity * multiplier);
  }

  return score;
}

function buildSearchAliases(row) {
  const aliases = new Set([
    row.socCode,
    row.title,
    row.titleZh,
    translateOccupationTitle(row.title)
  ]);

  const corpus = [row.title, row.titleZh]
    .filter(Boolean)
    .join(" ");

  SEARCH_ALIAS_RULES.forEach((rule) => {
    if (rule.pattern.test(corpus)) {
      rule.aliases.forEach((alias) => aliases.add(alias));
    }
  });

  return uniqueStrings([
    ...aliases,
    ...[...aliases].map((value) => normalizeSearchText(value)),
    ...[...aliases].map((value) => compactSearchText(value))
  ]);
}

function expandSearchQueries(query) {
  const values = [query];
  QUERY_EXPANSION_RULES.forEach((rule) => {
    if (rule.pattern.test(String(query || ""))) {
      values.push(...rule.terms);
    }
  });

  return uniqueStrings([
    ...values,
    ...values.map((value) => normalizeSearchText(value)),
    ...values.map((value) => compactSearchText(value))
  ]);
}

function rankRowsByQuery(rows, query) {
  const queryCandidates = expandSearchQueries(query);
  const scored = rows
    .map((row) => ({
      row,
      score: Math.max(
        ...queryCandidates.flatMap((queryCandidate) => (row.searchIndex || []).map((candidate) => scoreSearchValue(queryCandidate, candidate))),
        0
      )
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score - left.score ||
      Number(right.row.airs || 0) - Number(left.row.airs || 0) ||
      Number(right.row.postings || 0) - Number(left.row.postings || 0) ||
      String(left.row.title).localeCompare(String(right.row.title))
    );

  if (!scored.length) return [];

  const bestScore = scored[0].score;
  const minScore = bestScore >= 180
    ? Math.max(110, bestScore * 0.5)
    : bestScore >= 120
      ? Math.max(72, bestScore * 0.5)
      : bestScore >= 70
        ? Math.max(36, bestScore * 0.5)
        : 18;

  const filtered = scored.filter((entry) => entry.score >= minScore).slice(0, 24);
  const fallback = filtered.length ? filtered : scored.slice(0, 8);
  return fallback.map((entry) => entry.row);
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

  const row = withTranslatedOccupationTitle({
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

  return {
    ...row,
    searchIndex: buildSearchAliases(row)
  };
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
    nextRows = rankRowsByQuery(nextRows, params.q);
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
