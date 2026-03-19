import {
  clampUnit,
  getRowValue,
  getTextTokens,
  getTokenSimilarity,
  normalizeText,
  normalizeTitleKey,
  readJsonFile,
  readTabFile,
  toDoubleSafe,
  toIntSafe,
  writeStep
} from "./common";

export interface OnetTask {
  id: string;
  text: string;
  importance: number;
  relevance: number;
}

export interface OnetTechnologySkill {
  title: string;
  hot: boolean;
  inDemand: boolean;
}

export interface OnetOccupation {
  code: string;
  title: string;
  description: string;
  tasks: OnetTask[];
  technologySkills: OnetTechnologySkill[];
  jobZone: number;
}

export interface OnetTitleCandidate {
  code: string;
  title: string;
  normalizedTitle: string;
  tokens: string[];
  source: string;
}

export interface OnetData {
  available: boolean;
  sourceDir: string;
  occupations: Record<string, OnetOccupation>;
  titleIndex: Record<string, OnetTitleCandidate[]>;
  titleCandidates: OnetTitleCandidate[];
  manualMap: Record<string, string>;
}

export interface OnetMatch {
  occupation: OnetOccupation;
  score: number;
  source: string;
  matchedTitle: string;
}

export interface DetailedSocOccupation extends OnetOccupation {
  majorGroup: string;
}

export interface DetailedSocCandidate {
  code: string;
  title: string;
  normalizedTitle: string;
  tokens: string[];
  source: string;
}

export interface OnetProfile {
  replacement: number;
  augmentation: number;
  human: number;
  historical: number;
  source: string;
  taskCount: number;
  techCount: number;
  onetCode: string;
  onetTitle: string;
  matchScore: number;
  matchSource: string;
}

export interface HeuristicProfile extends OnetProfile {}

const SOC_MAJOR_GROUP_BY_PREFIX: Record<string, string> = {
  "11": "Management",
  "13": "Business and Financial Operations",
  "15": "Computer and Mathematical",
  "17": "Architecture and Engineering",
  "19": "Life, Physical, and Social Science",
  "21": "Community and Social Service",
  "23": "Legal",
  "25": "Educational Instruction and Library",
  "27": "Arts, Design, Entertainment, Sports, and Media",
  "29": "Healthcare Practitioners and Technical",
  "31": "Healthcare Support",
  "33": "Protective Service",
  "35": "Food Preparation and Serving Related",
  "37": "Building and Grounds Cleaning and Maintenance",
  "39": "Personal Care and Service",
  "41": "Sales and Related",
  "43": "Office and Administrative Support",
  "45": "Farming, Fishing, and Forestry",
  "47": "Construction and Extraction",
  "49": "Installation, Maintenance, and Repair",
  "51": "Production",
  "53": "Transportation and Material Moving",
  "55": "Military Specific Occupations"
};

function newEmptyOnetData(sourceDir: string): OnetData {
  return {
    available: false,
    sourceDir,
    occupations: {},
    titleIndex: {},
    titleCandidates: [],
    manualMap: {}
  };
}

function addOnetTitleCandidate(onet: OnetData, code: string, title: string, source = "occupation") {
  if (!code || !title) return;
  const normalizedTitle = normalizeTitleKey(title);
  if (!normalizedTitle) return;

  const candidate: OnetTitleCandidate = {
    code,
    title,
    normalizedTitle,
    tokens: getTextTokens(title),
    source
  };

  onet.titleCandidates.push(candidate);
  if (!onet.titleIndex[normalizedTitle]) {
    onet.titleIndex[normalizedTitle] = [];
  }
  onet.titleIndex[normalizedTitle].push(candidate);
}

export function toDetailedSocCode(code: string | undefined | null) {
  if (!code) return "";
  return String(code).replace(/\.\d{2}$/, ".00");
}

export function getSocMajorGroupFromCode(code: string | undefined | null) {
  const prefix = String(code || "").slice(0, 2);
  return SOC_MAJOR_GROUP_BY_PREFIX[prefix] || "Other";
}

export async function loadOnetData(dir: string): Promise<OnetData> {
  const onet = newEmptyOnetData(dir);

  writeStep(`Loading O*NET occupation data from ${dir}`);
  const occupationRows = await readTabFile(`${dir}\\Occupation Data.txt`);
  if (!occupationRows.length) {
    return onet;
  }

  writeStep("Loading O*NET task statements");
  const taskRows = await readTabFile(`${dir}\\Task Statements.txt`);
  writeStep("Loading O*NET task ratings");
  const taskRatingRows = await readTabFile(`${dir}\\Task Ratings.txt`);
  writeStep("Loading O*NET technology skills");
  const technologyRows = await readTabFile(`${dir}\\Technology Skills.txt`);
  writeStep("Loading O*NET job zones");
  const jobZoneRows = await readTabFile(`${dir}\\Job Zones.txt`);
  writeStep("Loading O*NET sample titles");
  const sampleTitleRows = await readTabFile(`${dir}\\Sample of Reported Titles.txt`);

  const manualMap = await readJsonFile<Record<string, string>>(`${dir}\\series_to_onet.json`);
  onet.manualMap = { ...(manualMap || {}) };

  const jobZonesByCode: Record<string, number> = {};
  for (const row of jobZoneRows) {
    const code = getRowValue(row, ["O*NET-SOC Code", "O*NET-SOC Code "]);
    if (!code) continue;
    jobZonesByCode[code] = toIntSafe(getRowValue(row, ["Job Zone", "Job Zone "], "0"), 0);
  }

  const taskRatingsByKey: Record<string, Record<string, number>> = {};
  for (const row of taskRatingRows) {
    const code = getRowValue(row, ["O*NET-SOC Code", "O*NET-SOC Code "]);
    const taskId = getRowValue(row, ["Task ID", "Task ID "]);
    const scaleId = getRowValue(row, ["Scale ID", "Scale ID "]);
    if (!code || !taskId || !scaleId) continue;
    const key = `${code}|${taskId}`;
    taskRatingsByKey[key] ??= {};
    taskRatingsByKey[key][scaleId] = toDoubleSafe(getRowValue(row, ["Data Value", "Data Value "], "0"), 0);
  }

  const tasksByCode: Record<string, OnetTask[]> = {};
  for (const row of taskRows) {
    const code = getRowValue(row, ["O*NET-SOC Code", "O*NET-SOC Code "]);
    const taskId = getRowValue(row, ["Task ID", "Task ID "]);
    const taskText = getRowValue(row, ["Task", "Task "]);
    if (!code || !taskText) continue;

    const ratings = taskRatingsByKey[`${code}|${taskId}`] || {};
    const importance = ratings.IM ?? 50;
    const relevance = ratings.RT ?? 50;

    tasksByCode[code] ??= [];
    tasksByCode[code].push({
      id: taskId,
      text: taskText,
      importance,
      relevance
    });
  }

  const technologyByCode: Record<string, OnetTechnologySkill[]> = {};
  for (const row of technologyRows) {
    const code = getRowValue(row, ["O*NET-SOC Code", "O*NET-SOC Code "]);
    if (!code) continue;

    technologyByCode[code] ??= [];
    technologyByCode[code].push({
      title: getRowValue(row, ["Commodity Title", "Example", "Technology Skill", "Technology Skill "]),
      hot: /^(Y|Yes|1|True)$/i.test(getRowValue(row, ["Hot Technology", "Hot Technology "])),
      inDemand: /^(Y|Yes|1|True)$/i.test(getRowValue(row, ["In Demand", "In Demand "]))
    });
  }

  for (const row of occupationRows) {
    const code = getRowValue(row, ["O*NET-SOC Code", "O*NET-SOC Code "]);
    const title = getRowValue(row, ["Title", "Title "]);
    if (!code || !title) continue;

    onet.occupations[code] = {
      code,
      title,
      description: getRowValue(row, ["Description", "Description "]),
      tasks: tasksByCode[code] || [],
      technologySkills: technologyByCode[code] || [],
      jobZone: jobZonesByCode[code] || 0
    };

    addOnetTitleCandidate(onet, code, title, "occupation");
  }

  for (const row of sampleTitleRows) {
    const code = getRowValue(row, ["O*NET-SOC Code", "O*NET-SOC Code "]);
    const title = getRowValue(row, ["Reported Job Title", "Title", "Title "]);
    if (!code || !title || !onet.occupations[code]) continue;
    addOnetTitleCandidate(onet, code, title, "sample");
  }

  onet.available = Object.keys(onet.occupations).length > 0 && onet.titleCandidates.length > 0;
  if (onet.available) {
    writeStep(`O*NET ready: ${Object.keys(onet.occupations).length} occupations, ${onet.titleCandidates.length} title candidates`);
  }
  return onet;
}

function getOnetDirectOccupation(onet: OnetData, code?: string) {
  if (!onet.available || !code || !onet.occupations[code]) {
    return null;
  }

  return {
    occupation: onet.occupations[code],
    score: 1,
    source: "manual",
    matchedTitle: onet.occupations[code].title
  } satisfies OnetMatch;
}

export function findOnetOccupation(onet: OnetData, title: string, preferredCode = ""): OnetMatch | null {
  if (!onet.available) {
    return null;
  }

  const direct = getOnetDirectOccupation(onet, preferredCode);
  if (direct) {
    return direct;
  }

  const normalized = normalizeTitleKey(title);
  if (!normalized) return null;
  const tokens = getTextTokens(title);

  const mappedCode = onet.manualMap[normalized];
  if (mappedCode) {
    const mapped = getOnetDirectOccupation(onet, mappedCode);
    if (mapped) {
      return { ...mapped, source: "manual_map" };
    }
  }

  const exactCandidates = onet.titleIndex[normalized];
  if (exactCandidates?.length) {
    const exact = [...exactCandidates].sort((left, right) => {
      const leftRank = left.source === "occupation" ? 0 : 1;
      const rightRank = right.source === "occupation" ? 0 : 1;
      return leftRank - rightRank;
    })[0];

    return {
      occupation: onet.occupations[exact.code],
      score: 1,
      source: exact.source,
      matchedTitle: exact.title
    };
  }

  let best: OnetTitleCandidate | null = null;
  let bestScore = 0;
  for (const candidate of onet.titleCandidates) {
    let score = getTokenSimilarity(tokens, candidate.tokens);
    if (candidate.normalizedTitle === normalized) {
      score = Math.max(score, 1);
    } else if (candidate.normalizedTitle.includes(normalized) || normalized.includes(candidate.normalizedTitle)) {
      score += 0.15;
    }
    if (candidate.source === "occupation") {
      score += 0.03;
    }

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best || bestScore < 0.52) {
    return null;
  }

  return {
    occupation: onet.occupations[best.code],
    score: Number(bestScore.toFixed(3)),
    source: best.source,
    matchedTitle: best.title
  };
}

export function getDetailedSocOccupations(onet: OnetData): DetailedSocOccupation[] {
  return Object.values(onet.occupations)
    .filter((occupation) => occupation.code.endsWith(".00"))
    .map((occupation) => ({
      ...occupation,
      majorGroup: getSocMajorGroupFromCode(occupation.code)
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

export function getDetailedSocCandidates(onet: OnetData): Record<string, DetailedSocCandidate[]> {
  const candidatesByCode: Record<string, DetailedSocCandidate[]> = {};

  for (const candidate of onet.titleCandidates) {
    const masterCode = toDetailedSocCode(candidate.code);
    if (!masterCode || !onet.occupations[masterCode]) continue;
    candidatesByCode[masterCode] ??= [];
    candidatesByCode[masterCode].push({
      code: masterCode,
      title: candidate.title,
      normalizedTitle: candidate.normalizedTitle,
      tokens: candidate.tokens,
      source: candidate.source
    });
  }

  for (const occupation of getDetailedSocOccupations(onet)) {
    candidatesByCode[occupation.code] ??= [];
    if (!candidatesByCode[occupation.code].some((candidate) => candidate.normalizedTitle === normalizeTitleKey(occupation.title))) {
      candidatesByCode[occupation.code].push({
        code: occupation.code,
        title: occupation.title,
        normalizedTitle: normalizeTitleKey(occupation.title),
        tokens: getTextTokens(occupation.title),
        source: "occupation"
      });
    }
  }

  return candidatesByCode;
}

export function findDetailedSocOccupation(
  onet: OnetData,
  title: string,
  majorGroup = "",
  preferredCode = ""
): OnetMatch | null {
  if (!onet.available) {
    return null;
  }

  const preferredMasterCode = toDetailedSocCode(preferredCode);
  const preferredOccupation = preferredMasterCode ? onet.occupations[preferredMasterCode] : null;
  if (preferredOccupation?.code?.endsWith(".00")) {
    return {
      occupation: preferredOccupation,
      score: 1,
      source: "manual",
      matchedTitle: preferredOccupation.title
    };
  }

  const normalized = normalizeTitleKey(title);
  if (!normalized) return null;

  const manualMappedCode = onet.manualMap[normalized];
  const manualMasterCode = toDetailedSocCode(manualMappedCode);
  if (manualMasterCode && onet.occupations[manualMasterCode]) {
    return {
      occupation: onet.occupations[manualMasterCode],
      score: 1,
      source: "manual_map",
      matchedTitle: onet.occupations[manualMasterCode].title
    };
  }

  const detailedOccupations = getDetailedSocOccupations(onet);
  const candidatesByCode = getDetailedSocCandidates(onet);
  const tokens = getTextTokens(title);

  let bestOccupation: DetailedSocOccupation | null = null;
  let bestCandidate: DetailedSocCandidate | null = null;
  let bestScore = 0;

  for (const occupation of detailedOccupations) {
    if (majorGroup && occupation.majorGroup !== majorGroup) continue;

    const candidates = candidatesByCode[occupation.code] || [];
    for (const candidate of candidates) {
      let score = getTokenSimilarity(tokens, candidate.tokens);
      if (candidate.normalizedTitle === normalized) {
        score = Math.max(score, 1);
      } else if (candidate.normalizedTitle.includes(normalized) || normalized.includes(candidate.normalizedTitle)) {
        score += 0.15;
      }
      if (candidate.source === "occupation") {
        score += 0.03;
      }

      if (score > bestScore) {
        bestScore = score;
        bestOccupation = occupation;
        bestCandidate = candidate;
      }
    }
  }

  if (!bestOccupation || !bestCandidate || bestScore < 0.28) {
    return null;
  }

  return {
    occupation: bestOccupation,
    score: Number(bestScore.toFixed(3)),
    source: `detailed_${bestCandidate.source}`,
    matchedTitle: bestCandidate.title
  };
}

export function getKeywordSignal(text: string, patterns: string[], saturation = 3) {
  if (!text || !patterns.length) return 0;
  let hits = 0;
  for (const pattern of patterns) {
    if (text.includes(pattern)) {
      hits += 1;
    }
  }
  return clampUnit(hits / Math.max(1, saturation));
}

export function getTaskProfile(taskText: string) {
  const text = normalizeText(taskText);
  const automation = getKeywordSignal(text, [
    "record", "records", "document", "documentation", "report", "reports", "compile", "prepare",
    "verify", "process", "review", "schedule", "track", "monitor", "calculate", "classify",
    "code", "program", "analyze", "analysis", "respond", "summarize", "draft", "audit"
  ], 4);
  const digital = getKeywordSignal(text, [
    "software", "system", "systems", "database", "data", "statistical", "model", "models",
    "design", "research", "develop", "testing", "network", "information", "cyber", "code"
  ], 4);
  const care = getKeywordSignal(text, [
    "patient", "patients", "client", "clients", "care", "treat", "therapy", "counsel",
    "diagnose", "interview", "negotiate", "litigate", "teach", "train", "protect", "supervise"
  ], 4);
  const field = getKeywordSignal(text, [
    "repair", "install", "inspect", "maintain", "operate", "equipment", "machinery",
    "construction", "field", "travel", "lift", "weld", "drive", "respond", "fire", "patrol"
  ], 4);

  return {
    replacement: clampUnit(0.08 + (0.72 * automation) + (0.12 * digital) - (0.42 * care) - (0.28 * field)),
    augmentation: clampUnit(0.12 + (0.48 * digital) + (0.22 * automation) - (0.16 * field) - (0.08 * care)),
    human: clampUnit(0.10 + (0.72 * care) + (0.38 * field) - (0.18 * automation))
  };
}

export function getOnetTechnologySignal(skills: OnetTechnologySkill[]) {
  if (!skills.length) return 0;
  const hot = skills.filter((skill) => skill.hot).length;
  const inDemand = skills.filter((skill) => skill.inDemand).length;
  const density = ((hot * 1.0) + (inDemand * 0.7) + (skills.length * 0.25)) / 8.0;
  return clampUnit(density);
}

export function getOnetProfile(
  title: string,
  majorGroup: string,
  onetMatch: OnetMatch | null,
  getHeuristicProfile: (title: string, majorGroup: string) => HeuristicProfile
): OnetProfile {
  const heuristic = getHeuristicProfile(title, majorGroup);
  if (!onetMatch?.occupation) {
    return heuristic;
  }

  const occupation = onetMatch.occupation;
  const tasks = occupation.tasks || [];
  const techSignal = getOnetTechnologySignal(occupation.technologySkills || []);
  const taskCount = tasks.length;
  const taskCoverage = clampUnit(taskCount / 10);

  if (!taskCount) {
    const partialExposure = clampUnit((0.55 * heuristic.replacement) + (0.20 * heuristic.augmentation) + (0.25 * techSignal));
    return {
      replacement: heuristic.replacement,
      augmentation: clampUnit((0.75 * heuristic.augmentation) + (0.25 * techSignal)),
      human: clampUnit((0.85 * heuristic.human) + (0.15 * (occupation.jobZone / 5))),
      historical: clampUnit(1 - Math.exp(-1.8 * partialExposure)),
      source: "onet_partial",
      taskCount: 0,
      techCount: occupation.technologySkills.length,
      onetCode: occupation.code,
      onetTitle: occupation.title,
      matchScore: onetMatch.score,
      matchSource: onetMatch.source
    };
  }

  let weightedReplacement = 0;
  let weightedAugmentation = 0;
  let weightedHuman = 0;
  let weightTotal = 0;
  for (const task of tasks) {
    const signals = getTaskProfile(task.text);
    const weight = Math.max(1, task.importance * task.relevance);
    weightTotal += weight;
    weightedReplacement += weight * signals.replacement;
    weightedAugmentation += weight * signals.augmentation;
    weightedHuman += weight * signals.human;
  }

  if (!weightTotal) {
    return heuristic;
  }

  const taskReplacement = weightedReplacement / weightTotal;
  const taskAugmentation = weightedAugmentation / weightTotal;
  const taskHuman = weightedHuman / weightTotal;
  const jobZoneSignal = clampUnit((occupation.jobZone - 1) / 4);

  const replacement = clampUnit((taskCoverage * taskReplacement) + ((1 - taskCoverage) * heuristic.replacement));
  const augmentation = clampUnit((taskCoverage * ((0.75 * taskAugmentation) + (0.25 * techSignal))) + ((1 - taskCoverage) * heuristic.augmentation));
  const human = clampUnit((taskCoverage * ((0.75 * taskHuman) + (0.25 * jobZoneSignal))) + ((1 - taskCoverage) * heuristic.human));
  const exposure = clampUnit((0.58 * replacement) + (0.22 * augmentation) + (0.20 * techSignal) - (0.15 * human));

  return {
    replacement,
    augmentation,
    human,
    historical: clampUnit(1 - Math.exp(-1.8 * exposure)),
    source: "onet",
    taskCount,
    techCount: occupation.technologySkills.length,
    onetCode: occupation.code,
    onetTitle: occupation.title,
    matchScore: onetMatch.score,
    matchSource: onetMatch.source
  };
}
