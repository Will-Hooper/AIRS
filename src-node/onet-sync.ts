import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import {
  fileExists,
  getBooleanArg,
  getStringArg,
  parseCliArgs,
  readJsonFile,
  writeJsonFile
} from "./lib/common";

interface OnetSyncOptions {
  onetDataDir: string;
  databasePageUrl: string;
  archivePageUrl: string;
  downloadUrl: string;
  zipPath: string;
  force: boolean;
  skipRebuild: boolean;
  outputPath: string;
  historyPath: string;
  baselinePath: string;
}

interface OnetReference {
  fileName: string;
  version: string;
  url: string;
}

const REQUIRED_FILES = [
  "Occupation Data.txt",
  "Task Statements.txt",
  "Task Ratings.txt"
];

const OPTIONAL_FILES = [
  "Technology Skills.txt",
  "Job Zones.txt",
  "Sample of Reported Titles.txt"
];

async function findFileRecursively(root: string, fileName: string): Promise<string> {
  const direct = path.join(root, fileName);
  if (await fileExists(direct)) {
    return direct;
  }

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = await findFileRecursively(path.join(root, entry.name), fileName);
    if (match) return match;
  }

  return "";
}

function parseOptions(): OnetSyncOptions {
  const args = parseCliArgs(process.argv.slice(2));
  const scriptRoot = path.resolve(__dirname, "..", "..", "backend");
  const dataDir = path.join(scriptRoot, "data");

  return {
    onetDataDir: getStringArg(args, "onetDataDir", "onetdatadir") || path.join(dataDir, "onet"),
    databasePageUrl: getStringArg(args, "databasePageUrl", "databasepageurl") || "https://www.onetcenter.org/database.html",
    archivePageUrl: getStringArg(args, "archivePageUrl", "archivepageurl") || "https://www.onetcenter.org/db_releases.html",
    downloadUrl: getStringArg(args, "downloadUrl", "downloadurl"),
    zipPath: getStringArg(args, "zipPath", "zippath"),
    force: getBooleanArg(args, "force"),
    skipRebuild: getBooleanArg(args, "skipRebuild", "skiprebuild"),
    outputPath: getStringArg(args, "outputPath", "outputpath"),
    historyPath: getStringArg(args, "historyPath", "historypath"),
    baselinePath: getStringArg(args, "baselinePath", "baselinepath")
  };
}

function getLatestZipReference(html: string): OnetReference | null {
  const matches = [...html.matchAll(/db_(\d+)_(\d+)_text\.zip/gi)];
  if (!matches.length) return null;

  let best: RegExpMatchArray | null = null;
  let bestMajor = -1;
  let bestMinor = -1;
  for (const match of matches) {
    const major = Number(match[1] || -1);
    const minor = Number(match[2] || -1);
    if (major > bestMajor || (major === bestMajor && minor > bestMinor)) {
      best = match;
      bestMajor = major;
      bestMinor = minor;
    }
  }

  if (!best?.[0]) return null;
  return {
    fileName: best[0],
    version: `${bestMajor}.${bestMinor}`,
    url: `https://www.onetcenter.org/dl_files/database/${best[0]}`
  };
}

async function resolveOnetDownload(options: OnetSyncOptions): Promise<OnetReference> {
  if (options.downloadUrl) {
    const name = path.basename(options.downloadUrl);
    const ref = getLatestZipReference(name);
    if (ref) {
      return { ...ref, url: options.downloadUrl };
    }
    return {
      fileName: name,
      version: "custom",
      url: options.downloadUrl
    };
  }

  for (const pageUrl of [options.databasePageUrl, options.archivePageUrl]) {
    try {
      const response = await fetch(pageUrl, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) continue;
      const html = await response.text();
      const ref = getLatestZipReference(html);
      if (ref) return ref;
    } catch {
      // try next page
    }
  }

  throw new Error("Could not discover the latest O*NET text zip from official pages.");
}

async function downloadFile(url: string, targetPath: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) {
    throw new Error(`O*NET download failed: ${response.status}`);
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(targetPath, buffer);
}

async function copySelectedFiles(sourceDir: string, targetDir: string) {
  for (const name of REQUIRED_FILES) {
    const source = await findFileRecursively(sourceDir, name);
    if (!source) {
      throw new Error(`Missing required O*NET file in extracted archive: ${name}`);
    }
  }

  await mkdir(targetDir, { recursive: true });
  const copied = new Set<string>();
  for (const name of [...REQUIRED_FILES, ...OPTIONAL_FILES]) {
    const source = await findFileRecursively(sourceDir, name);
    if (!source) continue;
    const destination = path.join(targetDir, name);
    await copyFile(source, destination);
    copied.add(name);
  }

  return [...copied].sort();
}

async function runUsaJobsRebuild(options: OnetSyncOptions) {
  const modulePath = path.resolve(__dirname, "usajobs-sync.js");
  const childArgs = [
    modulePath,
    "--useExistingHistoryOnly",
    "--onetDataDir", options.onetDataDir
  ];
  if (options.outputPath) childArgs.push("--outputPath", options.outputPath);
  if (options.historyPath) childArgs.push("--historyPath", options.historyPath);
  if (options.baselinePath) childArgs.push("--baselinePath", options.baselinePath);

  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, childArgs, {
      stdio: "inherit"
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`USAJOBS rebuild failed with exit code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

async function main() {
  const options = parseOptions();
  const cacheDir = path.join(options.onetDataDir, ".cache");
  const stageDir = path.join(cacheDir, "stage");
  const metaPath = path.join(options.onetDataDir, "sync_meta.json");

  await mkdir(options.onetDataDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });

  const resolved = options.zipPath
    ? {
        fileName: path.basename(options.zipPath),
        version: "local",
        url: ""
      }
    : await resolveOnetDownload(options);

  const existingMeta = await readJsonFile<{ version?: string }>(metaPath);
  const currentVersion = existingMeta?.version || "";
  const zipFilePath = options.zipPath || path.join(cacheDir, resolved.fileName);

  if (!options.zipPath) {
    const needsDownload = options.force || !(await fileExists(zipFilePath)) || resolved.version !== currentVersion;
    if (needsDownload) {
      await downloadFile(resolved.url, zipFilePath);
    }
  }

  if (!(await fileExists(zipFilePath))) {
    throw new Error(`O*NET zip not found: ${zipFilePath}`);
  }

  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });

  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(stageDir, true);
  const copiedFiles = await copySelectedFiles(stageDir, options.onetDataDir);

  await writeJsonFile(metaPath, {
    version: resolved.version,
    sourceUrl: resolved.url,
    zipFile: zipFilePath,
    syncedAt: new Date().toISOString(),
    files: copiedFiles
  });

  if (!options.skipRebuild) {
    await runUsaJobsRebuild(options);
  }

  console.log(`O*NET sync complete. Version: ${resolved.version}. Files: ${copiedFiles.length}. Directory: ${options.onetDataDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
