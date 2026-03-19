import path from "node:path";
import {
  clampRange,
  clampUnit,
  empiricalPercentile,
  getBooleanArg,
  getNumberArg,
  getStringArg,
  normalizeSecretValue,
  normalizeText,
  parseCliArgs,
  readJsonFile,
  safeAverage,
  testTextTerms,
  writeJsonFile,
  writeStep
} from "./lib/common";
import {
  getCareerOneStopProviderOptions,
  rebuildCareerOneStopHistory,
  type CareerOneStopHistoryFile
} from "./lib/careeronestop";
import {
  getDetailedSocOccupations,
  findDetailedSocOccupation,
  findOnetOccupation,
  getKeywordSignal,
  getOnetProfile,
  getSocMajorGroupFromCode,
  loadOnetData,
  toDetailedSocCode,
  type HeuristicProfile,
  type OnetMatch,
  type OnetProfile
} from "./lib/onet";
import { translateOccupationDefinition, translateOccupationTask, translateOccupationTitle } from "../src/occupation-translation";
import type { JsonDataset, JsonDatasetOccupation } from "../src/types/airs";

interface UsaJobsSyncOptions {
  apiKey: string;
  userEmail: string;
  datePosted: number;
  resultsPerPage: number;
  maxPages: number;
  retryCount: number;
  retryDelaySeconds: number;
  timeoutSeconds: number;
  region: string;
  outputPath: string;
  historyPath: string;
  baselinePath: string;
  onetDataDir: string;
  masterPath: string;
  useExistingHistoryOnly: boolean;
  mapPath: string;
  careerOneStopHistoryPath: string;
}

interface SocMapRule {
  match: string;
  group: string;
}

interface SocMap {
  socMajorGroups: string[];
  byCategoryName: Record<string, string>;
  byNameContains: SocMapRule[];
}

interface BaselineCodeConfig {
  replacement?: number;
  augmentation?: number;
  hiring?: number;
  historical?: number;
  humanCriticality?: number;
  airs?: number;
  summary?: string;
  summaryZh?: string;
  onetCode?: string;
}

interface BaselineConfig {
  defaults?: {
    summary?: string;
  };
  codes?: Record<string, BaselineCodeConfig>;
}

interface HistoryDailyPoint {
  date: string;
  count: number;
}

interface HistorySeriesEntry {
  code: string;
  name: string;
  majorGroup: string;
  daily: HistoryDailyPoint[];
}

interface HistoryFile {
  source: string;
  lastRun: string;
  series: HistorySeriesEntry[];
}

interface EntrySnapshot {
  code: string;
  title: string;
  rawMajorGroup: string;
  majorGroup: string;
  daily: HistoryDailyPoint[];
  counts: number[];
  latestCount: number;
}

interface GroupProfile {
  replacement: number;
  augmentation: number;
  historical: number;
  human: number;
}

interface AutomationSignals {
  automation: number;
  digital: number;
  care: number;
  field: number;
  rewrite: number;
}

interface HiringState {
  score: number;
  activeDemand: number;
  demandWeakness: number;
  trendWeakness: number;
  substitutionSignal: number;
  rewriteSignal: number;
}

interface UsaJobsCategory {
  code: string;
  title: string;
  majorGroup: string;
}

interface UsaJobsAggregate {
  code: string;
  title: string;
  majorGroup: string;
  count: number;
}

interface SocMasterEntry {
  socCode: string;
  title: string;
  majorGroup: string;
}

function newDefaultSocMap(): SocMap {
  return {
    socMajorGroups: [
      "Management",
      "Business and Financial Operations",
      "Computer and Mathematical",
      "Architecture and Engineering",
      "Life, Physical, and Social Science",
      "Community and Social Service",
      "Legal",
      "Educational Instruction and Library",
      "Arts, Design, Entertainment, Sports, and Media",
      "Healthcare Practitioners and Technical",
      "Healthcare Support",
      "Protective Service",
      "Food Preparation and Serving Related",
      "Building and Grounds Cleaning and Maintenance",
      "Personal Care and Service",
      "Sales and Related",
      "Office and Administrative Support",
      "Farming, Fishing, and Forestry",
      "Construction and Extraction",
      "Installation, Maintenance, and Repair",
      "Production",
      "Transportation and Material Moving",
      "Military Specific Occupations",
      "Other"
    ],
    byCategoryName: {},
    byNameContains: []
  };
}

function newDefaultBaseline(): BaselineConfig {
  return {
    defaults: {
      summary: "Auto-calculated from USAJOBS history using the AIRS heuristic formula."
    },
    codes: {}
  };
}

function getLabelFromAirs(airs: number) {
  if (airs >= 85) return "stable";
  if (airs >= 70) return "light";
  if (airs >= 50) return "augmenting";
  if (airs >= 30) return "restructuring";
  return "high_risk";
}

function toIsoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getGroupProfile(majorGroup: string): GroupProfile {
  const profiles: Record<string, GroupProfile> = {
    "Management": { replacement: 0.38, augmentation: 0.62, historical: 0.58, human: 0.55 },
    "Business and Financial Operations": { replacement: 0.62, augmentation: 0.56, historical: 0.68, human: 0.4 },
    "Computer and Mathematical": { replacement: 0.46, augmentation: 0.82, historical: 0.76, human: 0.3 },
    "Architecture and Engineering": { replacement: 0.38, augmentation: 0.71, historical: 0.64, human: 0.55 },
    "Life, Physical, and Social Science": { replacement: 0.41, augmentation: 0.69, historical: 0.66, human: 0.5 },
    "Community and Social Service": { replacement: 0.23, augmentation: 0.46, historical: 0.38, human: 0.78 },
    "Legal": { replacement: 0.36, augmentation: 0.61, historical: 0.52, human: 0.72 },
    "Educational Instruction and Library": { replacement: 0.31, augmentation: 0.53, historical: 0.46, human: 0.72 },
    "Arts, Design, Entertainment, Sports, and Media": { replacement: 0.48, augmentation: 0.67, historical: 0.6, human: 0.45 },
    "Healthcare Practitioners and Technical": { replacement: 0.2, augmentation: 0.47, historical: 0.36, human: 0.88 },
    "Healthcare Support": { replacement: 0.24, augmentation: 0.4, historical: 0.32, human: 0.84 },
    "Protective Service": { replacement: 0.16, augmentation: 0.34, historical: 0.28, human: 0.9 },
    "Food Preparation and Serving Related": { replacement: 0.44, augmentation: 0.25, historical: 0.45, human: 0.58 },
    "Building and Grounds Cleaning and Maintenance": { replacement: 0.46, augmentation: 0.22, historical: 0.43, human: 0.62 },
    "Personal Care and Service": { replacement: 0.28, augmentation: 0.31, historical: 0.3, human: 0.82 },
    "Sales and Related": { replacement: 0.58, augmentation: 0.49, historical: 0.61, human: 0.37 },
    "Office and Administrative Support": { replacement: 0.74, augmentation: 0.51, historical: 0.72, human: 0.28 },
    "Farming, Fishing, and Forestry": { replacement: 0.4, augmentation: 0.27, historical: 0.42, human: 0.67 },
    "Construction and Extraction": { replacement: 0.22, augmentation: 0.29, historical: 0.25, human: 0.82 },
    "Installation, Maintenance, and Repair": { replacement: 0.2, augmentation: 0.33, historical: 0.24, human: 0.84 },
    "Production": { replacement: 0.52, augmentation: 0.31, historical: 0.56, human: 0.52 },
    "Transportation and Material Moving": { replacement: 0.4, augmentation: 0.28, historical: 0.48, human: 0.65 },
    "Military Specific Occupations": { replacement: 0.19, augmentation: 0.33, historical: 0.29, human: 0.9 }
  };

  return profiles[majorGroup] || { replacement: 0.4, augmentation: 0.4, historical: 0.4, human: 0.5 };
}

function getAutomationSignals(title: string, majorGroup: string): AutomationSignals {
  const text = normalizeText(`${title} ${majorGroup}`);
  return {
    automation: getKeywordSignal(text, [
      "administrative", "admin", "assistant", "office", "clerical", "records", "document", "support",
      "budget", "account", "claims", "contract", "procurement", "compliance", "analyst", "writer",
      "editor", "translator", "customer service", "human resources", "supply", "program"
    ]),
    digital: getKeywordSignal(text, [
      "software", "developer", "programmer", "data", "cyber", "information technology", "systems",
      "network", "cloud", "ai", "machine learning", "statistic", "mathematics", "research",
      "scientist", "intelligence", "communications", "public affairs", "design"
    ]),
    care: getKeywordSignal(text, [
      "nurse", "nursing", "physician", "doctor", "surgeon", "dentist", "dental", "medical", "health", "therapist",
      "counselor", "social worker", "social service", "attorney", "lawyer", "judge", "police",
      "firefighter", "correctional", "emergency", "paramedic", "ranger", "teacher", "instructor"
    ]),
    field: getKeywordSignal(text, [
      "mechanic", "maintenance", "repair", "technician", "construction", "electric", "plumb", "welder",
      "machin", "operator", "pilot", "driver", "transport", "equipment", "installation", "field",
      "forestry", "agriculture", "inspector"
    ]),
    rewrite: getKeywordSignal(text, [
      "analyst", "research", "communications", "budget", "account", "contract", "procurement",
      "teacher", "instructional", "designer", "software", "data", "cyber", "quality assurance"
    ])
  };
}

function getTitleMajorGroupHint(title: string) {
  const text = normalizeText(title);
  if (!text) return "";

  const exactTitleHints: Record<string, string> = {
    "aviation safety": "Transportation and Material Moving",
    "business and industry student trainee": "Business and Financial Operations",
    "boiler plant operating": "Production",
    "cash processing": "Office and Administrative Support",
    "cemetery caretaking": "Building and Grounds Cleaning and Maintenance",
    "compliance inspection and support": "Protective Service",
    "consumer safety": "Protective Service",
    "consumer safety inspection": "Protective Service",
    "contact representative": "Office and Administrative Support",
    "drill rig operating": "Construction and Extraction",
    "electroplating": "Production",
    "explosives safety series": "Protective Service",
    "foreign affairs": "Life, Physical, and Social Science",
    "fuel distribution system operating": "Production",
    "gardening": "Building and Grounds Cleaning and Maintenance",
    "general business and industry": "Business and Financial Operations",
    "general inspection investigation enforcement and compliance series": "Protective Service",
    "general inspection investigation enforcement and compliance": "Protective Service",
    "general investigation": "Protective Service",
    "general supply": "Business and Financial Operations",
    "guide": "Personal Care and Service",
    "industrial hygiene": "Life, Physical, and Social Science",
    "intelligence": "Life, Physical, and Social Science",
    "laboratory working": "Life, Physical, and Social Science",
    "letterpress operating": "Production",
    "mail and file": "Office and Administrative Support",
    "marine survey technical": "Architecture and Engineering",
    "materials examining and identifying": "Production",
    "materials handler": "Transportation and Material Moving",
    "meatcutting": "Production",
    "miscellaneous aircraft overhaul": "Installation, Maintenance, and Repair",
    "miscellaneous armament work": "Production",
    "miscellaneous plant and animal work": "Farming, Fishing, and Forestry",
    "miscellaneous warehousing and stock handling": "Transportation and Material Moving",
    "model making": "Production",
    "motor carrier safety": "Protective Service",
    "non destructive testing": "Production",
    "non-destructive testing": "Production",
    "packing": "Transportation and Material Moving",
    "passport and visa examining": "Office and Administrative Support",
    "pest controlling": "Building and Grounds Cleaning and Maintenance",
    "property disposal": "Business and Financial Operations",
    "purchasing": "Business and Financial Operations",
    "realty": "Sales and Related",
    "rigging": "Construction and Extraction",
    "secretary": "Office and Administrative Support",
    "store working": "Transportation and Material Moving",
    "tools and parts attending": "Transportation and Material Moving",
    "tractor operating": "Transportation and Material Moving"
  };

  if (exactTitleHints[text]) {
    return exactTitleHints[text];
  }

  if (testTextTerms(text, [
    "dental", "nurse", "nursing", "medical", "health", "physician", "therapist",
    "optometrist", "orthotist", "prosthetist", "podiatrist", "pharmacist",
    "dietitian", "nutritionist", "pathology", "audiology", "radiologic",
    "laboratory science", "medical technician", "clinical laboratory"
  ])) {
    return "Healthcare Practitioners and Technical";
  }
  if (testTextTerms(text, ["social service", "social worker", "counselor", "counseling", "chaplain"])) {
    return "Community and Social Service";
  }
  if (testTextTerms(text, [
    "police", "fire", "correction", "ranger", "security guard",
    "security administration", "border patrol", "criminal investigation",
    "investigative", "customs and border protection"
  ])) {
    return "Protective Service";
  }
  if (testTextTerms(text, ["teacher", "instructor", "library", "librarian", "education", "training", "instructional"])) {
    return "Educational Instruction and Library";
  }
  if (testTextTerms(text, [
    "telecommunications", "telecommunications processing", "telephone operating",
    "security clerical and assistance"
  ])) {
    return "Office and Administrative Support";
  }
  if (testTextTerms(text, ["attorney", "lawyer", "judge", "legal", "paralegal"])) {
    return "Legal";
  }
  if (testTextTerms(text, [
    "art", "artist", "arts", "design", "designer", "music", "musician",
    "museum", "curator", "public affairs", "government information",
    "visual information", "visual", "audiovisual", "audio visual", "video",
    "broadcast", "media", "editor", "editing", "writer", "writing",
    "photographer", "photography", "journal", "recreation", "sports",
    "athletic", "theater", "theatre", "illustrating", "illustration", "entertainment"
  ])) {
    return "Arts, Design, Entertainment, Sports, and Media";
  }
  if (testTextTerms(text, ["statistics", "statistical", "mathematical statistics", "data science"])) {
    return "Computer and Mathematical";
  }
  if (testTextTerms(text, [
    "physics", "chemistry", "meteorology", "meteorological", "biology", "biological",
    "microbiology", "pharmacology", "entomology", "archeology", "archaeology",
    "geography", "psychology", "economist", "economics", "history", "social science"
  ])) {
    return "Life, Physical, and Social Science";
  }
  if (testTextTerms(text, ["food service", "food services", "cooking", "cook", "waiter", "bartending", "bartender"])) {
    return "Food Preparation and Serving Related";
  }
  if (testTextTerms(text, [
    "transportation", "traffic", "dispatching", "motor vehicle", "ship pilot",
    "small craft", "air traffic control", "aircraft operation"
  ])) {
    return "Transportation and Material Moving";
  }
  if (testTextTerms(text, [
    "maintenance", "mechanic", "repair", "technician", "machining", "toolmaking",
    "calibrating", "instrument mechanic"
  ])) {
    return "Installation, Maintenance, and Repair";
  }
  if (testTextTerms(text, [
    "construction", "carpentry", "carpenter", "electrician", "plumbing", "plumber",
    "pipefitting", "masonry", "welding", "sheet metal", "painting"
  ])) {
    return "Construction and Extraction";
  }
  if (testTextTerms(text, ["engineer", "engineering", "architect", "electronics technical"])) {
    return "Architecture and Engineering";
  }
  if (testTextTerms(text, ["software", "computer", "cyber", "data", "information technology", "it specialist"])) {
    return "Computer and Mathematical";
  }

  return "";
}

function resolveMajorGroup(categoryName: string, fallbackName: string, socMap: SocMap) {
  if (!categoryName) {
    return fallbackName || "Other";
  }

  const exact = socMap.byCategoryName?.[categoryName];
  if (exact) return exact;

  const needle = categoryName.toLowerCase();
  for (const rule of socMap.byNameContains || []) {
    if (rule.match && rule.group && needle.includes(String(rule.match))) {
      return String(rule.group);
    }
  }

  return fallbackName || "Other";
}

function getNormalizedMajorGroup(rawMajorGroup: string, title: string, socMap: SocMap) {
  const known = socMap.socMajorGroups || [];
  const titleHint = getTitleMajorGroupHint(title);
  const overrideableGroups = [
    "Office and Administrative Support",
    "Business and Financial Operations",
    "Other",
    "Production",
    "Installation, Maintenance, and Repair",
    "Computer and Mathematical"
  ];

  if (rawMajorGroup && known.includes(rawMajorGroup)) {
    if (titleHint && titleHint !== rawMajorGroup && overrideableGroups.includes(rawMajorGroup)) {
      return titleHint;
    }
    return rawMajorGroup;
  }

  if (rawMajorGroup) {
    const mapped = resolveMajorGroup(rawMajorGroup, "", socMap);
    if (mapped && known.includes(mapped)) {
      if (titleHint && titleHint !== mapped && overrideableGroups.includes(mapped)) {
        return titleHint;
      }
      return mapped;
    }
  }

  if (titleHint) return titleHint;
  if (title) return resolveMajorGroup(title, "Other", socMap);
  return "Other";
}

function getReplacementScore(title: string, majorGroup: string) {
  const profile = getGroupProfile(majorGroup);
  const signals = getAutomationSignals(title, majorGroup);
  return clampUnit(
    profile.replacement +
      (0.18 * signals.automation) +
      (0.06 * signals.digital) -
      (0.2 * signals.care) -
      (0.14 * signals.field)
  );
}

function getAugmentationScore(title: string, majorGroup: string) {
  const profile = getGroupProfile(majorGroup);
  const signals = getAutomationSignals(title, majorGroup);
  return clampUnit(
    profile.augmentation +
      (0.22 * signals.digital) +
      (0.08 * signals.automation) +
      (0.1 * signals.rewrite) -
      (0.12 * signals.field)
  );
}

function getHumanCriticality(title: string, majorGroup: string) {
  const profile = getGroupProfile(majorGroup);
  const signals = getAutomationSignals(title, majorGroup);
  return clampUnit(profile.human + (0.24 * signals.care) + (0.12 * signals.field) - (0.14 * signals.automation));
}

function getHistoricalScore(title: string, majorGroup: string) {
  const profile = getGroupProfile(majorGroup);
  const signals = getAutomationSignals(title, majorGroup);
  const exposure = clampUnit(
    profile.historical +
      (0.16 * signals.automation) +
      (0.18 * signals.digital) -
      (0.12 * signals.care) -
      (0.08 * signals.field)
  );
  return clampUnit(1 - Math.exp(-1.8 * exposure));
}

function getHeuristicProfile(title: string, majorGroup: string): HeuristicProfile {
  return {
    replacement: getReplacementScore(title, majorGroup),
    augmentation: getAugmentationScore(title, majorGroup),
    human: getHumanCriticality(title, majorGroup),
    historical: getHistoricalScore(title, majorGroup),
    source: "heuristic",
    taskCount: 0,
    techCount: 0,
    onetCode: "",
    onetTitle: "",
    matchScore: 0,
    matchSource: ""
  };
}

function getTrendWeakness(counts: number[]) {
  if (counts.length <= 1) return 0.5;
  const latest = counts[counts.length - 1] || 0;
  const previous = counts.slice(0, -1).slice(-7);
  const previousAverage = safeAverage(previous);
  if (previousAverage <= 0) {
    return latest <= 0 ? 0.5 : 0.25;
  }
  const delta = (latest - previousAverage) / Math.max(previousAverage, 1);
  return clampUnit(1 / (1 + Math.exp(4 * delta)));
}

function getHiringRealizationScore(
  counts: number[],
  augmentation: number,
  groupPopulation: number[],
  globalPopulation: number[]
): HiringState {
  const latest = counts.length ? counts[counts.length - 1] : 0;
  const logCount = Math.log(1 + Math.max(0, latest));
  const groupPercentile = empiricalPercentile(logCount, groupPopulation);
  const globalPercentile = empiricalPercentile(logCount, globalPopulation);
  const activeDemand = clampUnit((0.7 * groupPercentile) + (0.3 * globalPercentile));
  const demandWeakness = clampUnit(1 - activeDemand);
  const trendWeakness = getTrendWeakness(counts);
  const substitutionSignal = clampUnit((0.65 * demandWeakness) + (0.35 * trendWeakness));
  const rewriteSignal = clampUnit(augmentation * (0.55 + (0.45 * activeDemand)));

  return {
    score: clampUnit((0.6 * substitutionSignal) + (0.4 * rewriteSignal)),
    activeDemand,
    demandWeakness,
    trendWeakness,
    substitutionSignal,
    rewriteSignal
  };
}

function getImpactScore(
  replacement: number,
  augmentation: number,
  hiringRealization: number,
  historicalAI: number,
  humanCriticality: number
) {
  let impact = clampUnit(
    (0.5 * replacement) +
      (0.2 * augmentation) +
      (0.2 * hiringRealization) +
      (0.1 * historicalAI)
  );

  if (humanCriticality > 0.7) {
    impact = Math.min(impact, 0.85);
  }

  return clampUnit(impact);
}

function getAirsSummary(
  replacement: number,
  augmentation: number,
  hiring: number,
  historical: number,
  activeDemand: number
) {
  const pairs = [
    { label: "replacement pressure", value: replacement },
    { label: "job redesign", value: augmentation },
    { label: "hiring realization", value: hiring },
    { label: "historical exposure", value: historical }
  ].sort((left, right) => right.value - left.value);

  const driver = pairs[0];
  let demand = "in a middle range";
  if (activeDemand >= 0.67) {
    demand = "still active";
  } else if (activeDemand <= 0.33) {
    demand = "already weak";
  }

  return {
    en: `This occupation is currently driven most by ${driver.label}; hiring versus peer roles is ${demand}.`,
    zh: `This occupation is currently driven most by ${driver.label}; hiring versus peer roles is ${demand}.`
  };
}

function buildMonthlyAirs(
  counts: number[],
  replacement: number,
  augmentation: number,
  historical: number,
  humanCriticality: number,
  groupPopulation: number[],
  globalPopulation: number[]
) {
  if (!counts.length) return [];

  const window = counts.slice(-12);
  const series: number[] = [];
  for (let index = 0; index < window.length; index += 1) {
    const prefix = window.slice(0, index + 1);
    const hiringState = getHiringRealizationScore(prefix, augmentation, groupPopulation, globalPopulation);
    const impact = getImpactScore(replacement, augmentation, hiringState.score, historical, humanCriticality);
    series.push(Number((100 * (1 - impact)).toFixed(1)));
  }

  if (series.length < 12) {
    const fill = series.length ? series[0] : 100;
    series.unshift(...Array.from({ length: 12 - series.length }, () => fill));
  }

  return series;
}

function getCategoryFromPosting(descriptor: any, socMap: SocMap): UsaJobsCategory | null {
  const categories = Array.isArray(descriptor?.JobCategory)
    ? descriptor.JobCategory
    : descriptor?.JobCategory
      ? [descriptor.JobCategory]
      : [];
  if (!categories.length) return null;

  const major = categories[0];
  const detail = categories[categories.length - 1];
  const categoryName = String(detail?.Name || "");
  const mappedMajor = resolveMajorGroup(categoryName, String(major?.Name || ""), socMap);

  return {
    code: String(detail?.Code || ""),
    title: categoryName,
    majorGroup: mappedMajor
  };
}

async function invokeUsaJobsPage(page: number, options: UsaJobsSyncOptions) {
  const uri = `https://data.usajobs.gov/api/search?DatePosted=${options.datePosted}&ResultsPerPage=${options.resultsPerPage}&Page=${page}`;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= options.retryCount; attempt += 1) {
    try {
      const response = await fetch(uri, {
        method: "GET",
        headers: {
          "User-Agent": options.userEmail,
          "Authorization-Key": options.apiKey
        },
        signal: AbortSignal.timeout(options.timeoutSeconds * 1000)
      });

      if (!response.ok) {
        throw new Error(`USAJOBS request failed: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt >= options.retryCount) break;
      await new Promise((resolve) => setTimeout(resolve, options.retryDelaySeconds * attempt * 1000));
    }
  }

  throw lastError;
}

function parseOptions(): UsaJobsSyncOptions {
  const args = parseCliArgs(process.argv.slice(2));
  const scriptRoot = path.resolve(__dirname, "..", "..", "backend");
  const dataDir = path.join(scriptRoot, "data");

  const apiKey = normalizeSecretValue(getStringArg(args, "apiKey", "apikey")) || normalizeSecretValue(process.env.USAJOBS_API_KEY);
  const userEmail = normalizeSecretValue(getStringArg(args, "userEmail", "useremail")) || normalizeSecretValue(process.env.USAJOBS_USER_EMAIL);
  const useExistingHistoryOnly = getBooleanArg(args, "useExistingHistoryOnly", "useexistinghistoryonly");

  if (!useExistingHistoryOnly && (!apiKey || !userEmail)) {
    throw new Error("Missing USAJOBS credentials. Set --apiKey/--userEmail or env USAJOBS_API_KEY/USAJOBS_USER_EMAIL.");
  }

  const resultsPerPage = Math.min(500, Math.max(1, getNumberArg(args, ["resultsPerPage", "resultsperpage"], 500)));

  return {
    apiKey,
    userEmail,
    datePosted: getNumberArg(args, ["datePosted", "dateposted"], 1),
    resultsPerPage,
    maxPages: getNumberArg(args, ["maxPages", "maxpages"], 20),
    retryCount: getNumberArg(args, ["retryCount", "retrycount"], 3),
    retryDelaySeconds: getNumberArg(args, ["retryDelaySeconds", "retrydelayseconds"], 2),
    timeoutSeconds: getNumberArg(args, ["timeoutSeconds", "timeoutseconds"], 30),
    region: getStringArg(args, "region") || "National",
    outputPath: getStringArg(args, "outputPath", "outputpath") || path.join(dataDir, "airs_data.json"),
    historyPath: getStringArg(args, "historyPath", "historypath") || path.join(dataDir, "usajobs_history.json"),
    baselinePath: getStringArg(args, "baselinePath", "baselinepath") || path.join(dataDir, "airs_baseline.json"),
    onetDataDir: getStringArg(args, "onetDataDir", "onetdatadir") || path.join(dataDir, "onet"),
    masterPath: getStringArg(args, "masterPath", "masterpath") || path.join(dataDir, "soc_detailed_master.json"),
    useExistingHistoryOnly,
    mapPath: path.join(dataDir, "usajobs_soc_map.json"),
    careerOneStopHistoryPath:
      getStringArg(args, "careerOneStopHistoryPath", "careeronestophistorypath") ||
      path.join(dataDir, "careeronestop_history.json")
  };
}

async function loadSocMap(mapPath: string) {
  const socMap = await readJsonFile<SocMap>(mapPath);
  return socMap || newDefaultSocMap();
}

async function loadSocMaster(masterPath: string, onetData: Awaited<ReturnType<typeof loadOnetData>>): Promise<SocMasterEntry[]> {
  const existing = await readJsonFile<SocMasterEntry[]>(masterPath);
  if (Array.isArray(existing) && existing.length) {
    return existing;
  }

  const generated = getDetailedSocOccupations(onetData).map((occupation) => ({
    socCode: occupation.code,
    title: occupation.title,
    majorGroup: occupation.majorGroup
  }));

  if (generated.length) {
    await writeJsonFile(masterPath, generated);
  }

  return generated;
}

async function rebuildHistory(options: UsaJobsSyncOptions, socMap: SocMap) {
  const aggregates = new Map<string, UsaJobsAggregate>();
  let page = 1;
  let total = 0;

  if (!options.useExistingHistoryOnly) {
    do {
      const response: any = await invokeUsaJobsPage(page, options);
      const result = response?.SearchResult;
      if (!result) break;

      total = Number(result.SearchResultCountAll || 0);
      const items = Array.isArray(result.SearchResultItems) ? result.SearchResultItems : [];
      for (const item of items) {
        const descriptor = item?.MatchedObjectDescriptor;
        if (!descriptor) continue;
        const category = getCategoryFromPosting(descriptor, socMap);
        if (!category?.code) continue;

        const existing = aggregates.get(category.code) || {
          code: category.code,
          title: category.title,
          majorGroup: category.majorGroup,
          count: 0
        };
        existing.count += 1;
        aggregates.set(category.code, existing);
      }

      page += 1;
      if (page > options.maxPages) break;
    } while ((page - 1) * options.resultsPerPage < total);
  }

  const today = toIsoDate();
  writeStep("Loading USAJOBS history");
  const history = (await readJsonFile<HistoryFile>(options.historyPath)) || (
    options.useExistingHistoryOnly
      ? null
      : { source: "USAJOBS", lastRun: today, series: [] }
  );

  if (!history) {
    throw new Error(`History file not found for --useExistingHistoryOnly: ${options.historyPath}`);
  }

  const seriesIndex = new Map<string, HistorySeriesEntry>();
  for (const entry of history.series || []) {
    seriesIndex.set(entry.code, {
      code: entry.code,
      name: entry.name,
      majorGroup: entry.majorGroup,
      daily: Array.isArray(entry.daily) ? entry.daily : []
    });
  }

  if (!options.useExistingHistoryOnly) {
    for (const [code, aggregate] of aggregates) {
      const existing = seriesIndex.get(code) || {
        code,
        name: aggregate.title,
        majorGroup: aggregate.majorGroup,
        daily: []
      };

      existing.name = aggregate.title;
      existing.majorGroup = aggregate.majorGroup;
      existing.daily = (existing.daily || []).filter((point) => point.date !== today);
      existing.daily.push({ date: today, count: aggregate.count });
      seriesIndex.set(code, existing);
    }

    history.series = [...seriesIndex.values()].sort((left, right) => left.code.localeCompare(right.code));
    history.lastRun = today;
    await writeJsonFile(options.historyPath, history);
  }

  return history;
}

function collectHistoryDates(...histories: Array<HistoryFile | CareerOneStopHistoryFile | null | undefined>) {
  const values = new Set<string>();

  for (const history of histories) {
    if (!history) continue;
    const series = "series" in history ? history.series : [];
    const occupations = "occupations" in history ? history.occupations : [];

    for (const entry of series || []) {
      for (const point of entry.daily || []) {
        if (point?.date) values.add(point.date);
      }
    }

    for (const entry of occupations || []) {
      for (const point of entry.daily || []) {
        if (point?.date) values.add(point.date);
      }
    }
  }

  return [...values].sort();
}

function addCountByDate(
  target: Map<string, Map<string, number>>,
  code: string,
  date: string,
  count: number
) {
  if (!target.has(code)) {
    target.set(code, new Map());
  }

  const byDate = target.get(code)!;
  byDate.set(date, (byDate.get(date) || 0) + Number(count || 0));
}

function addSourceCountByDate(
  target: Map<string, Map<string, Record<string, number>>>,
  code: string,
  date: string,
  source: string,
  count: number
) {
  if (!target.has(code)) {
    target.set(code, new Map());
  }

  const byDate = target.get(code)!;
  const existing = byDate.get(date) || {};
  existing[source] = (existing[source] || 0) + Number(count || 0);
  byDate.set(date, existing);
}

async function main() {
  const options = parseOptions();
  const socMap = await loadSocMap(options.mapPath);
  writeStep("SOC map loaded");
  const onetData = await loadOnetData(options.onetDataDir);
  const history = await rebuildHistory(options, socMap);
  const socMaster = await loadSocMaster(options.masterPath, onetData);
  if (!socMaster.length) {
    throw new Error("No SOC detailed occupation master is available. Provide O*NET files or soc_detailed_master.json.");
  }

  const careerOneStopOptions = getCareerOneStopProviderOptions(
    options.careerOneStopHistoryPath,
    options.useExistingHistoryOnly
  );
  let careerOneStopHistory: CareerOneStopHistoryFile | null = null;
  try {
    careerOneStopHistory = await rebuildCareerOneStopHistory(
      socMaster.map((entry) => ({
        socCode: entry.socCode,
        title: entry.title,
        majorGroup: entry.majorGroup
      })),
      careerOneStopOptions
    );
  } catch (error) {
    console.warn(
      `CareerOneStop source skipped: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let baseline = await readJsonFile<BaselineConfig>(options.baselinePath);
  if (!baseline) {
    baseline = newDefaultBaseline();
    await writeJsonFile(options.baselinePath, baseline);
  }
  writeStep("Baseline loaded");

  let dates = collectHistoryDates(history, careerOneStopHistory);
  if (dates.length > 12) {
    dates = dates.slice(-12);
  }

  const labels = ["stable", "light", "augmenting", "restructuring", "high_risk"];
  const regions = [options.region];
  const groups = socMap.socMajorGroups || [];
  const baselineDefaults = baseline.defaults || {};

  const entrySnapshots: EntrySnapshot[] = (history.series || []).map((entry) => {
    const daily = [...(entry.daily || [])].sort((left, right) => left.date.localeCompare(right.date));
    const counts = daily.map((point) => Number(point.count || 0));
    return {
      code: entry.code,
      title: String(entry.name || ""),
      rawMajorGroup: String(entry.majorGroup || ""),
      majorGroup: getNormalizedMajorGroup(String(entry.majorGroup || ""), String(entry.name || ""), socMap),
      daily,
      counts,
      latestCount: counts.length ? counts[counts.length - 1] : 0
    };
  });

  const masterIndex = new Map(socMaster.map((entry) => [entry.socCode, entry]));
  const aggregatedDaily = new Map<string, Map<string, number>>();
  const aggregatedSourceDaily = new Map<string, Map<string, Record<string, number>>>();
  const masterSources = new Map<string, { titles: Set<string>; seriesCodes: Set<string>; confidence: number }>();

  for (const entry of entrySnapshots) {
    const preferredOnetCode = String(baseline.codes?.[entry.code]?.onetCode || "");
    let mappedMatch = findDetailedSocOccupation(onetData, entry.title, entry.majorGroup, preferredOnetCode);

    if (!mappedMatch) {
      const fallbackMatch = findOnetOccupation(onetData, entry.title, preferredOnetCode);
      const detailedCode = toDetailedSocCode(fallbackMatch?.occupation?.code || "");
      if (fallbackMatch && detailedCode && masterIndex.has(detailedCode) && onetData.occupations[detailedCode]) {
        mappedMatch = {
          occupation: onetData.occupations[detailedCode],
          score: fallbackMatch.score,
          source: `fallback_${fallbackMatch.source}`,
          matchedTitle: fallbackMatch.matchedTitle
        };
      }
    }

    const masterCode = mappedMatch?.occupation?.code || "";
    if (!masterCode || !masterIndex.has(masterCode)) {
      continue;
    }

    if (!aggregatedDaily.has(masterCode)) {
      aggregatedDaily.set(masterCode, new Map());
    }
    for (const point of entry.daily) {
      addCountByDate(aggregatedDaily, masterCode, point.date, Number(point.count || 0));
      addSourceCountByDate(aggregatedSourceDaily, masterCode, point.date, "USAJOBS", Number(point.count || 0));
    }

    if (!masterSources.has(masterCode)) {
      masterSources.set(masterCode, {
        titles: new Set(),
        seriesCodes: new Set(),
        confidence: 0
      });
    }
    const sourceEntry = masterSources.get(masterCode)!;
    sourceEntry.titles.add(entry.title);
    sourceEntry.seriesCodes.add(entry.code);
    sourceEntry.confidence = Math.max(sourceEntry.confidence, Number(mappedMatch?.score || 0));
  }

  for (const entry of careerOneStopHistory?.occupations || []) {
    if (!entry?.socCode || !masterIndex.has(entry.socCode)) {
      continue;
    }

    for (const point of entry.daily || []) {
      addCountByDate(aggregatedDaily, entry.socCode, point.date, Number(point.count || 0));
      addSourceCountByDate(
        aggregatedSourceDaily,
        entry.socCode,
        point.date,
        "CareerOneStop",
        Number(point.count || 0)
      );
    }
  }

  const masterSnapshots = socMaster.map((entry) => {
    const countsByDate = aggregatedDaily.get(entry.socCode) || new Map<string, number>();
    const daily = dates.map((date) => ({ date, count: countsByDate.get(date) || 0 }));
    const counts = daily.map((point) => Number(point.count || 0));
    return {
      socCode: entry.socCode,
      title: entry.title,
      majorGroup: entry.majorGroup || getSocMajorGroupFromCode(entry.socCode),
      daily,
      counts,
      latestCount: counts.length ? counts[counts.length - 1] : 0
    };
  });

  const groupPopulationMap = new Map<string, number[]>();
  for (const group of groups) {
    const values = masterSnapshots
      .filter((entry) => entry.majorGroup === group)
      .map((entry) => Math.log(1 + entry.latestCount));
    groupPopulationMap.set(group, values.length ? values : [Math.log(1)]);
  }
  const globalPopulation = masterSnapshots.length
    ? masterSnapshots.map((entry) => Math.log(1 + entry.latestCount))
    : [Math.log(1)];

  const occupations: JsonDatasetOccupation[] = [];
  writeStep("Calculating AIRS scores");

  for (const entry of masterSnapshots) {
    const config = baseline.codes?.[entry.socCode];
    const majorGroup = entry.majorGroup;
    const onetMatch: OnetMatch | null = onetData.occupations[entry.socCode]
      ? {
          occupation: onetData.occupations[entry.socCode],
          score: 1,
          source: "master",
          matchedTitle: onetData.occupations[entry.socCode].title
        }
      : null;
    const profile: OnetProfile = getOnetProfile(entry.title, majorGroup, onetMatch, getHeuristicProfile);

    let replacement = profile.replacement;
    let augmentation = profile.augmentation;
    let historical = profile.historical;
    let humanCriticality = profile.human;
    const groupPopulation = groupPopulationMap.get(majorGroup) || [Math.log(1)];
    const hiringState = getHiringRealizationScore(entry.counts, augmentation, groupPopulation, globalPopulation);
    let hiring = hiringState.score;
    let impact = getImpactScore(replacement, augmentation, hiring, historical, humanCriticality);
    let airs = Number((100 * (1 - impact)).toFixed(1));

    if (config) {
      if (typeof config.replacement === "number") replacement = config.replacement;
      if (typeof config.augmentation === "number") augmentation = config.augmentation;
      if (typeof config.hiring === "number") hiring = config.hiring;
      if (typeof config.historical === "number") historical = config.historical;
      if (typeof config.humanCriticality === "number") humanCriticality = config.humanCriticality;

      impact = getImpactScore(replacement, augmentation, hiring, historical, humanCriticality);
      airs = Number((100 * (1 - impact)).toFixed(1));
      if (typeof config.airs === "number") {
        airs = Number(clampRange(config.airs, 0, 100).toFixed(1));
      }
    }

    const label = getLabelFromAirs(airs);
    const latestPoint = entry.daily[entry.daily.length - 1];
    const postings = latestPoint ? Number(latestPoint.count || 0) : 0;
    const latestDate = latestPoint?.date || "";
    const postingSources = latestDate
      ? { ...(aggregatedSourceDaily.get(entry.socCode)?.get(latestDate) || {}) }
      : {};
    const summaryPair = getAirsSummary(replacement, augmentation, hiring, historical, hiringState.activeDemand);
    let summaryEn = summaryPair.en;
    let summaryZh = summaryPair.zh;

    if (config) {
      const baselineSummary = baselineDefaults.summary || "";
      summaryEn = String(config.summary || (baselineSummary && !baselineSummary.startsWith("Auto-calculated") ? baselineSummary : summaryPair.en));
      summaryZh = String(config.summaryZh || config.summary || summaryPair.zh);
    } else if (baselineDefaults.summary && !baselineDefaults.summary.startsWith("Auto-calculated")) {
      summaryEn = baselineDefaults.summary;
    }

    const monthlyAirs = buildMonthlyAirs(
      entry.counts,
      replacement,
      augmentation,
      historical,
      humanCriticality,
      groupPopulation,
      globalPopulation
    );
    const demandPercentile = Math.round(100 * hiringState.activeDemand);
    const replacementPct = Math.round(100 * replacement);
    const augmentationPct = Math.round(100 * augmentation);
    const hiringPct = Math.round(100 * hiring);
    const historicalPct = Math.round(100 * historical);
    const profileSource = profile.source;
    const onetCode = entry.socCode;
    const onetTitle = entry.title;
    const onetMatchScore = Number(profile.matchScore.toFixed(3));
    const onetTaskCount = profile.taskCount || 0;
    const onetTechCount = profile.techCount || 0;
    const mappedSources = masterSources.get(entry.socCode);
    const mappedSourceList = mappedSources ? [...mappedSources.titles].slice(0, 4) : [];
    const sourceEvidence = `Feature source: ${profileSource}; O*NET ${onetCode} (${onetTitle}), match score ${onetMatchScore}, tasks ${onetTaskCount}, technology skills ${onetTechCount}.`;
    const mappingEvidence = mappedSources
      ? `Mapped federal series: ${mappedSources.seriesCodes.size}; examples: ${mappedSourceList.join("; ")}; best confidence ${mappedSources.confidence.toFixed(3)}.`
      : "Mapped federal series: 0; no direct federal title match yet.";
    const sourceBreakdown = Object.keys(postingSources).length
      ? Object.entries(postingSources).map(([source, count]) => `${source} ${count}`).join("; ")
      : "no active provider counts";
    const taskPreview = onetMatch?.occupation?.tasks
      ? [...onetMatch.occupation.tasks]
          .sort((left, right) => (right.importance * right.relevance) - (left.importance * left.relevance))
          .slice(0, 5)
          .map((task) => task.text)
      : [];

    occupations.push({
      socCode: entry.socCode,
      title: entry.title,
      titleZh: translateOccupationTitle(entry.title),
      definition: onetMatch?.occupation?.description || "",
      definitionZh: translateOccupationDefinition(entry.title, onetMatch?.occupation?.description || ""),
      majorGroup,
      onetCode,
      onetTitle,
      onetMatchScore,
      featureSource: mappedSources ? `${profileSource}_soc_master` : `soc_master_${profileSource}`,
      label,
      summary: summaryEn,
      summaryZh,
      regions: {
        [options.region]: {
          airs,
          replacement: Number(replacement.toFixed(3)),
          augmentation: Number(augmentation.toFixed(3)),
          hiring: Number(hiring.toFixed(3)),
          historical: Number(historical.toFixed(3)),
          postings,
          postingSources
        }
      },
      monthlyAirs,
      evidence: [
        `SOC detailed occupation: ${entry.socCode}`,
        `Normalized BLS major group: ${majorGroup}`,
        `Current postings: ${postings}; peer-demand percentile: ${demandPercentile}%`,
        `Posting source breakdown: ${sourceBreakdown}.`,
        `Replacement ${replacementPct}%, augmentation ${augmentationPct}%, hiring realization ${hiringPct}%, historical exposure ${historicalPct}%.`,
        mappingEvidence,
        sourceEvidence
      ],
      evidenceZh: [
        `SOC detailed occupation: ${entry.socCode}`,
        `Normalized BLS major group: ${majorGroup}`,
        `Current postings: ${postings}; peer-demand percentile: ${demandPercentile}%`,
        `Posting source breakdown: ${sourceBreakdown}.`,
        `Replacement ${replacementPct}%, augmentation ${augmentationPct}%, hiring realization ${hiringPct}%, historical exposure ${historicalPct}%.`,
        mappingEvidence,
        sourceEvidence
      ],
      tasks: taskPreview.map((name) => ({
        name,
        nameZh: translateOccupationTask(entry.title, name)
      }))
    });
  }

  writeStep(`Prepared ${masterSnapshots.length} SOC detailed occupation snapshots`);

  const output: JsonDataset = {
    dates,
    regions,
    labels,
    groups,
    occupations: occupations.map((occupation) => ({
      ...occupation,
      titleZh: translateOccupationTitle(occupation.title)
    })).sort((left, right) => {
      const leftAirs = Number(left.regions?.[options.region]?.airs || 0);
      const rightAirs = Number(right.regions?.[options.region]?.airs || 0);
      return leftAirs - rightAirs;
    })
  };

  writeStep("Writing output JSON");
  await writeJsonFile(options.outputPath, output);
  console.log(`USAJOBS sync complete. Occupations: ${occupations.length}. Output: ${options.outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
