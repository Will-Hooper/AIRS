import {
  clampRange,
  getNumberArg,
  getStringArg,
  normalizeSecretValue,
  parseCliArgs,
  readJsonFile,
  writeJsonFile,
  writeStep
} from "./common";

export interface CareerOneStopHistoryDailyPoint {
  date: string;
  count: number;
}

export interface CareerOneStopHistoryOccupationEntry {
  socCode: string;
  title: string;
  majorGroup: string;
  daily: CareerOneStopHistoryDailyPoint[];
}

export interface CareerOneStopHistoryFile {
  source: string;
  lastRun: string;
  location: string;
  days: number;
  occupations: CareerOneStopHistoryOccupationEntry[];
}

export interface CareerOneStopOccupationSeed {
  socCode: string;
  title: string;
  majorGroup: string;
}

export interface CareerOneStopProviderOptions {
  apiToken: string;
  userId: string;
  location: string;
  radius: number;
  days: number;
  timeoutSeconds: number;
  retryCount: number;
  retryDelaySeconds: number;
  concurrency: number;
  historyPath: string;
  useExistingHistoryOnly: boolean;
}

interface CareerOneStopJobSearchResponse {
  JobCount?: string | number;
  ErrorMessage?: string;
  JobsKeywordLocations?: {
    IsValidLocation?: boolean;
    Location?: string;
    Title?: string;
  };
}

function toIsoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getLatestKnownCount(history: CareerOneStopHistoryOccupationEntry | undefined) {
  if (!history?.daily?.length) return 0;
  const latest = [...history.daily]
    .sort((left, right) => left.date.localeCompare(right.date))
    .at(-1);
  return Number(latest?.count || 0);
}

function buildJobSearchUrl(
  userId: string,
  keyword: string,
  location: string,
  radius: number,
  pageSize: number,
  days: number
) {
  const encoded = [userId, keyword, location, String(radius), "0", "0", "0", String(pageSize), String(days)]
    .map((value) => encodeURIComponent(value))
    .join("/");
  return `https://api.careeronestop.org/v2/jobsearch/${encoded}?showFilters=false&enableJobDescriptionSnippet=false&enableMetaData=false`;
}

async function invokeCareerOneStopJobCount(
  occupation: CareerOneStopOccupationSeed,
  options: CareerOneStopProviderOptions
) {
  const url = buildJobSearchUrl(
    options.userId,
    occupation.socCode,
    options.location,
    options.radius,
    1,
    options.days
  );

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.retryCount; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${options.apiToken}`,
          "Accept": "application/json"
        },
        signal: AbortSignal.timeout(options.timeoutSeconds * 1000)
      });

      if (!response.ok) {
        throw new Error(`CareerOneStop request failed: ${response.status}`);
      }

      const payload = await response.json() as CareerOneStopJobSearchResponse;
      if (payload?.ErrorMessage) {
        throw new Error(`CareerOneStop error for ${occupation.socCode}: ${payload.ErrorMessage}`);
      }

      if (payload?.JobsKeywordLocations?.IsValidLocation === false) {
        throw new Error(`CareerOneStop location is invalid: ${options.location}`);
      }

      return clampRange(Number(payload?.JobCount || 0), 0, Number.MAX_SAFE_INTEGER);
    } catch (error) {
      lastError = error;
      if (attempt >= options.retryCount) break;
      await wait(options.retryDelaySeconds * attempt * 1000);
    }
  }

  throw lastError;
}

async function mapWithConcurrency<TInput, TResult>(
  values: TInput[],
  concurrency: number,
  worker: (value: TInput, index: number) => Promise<TResult>
) {
  const safeConcurrency = Math.max(1, concurrency);
  const results = new Array<TResult>(values.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(safeConcurrency, values.length) }, () => runWorker()));
  return results;
}

export function getCareerOneStopProviderOptions(historyPath: string, useExistingHistoryOnly: boolean) {
  const args = parseCliArgs(process.argv.slice(2));
  const apiToken = normalizeSecretValue(
    getStringArg(args, "careerOneStopApiToken", "careeronestopapitoken", "careerOneStopToken", "careeronestoptoken")
  ) || normalizeSecretValue(process.env.CAREERONESTOP_API_TOKEN);
  const userId = normalizeSecretValue(
    getStringArg(args, "careerOneStopUserId", "careeronestopuserid")
  ) || normalizeSecretValue(process.env.CAREERONESTOP_USER_ID);

  return {
    apiToken,
    userId,
    location: getStringArg(args, "careerOneStopLocation", "careeronestoplocation") || normalizeSecretValue(process.env.CAREERONESTOP_LOCATION) || "US",
    radius: getNumberArg(args, ["careerOneStopRadius", "careeronestopradius"], 0),
    days: getNumberArg(args, ["careerOneStopDays", "careeronestopdays"], 30),
    timeoutSeconds: getNumberArg(args, ["careerOneStopTimeoutSeconds", "careeronestoptimeoutseconds"], 30),
    retryCount: getNumberArg(args, ["careerOneStopRetryCount", "careeronestopretrycount"], 3),
    retryDelaySeconds: getNumberArg(args, ["careerOneStopRetryDelaySeconds", "careeronestopretrydelayseconds"], 2),
    concurrency: getNumberArg(args, ["careerOneStopConcurrency", "careeronestopconcurrency"], 6),
    historyPath:
      getStringArg(args, "careerOneStopHistoryPath", "careeronestophistorypath") ||
      historyPath,
    useExistingHistoryOnly
  } satisfies CareerOneStopProviderOptions;
}

export function isCareerOneStopEnabled(options: CareerOneStopProviderOptions) {
  return Boolean(options.apiToken && options.userId);
}

export async function rebuildCareerOneStopHistory(
  occupations: CareerOneStopOccupationSeed[],
  options: CareerOneStopProviderOptions
) {
  const existing = await readJsonFile<CareerOneStopHistoryFile>(options.historyPath);

  if (!isCareerOneStopEnabled(options)) {
    if (existing) {
      writeStep("CareerOneStop source skipped (no API credentials); using existing history if available");
    }
    return existing;
  }

  if (options.useExistingHistoryOnly) {
    return existing;
  }

  const today = toIsoDate();
  const seedHistory: CareerOneStopHistoryFile = existing || {
    source: "CareerOneStop Jobs V2",
    lastRun: today,
    location: options.location,
    days: options.days,
    occupations: []
  };

  const existingIndex = new Map<string, CareerOneStopHistoryOccupationEntry>();
  for (const entry of seedHistory.occupations || []) {
    existingIndex.set(entry.socCode, {
      socCode: entry.socCode,
      title: entry.title,
      majorGroup: entry.majorGroup,
      daily: Array.isArray(entry.daily) ? entry.daily : []
    });
  }

  writeStep(`Loading CareerOneStop jobs for ${occupations.length} SOC occupations`);

  const results = await mapWithConcurrency(occupations, options.concurrency, async (occupation, index) => {
    if (index > 0 && index % 100 === 0) {
      writeStep(`CareerOneStop progress ${index}/${occupations.length}`);
    }

    try {
      const count = await invokeCareerOneStopJobCount(occupation, options);
      return { occupation, count };
    } catch (error) {
      const fallback = getLatestKnownCount(existingIndex.get(occupation.socCode));
      console.warn(
        `CareerOneStop warning for ${occupation.socCode} (${occupation.title}): ${
          error instanceof Error ? error.message : String(error)
        }. Falling back to previous count ${fallback}.`
      );
      return { occupation, count: fallback };
    }
  });

  for (const result of results) {
    const existingEntry = existingIndex.get(result.occupation.socCode) || {
      socCode: result.occupation.socCode,
      title: result.occupation.title,
      majorGroup: result.occupation.majorGroup,
      daily: []
    };

    existingEntry.title = result.occupation.title;
    existingEntry.majorGroup = result.occupation.majorGroup;
    existingEntry.daily = (existingEntry.daily || []).filter((point) => point.date !== today);
    existingEntry.daily.push({
      date: today,
      count: clampRange(Math.round(Number(result.count || 0)), 0, Number.MAX_SAFE_INTEGER)
    });
    existingIndex.set(result.occupation.socCode, existingEntry);
  }

  const nextHistory: CareerOneStopHistoryFile = {
    source: "CareerOneStop Jobs V2",
    lastRun: today,
    location: options.location,
    days: options.days,
    occupations: [...existingIndex.values()].sort((left, right) => left.socCode.localeCompare(right.socCode))
  };

  await writeJsonFile(options.historyPath, nextHistory);
  return nextHistory;
}
