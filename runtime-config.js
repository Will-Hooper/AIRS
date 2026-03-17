function parseBoolean(value) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function readMeta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? "";
}

function readQueryFlag(name) {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(name)) return null;
  return parseBoolean(params.get(name));
}

const runtimeOverride = window.AIRS_RUNTIME_CONFIG || {};
const strictDataMode =
  readQueryFlag("strictDataMode") ??
  parseBoolean(runtimeOverride.strictDataMode) ??
  parseBoolean(readMeta("airs-strict-data-mode")) ??
  false;

const environment =
  new URLSearchParams(window.location.search).get("environment") ||
  runtimeOverride.environment ||
  readMeta("airs-environment") ||
  "development";

export const RUNTIME_CONFIG = {
  strictDataMode,
  environment
};

export function isStrictDataMode() {
  return RUNTIME_CONFIG.strictDataMode;
}

export function getRuntimeEnvironment() {
  return RUNTIME_CONFIG.environment;
}
