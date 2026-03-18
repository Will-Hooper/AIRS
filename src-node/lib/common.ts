import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type CliValue = string | boolean;
export type CliArgs = Record<string, CliValue>;

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("-")) continue;

    const rawKey = token.replace(/^-+/, "");
    const normalizedKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, "");
    const next = argv[index + 1];
    const hasExplicitValue = typeof next === "string" && !next.startsWith("-");

    args[normalizedKey] = hasExplicitValue ? next : true;
    if (hasExplicitValue) {
      index += 1;
    }
  }

  return args;
}

export function getStringArg(args: CliArgs, ...names: string[]) {
  for (const name of names) {
    const value = args[name.toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function getNumberArg(args: CliArgs, names: string[], fallback: number) {
  const raw = getStringArg(args, ...names);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getBooleanArg(args: CliArgs, ...names: string[]) {
  for (const name of names) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const value = args[normalized];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lowered = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(lowered)) return true;
      if (["false", "0", "no", "n"].includes(lowered)) return false;
    }
  }
  return false;
}

export function normalizeSecretValue(value: string | undefined | null) {
  if (!value) return "";

  let text = String(value).replace(/[\r\n\t]/g, "").trim();
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
      text = text.slice(1, -1).trim();
    }
  }

  return text;
}

export async function ensureDirectory(targetPath: string) {
  await mkdir(targetPath, { recursive: true });
}

export async function fileExists(targetPath: string) {
  try {
    const entry = await stat(targetPath);
    return entry.isFile();
  } catch {
    return false;
  }
}

export async function directoryExists(targetPath: string) {
  try {
    const entry = await stat(targetPath);
    return entry.isDirectory();
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(targetPath: string): Promise<T | null> {
  if (!(await fileExists(targetPath))) return null;
  const raw = (await readFile(targetPath, "utf8")).replace(/^\uFEFF/, "");
  if (!raw.trim()) return null;
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(targetPath: string, value: unknown) {
  await ensureDirectory(path.dirname(targetPath));
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeStep(message: string) {
  const timestamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
  console.log(`[${timestamp}] ${message}`);
}

export function clampUnit(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function clampRange(value: number, min = 0, max = 100) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function safeAverage(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function empiricalPercentile(value: number, population: number[]) {
  if (population.length <= 1) return 0.5;
  const sorted = [...population].sort((left, right) => left - right);
  const lessOrEqual = sorted.filter((entry) => entry <= value).length;
  return clampUnit((lessOrEqual - 1) / (sorted.length - 1));
}

export function normalizeText(value: string | undefined | null) {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\-/ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function testTextTerm(text: string, term: string) {
  if (!text || !term) return false;
  const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, "i").test(text);
}

export function testTextTerms(text: string, terms: string[]) {
  return terms.some((term) => testTextTerm(text, term));
}

export async function readTabFile(targetPath: string): Promise<Record<string, string>[]> {
  if (!(await fileExists(targetPath))) {
    return [];
  }

  const raw = await readFile(targetPath, "utf8");
  if (!raw.trim()) {
    return [];
  }

  return parse(raw, {
    columns: true,
    delimiter: "\t",
    relax_column_count: true,
    quote: false,
    skip_empty_lines: true,
    bom: true
  }) as Record<string, string>[];
}

export function getRowValue(
  row: Record<string, string> | undefined | null,
  names: string[],
  defaultValue = ""
) {
  if (!row) return defaultValue;

  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return defaultValue;
}

export function toDoubleSafe(value: string | number | undefined | null, defaultValue = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : defaultValue;
  }
  if (!value) return defaultValue;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function toIntSafe(value: string | number | undefined | null, defaultValue = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : defaultValue;
  }
  if (!value) return defaultValue;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function normalizeTitleKey(value: string | undefined | null) {
  const text = normalizeText(value);
  if (!text) return "";
  return text.replace(/\b(and|for|the|of|to|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeToken(token: string | undefined | null) {
  if (!token) return "";
  const value = token.trim();
  if (value.length > 4 && value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.length > 3 && value.endsWith("es")) {
    return value.slice(0, -2);
  }
  if (value.length > 3 && value.endsWith("s")) {
    return value.slice(0, -1);
  }
  return value;
}

export function getTextTokens(value: string | undefined | null) {
  const normalized = normalizeTitleKey(value);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((token) => normalizeToken(token))
    .filter((token) => token && token.length >= 3);
}

export function getTokenSimilarity(left: string[], right: string[]) {
  const leftUnique = [...new Set(left)].sort();
  const rightUnique = [...new Set(right)].sort();
  if (!leftUnique.length || !rightUnique.length) return 0;

  const rightSet = new Set(rightUnique);
  const intersection = leftUnique.filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftUnique, ...rightUnique]).size;
  return union ? intersection / union : 0;
}
