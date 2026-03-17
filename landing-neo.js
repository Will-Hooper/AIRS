import { getOccupations, getSummary } from "./api-client.js";
import { applyTranslations, getInitialLanguage, groupText, labelText, persistLanguage, t } from "./i18n-neo.js";
import { getRuntimeEnvironment, isStrictDataMode } from "./runtime-config.js";

const state = {
  date: "",
  region: "National",
  majorGroup: "all",
  label: "all",
  q: "",
  selectedSocCode: null,
  zoom: 0.92,
  rows: [],
  lang: getInitialLanguage(),
  meta: null,
  summary: null,
  timeContext: null,
  viewMode: "market",
  storyStep: "market",
  panX: 0,
  panY: 0,
  hoverQuadrant: null,
  hoverPointerX: 50,
  hoverPointerY: 42,
  loadError: null,
  dataMode: null,
  dataSource: null
};

const els = {
  riskTickerTrack: document.getElementById("riskTickerTrack"),
  dateSelect: document.getElementById("dateSelect"),
  regionSelect: document.getElementById("regionSelect"),
  majorGroupSelect: document.getElementById("majorGroupSelect"),
  labelSelect: document.getElementById("labelSelect"),
  searchInput: document.getElementById("searchInput"),
  visitorTime: document.getElementById("visitorTime"),
  visitorPlace: document.getElementById("visitorPlace"),
  lastUpdatedLabel: document.getElementById("lastUpdatedLabel"),
  dataModeLabel: document.getElementById("dataModeLabel"),
  environmentLabel: document.getElementById("environmentLabel"),
  pageAlert: document.getElementById("pageAlert"),
  pageAlertTitle: document.getElementById("pageAlertTitle"),
  pageAlertText: document.getElementById("pageAlertText"),
  avgAirs: document.getElementById("avgAirs"),
  highRiskCount: document.getElementById("highRiskCount"),
  occupationCount: document.getElementById("occupationCount"),
  zoomIndicator: document.getElementById("zoomIndicator"),
  restructuringRate: document.getElementById("restructuringRate"),
  augmentingRate: document.getElementById("augmentingRate"),
  mostChangedOccupation: document.getElementById("mostChangedOccupation"),
  mostChangedDelta: document.getElementById("mostChangedDelta"),
  occupationUniverse: document.getElementById("occupationUniverse"),
  occupationCanvas: document.getElementById("occupationCanvas"),
  heroFocusTitle: document.getElementById("heroFocusTitle"),
  heroFocusScore: document.getElementById("heroFocusScore"),
  heroFocusLabel: document.getElementById("heroFocusLabel"),
  detailTitle: document.getElementById("detailTitle"),
  detailScore: document.getElementById("detailScore"),
  detailLabel: document.getElementById("detailLabel"),
  detailSummary: document.getElementById("detailSummary"),
  detailSoc: document.getElementById("detailSoc"),
  focusGroup: document.getElementById("focusGroup"),
  focusPostings: document.getElementById("focusPostings"),
  focusDelta: document.getElementById("focusDelta"),
  occupationLabelLayer: document.getElementById("occupationLabelLayer"),
  replacementBar: document.getElementById("replacementBar"),
  augmentationBar: document.getElementById("augmentationBar"),
  hiringBar: document.getElementById("hiringBar"),
  historicalBar: document.getElementById("historicalBar"),
  quadrantTooltip: document.getElementById("quadrantTooltip"),
  quadrantTooltipTag: document.getElementById("quadrantTooltipTag"),
  quadrantTooltipTitle: document.getElementById("quadrantTooltipTitle"),
  quadrantTooltipText: document.getElementById("quadrantTooltipText"),
  replacementValue: document.getElementById("replacementValue"),
  augmentationValue: document.getElementById("augmentationValue"),
  hiringValue: document.getElementById("hiringValue"),
  historicalValue: document.getElementById("historicalValue"),
  signalSelectionTitle: document.getElementById("signalSelectionTitle"),
  signalSelectionSummary: document.getElementById("signalSelectionSummary"),
  detailLink: document.getElementById("detailLink"),
  portalButton: document.getElementById("portalButton"),
  downButton: document.getElementById("downButton"),
  languageButtons: document.querySelectorAll("[data-lang-option]"),
  viewButtons: document.querySelectorAll("[data-view-mode]"),
  storyCards: document.querySelectorAll("[data-story-step]"),
  storyStageTitle: document.getElementById("storyStageTitle"),
  storyStageText: document.getElementById("storyStageText"),
  storyStageIndex: document.getElementById("storyStageIndex"),
  storyStageTotal: document.getElementById("storyStageTotal"),
  storyStageView: document.getElementById("storyStageView"),
  releaseEnvironment: document.getElementById("releaseEnvironment"),
  releaseDataMode: document.getElementById("releaseDataMode"),
  releaseUpdatedAt: document.getElementById("releaseUpdatedAt"),
  releaseCoverage: document.getElementById("releaseCoverage"),
  releaseSource: document.getElementById("releaseSource")
};

let clockTimer = null;
let searchTimer = null;
let loadToken = 0;
let revealObserver = null;
let storyObserver = null;
let cameraFrame = 0;
let quadrantOverlapFrame = 0;
const camera = {
  initialized: false,
  zoom: 1,
  targetZoom: 1,
  offsetX: 0,
  offsetY: 0,
  targetOffsetX: 0,
  targetOffsetY: 0
};
const numberFrames = new WeakMap();
const nodeElements = new Map();
const labelElements = new Map();
const dragState = {
  active: false,
  moved: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  originPanX: 0,
  originPanY: 0
};

const HOME_COPY = {
  en: {
    ticker_label: "Live risk feed",
    nav_cta: "Inspect live field",
    view_kicker: "Universe views",
    view_title: "Switch the field between market, SOC group, and risk cluster layouts.",
    view_market: "Market map",
    view_group: "SOC groups",
    view_risk: "Risk clusters",
    story_kicker: "Scroll narrative",
    story_hint: "Use the wheel to zoom, drag to pan, and let the scroll sync the camera narrative.",
    story_metric_a_label: "Active view",
    story_metric_b_label: "Interaction",
    story_metric_b_value: "Wheel + drag",
    story_focus_view: "Focus lock",
    story_stage_market_title: "Start with the whole market in one frame.",
    story_stage_market_text: "Lay every occupation across a single AIRS horizon so the macro distribution is visible before any drill-down begins.",
    story_stage_group_title: "Then separate the market into SOC structure.",
    story_stage_group_text: "The same occupations reorganize by BLS major groups so you can see where hiring pressure is concentrated inside the labor taxonomy.",
    story_stage_risk_title: "Next, cluster the field by penetration pattern.",
    story_stage_risk_text: "Roles with similar replacement, augmentation and hiring pressure collapse into local neighborhoods you can inspect by drag and zoom.",
    story_stage_focus_title: "Finally, lock onto one selected occupation.",
    story_stage_focus_text: "The camera tightens around the currently selected node so the detail page feels like a continuation of the same analytical path.",
    pressure_title_a: "The risk is concentrated, not uniform.",
    pressure_text_a: "A small share of occupations now carries most of the near-term AI restructuring pressure across hiring demand.",
    pressure_title_b: "Augmentation is replacing headcount growth in many roles.",
    pressure_text_b: "Many jobs are still open, but the work itself is being rewritten around AI-assisted execution and narrower staffing patterns.",
    pressure_title_c: "The biggest moves show up in the hiring language first.",
    method_kicker: "System flow",
    method_title: "How the AIRS workflow turns job demand into a live exposure field.",
    method_text: "We ingest external demand, normalize occupations into BLS SOC groups, score AI exposure, and keep the result explorable down to one job.",
    step_title_1: "Ingest live hiring demand",
    step_text_1: "Collect updated job signals and occupational evidence from the external pipeline.",
    step_title_2: "Map into SOC structure",
    step_text_2: "Normalize every signal into the BLS major-group and occupation hierarchy.",
    step_title_3: "Score AI penetration",
    step_text_3: "Combine replacement, augmentation, hiring and historical pressure into a single AIRS reading.",
    step_title_4: "Move from market to one role",
    step_text_4: "Filter, zoom and open the occupation page without leaving the current analytical context.",
    signal_kicker_b: "Why this matters",
    signal_title_b: "The key signal is not whether AI exists in a role, but whether it is compressing the number and shape of hires.",
    signal_text_b: "That distinction is where macro labor-market dashboards usually fail. AIRS keeps the labor signal tied to the occupation structure itself.",
    signal_kicker_c: "Next move",
    signal_title_c: "Open one occupation and keep the same context all the way into the detail page.",
    signal_text_c: "The selected job, date, region and language persist so the transition feels like a continuation of the same analysis, not a reset."
  },
  zh: {
    ticker_label: "\u5b9e\u65f6\u98ce\u9669\u6d41",
    nav_cta: "\u67e5\u770b\u5b9e\u65f6\u89c6\u56fe",
    view_kicker: "\u89c6\u56fe\u5207\u6362",
    view_title: "\u53ef\u6309\u6574\u4f53\u5e02\u573a\u3001BLS \u804c\u4e1a\u5927\u7c7b\u6216\u98ce\u9669\u805a\u7c7b\u67e5\u770b\u804c\u4e1a\u5206\u5e03\u3002",
    view_market: "\u6574\u4f53\u5e02\u573a",
    view_group: "\u804c\u4e1a\u5927\u7c7b",
    view_risk: "\u98ce\u9669\u805a\u7c7b",
    story_kicker: "\u9605\u8bfb\u8def\u5f84",
    story_hint: "\u7528\u6eda\u8f6e\u7f29\u653e\uff0c\u6309\u4f4f\u62d6\u62fd\u5e73\u79fb\uff1b\u968f\u7740\u9875\u9762\u5411\u4e0b\u6eda\u52a8\uff0c\u89c6\u56fe\u4f1a\u81ea\u52a8\u5207\u6362\u5230\u4e0d\u540c\u5206\u6790\u5c42\u7ea7\u3002",
    story_metric_a_label: "\u5f53\u524d\u89c6\u89d2",
    story_metric_b_label: "\u64cd\u4f5c\u65b9\u5f0f",
    story_metric_b_value: "\u6eda\u8f6e + \u62d6\u62fd",
    story_focus_view: "\u804c\u4e1a\u805a\u7126",
    story_stage_market_title: "\u5148\u770b\u6574\u4e2a\u5e02\u573a\u7684\u603b\u4f53\u5206\u5e03\u3002",
    story_stage_market_text: "\u628a\u5168\u90e8\u804c\u4e1a\u653e\u5230\u540c\u4e00\u5f20 AIRS \u56fe\u4e0a\uff0c\u5148\u770b\u54ea\u4e9b\u804c\u4e1a\u66f4\u7a33\u5b9a\uff0c\u54ea\u4e9b\u804c\u4e1a\u7684\u62db\u8058\u5df2\u5f00\u59cb\u88ab\u538b\u7f29\u3002",
    story_stage_group_title: "\u518d\u6309 BLS \u804c\u4e1a\u5927\u7c7b\u62c6\u5f00\u770b\u3002",
    story_stage_group_text: "\u540c\u4e00\u6279\u804c\u4e1a\u4f1a\u6309 SOC \u5927\u7c7b\u91cd\u65b0\u6392\u5e03\uff0c\u65b9\u4fbf\u770b\u51fa\u538b\u529b\u4e3b\u8981\u96c6\u4e2d\u5728\u54ea\u4e9b\u804c\u4e1a\u677f\u5757\u3002",
    story_stage_risk_title: "\u518d\u6309\u53d7\u5f71\u54cd\u65b9\u5f0f\u91cd\u65b0\u805a\u7c7b\u3002",
    story_stage_risk_text: "\u628a\u66ff\u4ee3\u538b\u529b\u3001AI \u8f85\u52a9\u548c\u62db\u8058\u53d8\u5316\u76f8\u8fd1\u7684\u804c\u4e1a\u653e\u5230\u4e00\u8d77\uff0c\u66f4\u5bb9\u6613\u770b\u51fa\u76f8\u4f3c\u804c\u4e1a\u7fa4\u3002",
    story_stage_focus_title: "\u6700\u540e\u805a\u7126\u5230\u4e00\u4e2a\u5177\u4f53\u804c\u4e1a\u3002",
    story_stage_focus_text: "\u9009\u4e2d\u67d0\u4e2a\u804c\u4e1a\u540e\uff0c\u955c\u5934\u4f1a\u6536\u7d27\u5230\u8fd9\u4e2a\u8282\u70b9\uff0c\u5e76\u628a\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e00\u8d77\u5e26\u5165\u8be6\u60c5\u9875\u3002",
    pressure_title_a: "\u98ce\u9669\u4e0d\u662f\u5e73\u5747\u5206\u5e03\uff0c\u800c\u662f\u96c6\u4e2d\u5728\u5c11\u6570\u804c\u4e1a\u3002",
    pressure_text_a: "\u76ee\u524d AI \u5bf9\u62db\u8058\u7ed3\u6784\u7684\u51b2\u51fb\uff0c\u4e3b\u8981\u96c6\u4e2d\u5728\u5c11\u6570\u804c\u4e1a\uff0c\u4e0d\u662f\u6240\u6709\u804c\u4e1a\u4e00\u8d77\u540c\u6b65\u53d8\u5316\u3002",
    pressure_title_b: "\u4e0d\u5c11\u804c\u4e1a\u4e0d\u662f\u505c\u6b62\u62db\u4eba\uff0c\u800c\u662f\u5148\u6539\u5199\u5de5\u4f5c\u65b9\u5f0f\u3002",
    pressure_text_b: "\u5f88\u591a\u5c97\u4f4d\u4ecd\u7136\u5728\u62db\u4eba\uff0c\u4f46\u5de5\u4f5c\u5185\u5bb9\u5df2\u7ecf\u8f6c\u5411 AI \u8f85\u52a9\u6267\u884c\uff0c\u7528\u4eba\u89c4\u6a21\u548c\u5c97\u4f4d\u8981\u6c42\u4e5f\u5728\u53d8\u5316\u3002",
    pressure_title_c: "\u6700\u65e9\u7684\u53d8\u5316\uff0c\u5f80\u5f80\u5148\u51fa\u73b0\u5728\u62db\u8058\u4fe1\u606f\u91cc\u3002",
    method_kicker: "\u6570\u636e\u6d41\u7a0b",
    method_title: "AIRS \u5982\u4f55\u628a\u62db\u8058\u6570\u636e\u8f6c\u6210\u53ef\u5b9e\u65f6\u6d4f\u89c8\u7684\u804c\u4e1a\u5f71\u54cd\u56fe\u3002",
    method_text: "\u7cfb\u7edf\u4f1a\u63a5\u5165\u5916\u90e8\u62db\u8058\u6570\u636e\uff0c\u6620\u5c04\u5230 BLS SOC \u804c\u4e1a\u5206\u7c7b\uff0c\u8ba1\u7b97 AI \u5f71\u54cd\u5206\u6570\uff0c\u5e76\u652f\u6301\u4e00\u76f4\u4e0b\u94bb\u5230\u5355\u4e2a\u804c\u4e1a\u3002",
    step_title_1: "\u63a5\u5165\u6700\u65b0\u62db\u8058\u6570\u636e",
    step_text_1: "\u4ece\u5916\u90e8\u6570\u636e\u6e90\u83b7\u53d6\u6700\u65b0\u7684\u5c97\u4f4d\u9700\u6c42\u548c\u804c\u4e1a\u4fe1\u53f7\u3002",
    step_title_2: "\u6620\u5c04\u5230 SOC \u804c\u4e1a\u4f53\u7cfb",
    step_text_2: "\u628a\u6570\u636e\u7edf\u4e00\u5230 BLS \u804c\u4e1a\u5927\u7c7b\u548c\u5177\u4f53\u804c\u4e1a\u7ea7\u522b\u3002",
    step_title_3: "\u8ba1\u7b97 AI \u5f71\u54cd\u5206\u6570",
    step_text_3: "\u7efc\u5408\u66ff\u4ee3\u538b\u529b\u3001AI \u8f85\u52a9\u7a0b\u5ea6\u3001\u62db\u8058\u53d8\u5316\u548c\u5386\u53f2\u8d8b\u52bf\uff0c\u5f97\u51fa AIRS \u8bfb\u6570\u3002",
    step_title_4: "\u4ece\u6574\u4f53\u5e02\u573a\u4e0b\u94bb\u5230\u5355\u4e2a\u804c\u4e1a",
    step_text_4: "\u901a\u8fc7\u7b5b\u9009\u3001\u7f29\u653e\u548c\u8df3\u8f6c\u8be6\u60c5\uff0c\u5728\u4e0d\u91cd\u7f6e\u5206\u6790\u4e0a\u4e0b\u6587\u7684\u60c5\u51b5\u4e0b\u7ee7\u7eed\u4e0b\u94bb\u3002",
    signal_kicker_b: "\u4e3a\u4ec0\u4e48\u8fd9\u5f88\u91cd\u8981",
    signal_title_b: "\u5173\u952e\u4e0d\u53ea\u662f AI \u662f\u5426\u8fdb\u5165\u4e86\u8fd9\u4e2a\u804c\u4e1a\uff0c\u800c\u662f\u5b83\u6709\u6ca1\u6709\u5f00\u59cb\u51cf\u5c11\u5c97\u4f4d\u6570\u91cf\u3001\u6539\u53d8\u62db\u8058\u65b9\u5f0f\u3002",
    signal_text_b: "\u5f88\u591a\u5b8f\u89c2\u770b\u677f\u53ea\u80fd\u770b\u5230\u201cAI \u662f\u5426\u51fa\u73b0\u201d\uff0c\u4f46 AIRS \u66f4\u5173\u6ce8\u201c\u62db\u8058\u662f\u5426\u5df2\u7ecf\u88ab\u6539\u5199\u201d\u3002",
    signal_kicker_c: "\u4e0b\u4e00\u6b65",
    signal_title_c: "\u70b9\u5f00\u4e00\u4e2a\u804c\u4e1a\uff0c\u628a\u5f53\u524d\u5206\u6790\u4e0a\u4e0b\u6587\u76f4\u63a5\u5e26\u5165\u8be6\u60c5\u9875\u3002",
    signal_text_c: "\u5f53\u524d\u9009\u4e2d\u7684\u804c\u4e1a\u3001\u65e5\u671f\u3001\u5730\u533a\u548c\u8bed\u8a00\u90fd\u4f1a\u88ab\u4fdd\u7559\uff0c\u8be6\u60c5\u9875\u4e0d\u4f1a\u91cd\u7f6e\u4f60\u7684\u5206\u6790\u72b6\u6001\u3002"
  }
};

const VIEW_PRESETS = {
  market: 0.92,
  group: 1.12,
  risk: 1.28
};

const STORY_SCENES = [
  { id: "market", index: 1, viewMode: "market", zoom: 0.92, titleKey: "story_stage_market_title", textKey: "story_stage_market_text", viewKey: "view_market" },
  { id: "group", index: 2, viewMode: "group", zoom: 1.12, titleKey: "story_stage_group_title", textKey: "story_stage_group_text", viewKey: "view_group" },
  { id: "risk", index: 3, viewMode: "risk", zoom: 1.28, titleKey: "story_stage_risk_title", textKey: "story_stage_risk_text", viewKey: "view_risk" },
  { id: "focus", index: 4, viewMode: "risk", zoom: 1.78, titleKey: "story_stage_focus_title", textKey: "story_stage_focus_text", viewKey: "story_focus_view" }
];

const STORY_SCENE_MAP = new Map(STORY_SCENES.map((scene) => [scene.id, scene]));
const QUADRANT_COPY = {
  topLeft: {
    shortKey: "home.quadrantTopLeftShort",
    titleKey: "home.quadrantTopLeftTitle",
    textKey: "home.quadrantTopLeftText"
  },
  topRight: {
    shortKey: "home.quadrantTopRightShort",
    titleKey: "home.quadrantTopRightTitle",
    textKey: "home.quadrantTopRightText"
  },
  bottomLeft: {
    shortKey: "home.quadrantBottomLeftShort",
    titleKey: "home.quadrantBottomLeftTitle",
    textKey: "home.quadrantBottomLeftText"
  },
  bottomRight: {
    shortKey: "home.quadrantBottomRightShort",
    titleKey: "home.quadrantBottomRightTitle",
    textKey: "home.quadrantBottomRightText"
  }
};

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function locale() { return state.lang === "zh" ? "zh-CN" : "en-US"; }
function number(value) { return Number(value || 0).toLocaleString(locale()); }
function displayTitle(row) { return state.lang === "zh" ? (row.titleZh || row.title) : row.title; }
function displaySummary(row) { return state.lang === "zh" ? (row.summaryZh || row.summary) : row.summary; }
function toneFromAirs(airs) { return 214 - (1 - airs / 100) * 170; }
function formatCompact(value) { return Number(value || 0).toLocaleString(locale(), { maximumFractionDigits: 0 }); }

function copy(language, key) {
  return HOME_COPY[language]?.[key] || HOME_COPY.en[key] || key;
}

function hideQuadrantTooltip() {
  if (!els.quadrantTooltip) return;
  els.quadrantTooltip.hidden = true;
  els.quadrantTooltip.classList.remove("is-visible", "is-overlapped");
  state.hoverQuadrant = null;
}

function getOrCreateLabelElement(row) {
  if (!els.occupationLabelLayer) return null;
  let label = labelElements.get(row.socCode);
  if (label) return label;

  label = document.createElement("div");
  label.className = "occupation-node__label";
  label.innerHTML = `
    <strong></strong>
    <span></span>`;
  els.occupationLabelLayer.appendChild(label);
  labelElements.set(row.socCode, label);
  return label;
}

function labelShouldBeVisible(node) {
  if (!node) return false;
  return (
    node.classList.contains("is-selected") ||
    node.matches(":hover") ||
    els.occupationCanvas?.dataset.zoomState === "close"
  );
}

function updateFloatingLabel(node, row) {
  if (!node || !row || !els.occupationUniverse) return;
  const label = getOrCreateLabelElement(row);
  if (!label) return;

  const strong = label.querySelector("strong");
  const sub = label.querySelector("span");
  if (strong) strong.textContent = displayTitle(row);
  if (sub) sub.textContent = `${row.socCode} - AIRS ${row.airs.toFixed(0)}`;

  const universeRect = els.occupationUniverse.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const centerX = nodeRect.left - universeRect.left + (nodeRect.width / 2);
  const top = nodeRect.top - universeRect.top - 14;
  label.style.left = `${centerX}px`;
  label.style.top = `${top}px`;
  label.classList.toggle("is-visible", labelShouldBeVisible(node));
}

function syncFloatingLabels() {
  if (!els.occupationLabelLayer) return;
  const rowsBySoc = new Map(state.rows.map((row) => [row.socCode, row]));

  nodeElements.forEach((node, socCode) => {
    const row = rowsBySoc.get(socCode);
    if (!row) return;
    updateFloatingLabel(node, row);
  });

  labelElements.forEach((label, socCode) => {
    if (rowsBySoc.has(socCode) && nodeElements.has(socCode)) return;
    label.remove();
    labelElements.delete(socCode);
  });
}

function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function syncQuadrantTooltipOverlap() {
  if (!els.quadrantTooltip || els.quadrantTooltip.hidden) return;
  const tooltipRect = els.quadrantTooltip.getBoundingClientRect();
  if (!tooltipRect.width || !tooltipRect.height) {
    els.quadrantTooltip.classList.remove("is-overlapped");
    return;
  }

  const hasOverlap = [...labelElements.values()].some((label) => {
    if (!label.classList.contains("is-visible")) {
      return false;
    }

    const style = window.getComputedStyle(label);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 0) < 0.05) {
      return false;
    }

    const labelRect = label.getBoundingClientRect();
    if (!labelRect.width || !labelRect.height) {
      return false;
    }

    return rectsOverlap(tooltipRect, labelRect);
  });

  els.quadrantTooltip.classList.toggle("is-overlapped", hasOverlap);
}

function queueQuadrantTooltipOverlapSync() {
  if (quadrantOverlapFrame) return;
  quadrantOverlapFrame = requestAnimationFrame(() => {
    quadrantOverlapFrame = 0;
    syncFloatingLabels();
    syncQuadrantTooltipOverlap();
  });
}

function quadrantFromPointer(x, y) {
  if (x < 50 && y < 50) return "topLeft";
  if (x >= 50 && y < 50) return "topRight";
  if (x < 50 && y >= 50) return "bottomLeft";
  return "bottomRight";
}

function renderQuadrantTooltip(quadrant, clientX, clientY) {
  if (!els.quadrantTooltip || !els.occupationUniverse) return;
  const quadrantCopy = QUADRANT_COPY[quadrant];
  if (!quadrantCopy) return;

  state.hoverQuadrant = quadrant;
  els.quadrantTooltip.hidden = false;
  els.quadrantTooltipTag.textContent = t(state.lang, quadrantCopy.shortKey);
  els.quadrantTooltipTitle.textContent = t(state.lang, quadrantCopy.titleKey);
  els.quadrantTooltipText.textContent = t(state.lang, quadrantCopy.textKey);
  els.quadrantTooltip.classList.add("is-visible");

  const rect = els.occupationUniverse.getBoundingClientRect();
  const tooltipWidth = els.quadrantTooltip.offsetWidth || 320;
  const tooltipHeight = els.quadrantTooltip.offsetHeight || 150;
  const left = clamp((clientX - rect.left) + 18, 14, Math.max(14, rect.width - tooltipWidth - 14));
  const top = clamp((clientY - rect.top) + 18, 14, Math.max(14, rect.height - tooltipHeight - 14));
  els.quadrantTooltip.style.left = `${left}px`;
  els.quadrantTooltip.style.top = `${top}px`;
  queueQuadrantTooltipOverlapSync();
}

function renderModeLabel(mode) {
  if (mode === "json") return t(state.lang, "home.jsonMode");
  if (mode === "api" && isStrictDataMode()) return t(state.lang, "home.strictLiveMode");
  if (mode === "api") return t(state.lang, "home.liveApiMode");
  if (mode === "mock") return t(state.lang, "home.mockMode");
  return t(state.lang, "home.unavailableMode");
}

function renderEnvironmentLabel() {
  const environment = (getRuntimeEnvironment() || "development").toLowerCase();
  if (environment === "production") return t(state.lang, "home.environmentProduction");
  if (environment === "staging") return t(state.lang, "home.environmentStaging");
  if (environment === "preview") return t(state.lang, "home.environmentPreview");
  return t(state.lang, "home.environmentDevelopment");
}

function coverageLabel() {
  return state.lang === "zh" ? "美国 / BLS SOC" : "United States / BLS SOC";
}

function renderSourceLabel(source) {
  if (source === "json") return t(state.lang, "home.sourceJson");
  if (source === "database") return t(state.lang, "home.sourceDatabase");
  if (source === "mock") return t(state.lang, "home.sourceMock");
  return t(state.lang, "home.sourceUnavailable");
}

function syncReleaseNotes(mode, updatedAt, source) {
  const environmentText = renderEnvironmentLabel();
  const modeText = renderModeLabel(mode);
  const updatedText = updatedAt
    ? new Date(updatedAt).toLocaleString(locale(), { hour12: false })
    : "--";

  if (els.environmentLabel) els.environmentLabel.textContent = `${t(state.lang, "home.statusEnvironment")} ${environmentText}`;
  if (els.releaseEnvironment) els.releaseEnvironment.textContent = environmentText;
  if (els.releaseDataMode) els.releaseDataMode.textContent = modeText;
  if (els.releaseUpdatedAt) els.releaseUpdatedAt.textContent = updatedText;
  if (els.releaseCoverage) els.releaseCoverage.textContent = coverageLabel();
  if (els.releaseSource) els.releaseSource.textContent = renderSourceLabel(source);
}

function showPageAlert() {
  if (!els.pageAlert) return;
  els.pageAlert.hidden = false;
  els.pageAlertTitle.textContent = t(state.lang, "home.dataUnavailableTitle");
  els.pageAlertText.textContent = `${t(state.lang, "home.dataUnavailableSummary")} ${t(state.lang, "home.dataUnavailableHint")}`;
}

function hidePageAlert() {
  if (!els.pageAlert) return;
  els.pageAlert.hidden = true;
}

function resetSummaryStats() {
  [els.avgAirs, els.highRiskCount, els.occupationCount, els.restructuringRate, els.augmentingRate].forEach((element) => {
    if (!element) return;
    element.dataset.value = "0";
    element.textContent = "--";
  });
  els.mostChangedOccupation.textContent = "--";
  els.mostChangedDelta.textContent = "--";
}

function animateNumber(element, value, options = {}) {
  if (!element) return;
  const {
    decimals = 0,
    prefix = "",
    suffix = "",
    formatter = (next) => `${prefix}${next.toLocaleString(locale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
    duration = 420
  } = options;
  const previousFrame = numberFrames.get(element);
  if (previousFrame) cancelAnimationFrame(previousFrame);
  const from = Number(element.dataset.value || 0);
  const to = Number(value || 0);
  const start = performance.now();

  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const next = from + (to - from) * eased;
    element.textContent = formatter(next);
    if (progress < 1) {
      numberFrames.set(element, requestAnimationFrame(step));
    } else {
      element.dataset.value = `${to}`;
      element.textContent = formatter(to);
      numberFrames.delete(element);
    }
  };

  numberFrames.set(element, requestAnimationFrame(step));
}

function setOptions(select, options, label, mapper = (value) => value) {
  select.innerHTML = [`<option value="all">${label}</option>`, ...options.map((value) => `<option value="${value}">${mapper(value)}</option>`)].join("");
}

function applyNarrativeCopy() {
  document.querySelectorAll("[data-copy]").forEach((element) => {
    element.textContent = copy(state.lang, element.dataset.copy);
  });
}

function currentScene() {
  return STORY_SCENE_MAP.get(state.storyStep) || STORY_SCENE_MAP.get("market");
}

function updateViewButtons() {
  els.viewButtons.forEach((button) => {
    const active = button.dataset.viewMode === state.viewMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateStoryStagePanel() {
  const scene = currentScene();
  if (!scene) return;
  if (els.storyStageTitle) els.storyStageTitle.textContent = copy(state.lang, scene.titleKey);
  if (els.storyStageText) els.storyStageText.textContent = copy(state.lang, scene.textKey);
  if (els.storyStageIndex) els.storyStageIndex.textContent = String(scene.index).padStart(2, "0");
  if (els.storyStageTotal) els.storyStageTotal.textContent = `/ ${String(STORY_SCENES.length).padStart(2, "0")}`;
  if (els.storyStageView) els.storyStageView.textContent = copy(state.lang, scene.viewKey);
  els.storyCards.forEach((card) => {
    card.classList.toggle("is-active", card.dataset.storyStep === scene.id);
  });
  document.body.dataset.storyStep = scene.id;
}

function refreshStaticLanguage() {
  persistLanguage(state.lang);
  applyTranslations(document, state.lang);
  applyNarrativeCopy();
  document.title = t(state.lang, "home.pageTitle");
  els.languageButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.langOption === state.lang);
  });
  updateViewButtons();
  updateStoryStagePanel();
  if (state.summary?.updatedAt) {
    els.lastUpdatedLabel.textContent = `${t(state.lang, "home.updatedPrefix")} ${new Date(state.summary.updatedAt).toLocaleString(locale(), { hour12: false })}`;
  } else {
    els.lastUpdatedLabel.textContent = `${t(state.lang, "home.updatedPrefix")} --`;
  }
  if (state.dataMode || state.loadError) {
    els.dataModeLabel.textContent = renderModeLabel(state.dataMode);
  }
  if (!state.loadError && els.environmentLabel) {
    els.environmentLabel.textContent = `${t(state.lang, "home.statusEnvironment")} ${renderEnvironmentLabel()}`;
  }
  if (state.loadError) {
    showPageAlert();
    syncReleaseNotes(null, null, null);
  } else {
    syncReleaseNotes(state.dataMode, state.summary?.updatedAt, state.dataSource);
  }
  if (state.hoverQuadrant && els.occupationUniverse) {
    const rect = els.occupationUniverse.getBoundingClientRect();
    renderQuadrantTooltip(
      state.hoverQuadrant,
      rect.left + (rect.width * state.hoverPointerX / 100),
      rect.top + (rect.height * state.hoverPointerY / 100)
    );
  }
  if (state.meta) renderSelectOptions();
}

function renderSelectOptions() {
  if (!state.meta) return;
  els.dateSelect.innerHTML = state.meta.dates.map((date) => `<option value="${date}">${date}</option>`).join("");
  els.regionSelect.innerHTML = state.meta.regions.map((region) => `<option value="${region}">${region}</option>`).join("");
  setOptions(els.majorGroupSelect, state.meta.groups, t(state.lang, "home.allGroups"), (value) => groupText(state.lang, value));
  setOptions(els.labelSelect, state.meta.labels, t(state.lang, "home.allLabels"), (value) => labelText(state.lang, value));
  els.dateSelect.value = state.date;
  els.regionSelect.value = state.region;
  els.majorGroupSelect.value = state.majorGroup;
  els.labelSelect.value = state.label;
  els.searchInput.value = state.q;
}

function hashValue(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 1000003;
  return hash;
}

function normalize(value, min, max) {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function nodePalette(score) {
  const displaced = 1 - score / 100;
  const hue = 214 - displaced * 170;
  return {
    fill: `hsla(${hue}, 92%, ${66 - displaced * 12}%, 0.95)`,
    edge: `hsla(${hue}, 88%, ${46 - displaced * 10}%, 1)`,
    glow: `hsla(${hue}, 96%, 64%, ${0.24 + displaced * 0.18})`
  };
}

function computeMarketLayout(rows) {
  const postings = rows.map((row) => Number(row.postings || 0));
  const deltas = rows.map((row) => (row.monthlyAirs?.length ? row.monthlyAirs[row.monthlyAirs.length - 1] - row.monthlyAirs[0] : 0));
  const minPostings = Math.min(...postings, 0);
  const maxPostings = Math.max(...postings, 1);
  const minDelta = Math.min(...deltas, -1);
  const maxDelta = Math.max(...deltas, 1);

  return rows.map((row, index) => {
    const postingNorm = normalize(Number(row.postings || 0), minPostings, maxPostings);
    const delta = row.monthlyAirs?.length ? row.monthlyAirs[row.monthlyAirs.length - 1] - row.monthlyAirs[0] : 0;
    const deltaNorm = normalize(delta, minDelta, maxDelta);
    const spreadX = ((row.airs / 100) - 0.5) * 1500;
    const demandLane = ((postingNorm * 0.72 + deltaNorm * 0.28) - 0.5) * 880;
    const wobble = (hashValue(`${row.socCode}:market`) % 200) - 100;
    const pressure = 1 - row.airs / 100;
    return {
      ...row,
      x: spreadX + wobble * 0.34,
      y: demandLane + (((hashValue(row.title) % 160) - 80) * 0.56),
      size: 14 + pressure * 30 + postingNorm * 6,
      zIndex: 1200 - index
    };
  });
}

function computeGroupLayout(rows) {
  const groups = [...new Set(rows.map((row) => row.majorGroup))];
  const grouped = new Map(groups.map((group) => [group, []]));
  rows.forEach((row) => grouped.get(row.majorGroup).push(row));
  groups.forEach((group) => grouped.get(group).sort((a, b) => a.airs - b.airs || a.title.localeCompare(b.title)));

  return rows.map((row, index) => {
    const groupRows = grouped.get(row.majorGroup);
    const groupIndex = groups.indexOf(row.majorGroup);
    const withinGroup = groupRows.findIndex((entry) => entry.socCode === row.socCode);
    const spreadX = ((row.airs / 100) - 0.5) * 1380;
    const groupBase = groups.length === 1 ? 0 : ((groupIndex / (groups.length - 1)) - 0.5) * 860;
    const rowOffset = groupRows.length === 1 ? 0 : ((withinGroup / (groupRows.length - 1)) - 0.5) * 220;
    const wobble = (hashValue(row.socCode) % 220) - 110;
    return {
      ...row,
      x: spreadX + wobble * 0.46,
      y: groupBase + rowOffset + (((hashValue(row.title) % 180) - 90) * 0.66),
      size: 12 + (1 - row.airs / 100) * 30,
      zIndex: 1000 - index
    };
  });
}

function computeRiskLayout(rows) {
  const labelRank = { high_risk: 0, restructuring: 1, augmenting: 2, monitor: 3, stable: 4, insulated: 5 };
  const labels = [...new Set(rows.map((row) => row.label))].sort((a, b) => (labelRank[a] ?? 99) - (labelRank[b] ?? 99) || a.localeCompare(b));
  const grouped = new Map(labels.map((label) => [label, []]));
  rows.forEach((row) => grouped.get(row.label).push(row));
  labels.forEach((label) => grouped.get(label).sort((a, b) => a.airs - b.airs || a.title.localeCompare(b.title)));

  const columns = Math.min(3, Math.max(1, labels.length));
  const rowCount = Math.max(1, Math.ceil(labels.length / columns));

  return rows.map((row, index) => {
    const cluster = grouped.get(row.label);
    const labelIndex = labels.indexOf(row.label);
    const clusterIndex = cluster.findIndex((entry) => entry.socCode === row.socCode);
    const column = labelIndex % columns;
    const clusterRow = Math.floor(labelIndex / columns);
    const clusterX = (column - (columns - 1) / 2) * 540;
    const clusterY = (clusterRow - (rowCount - 1) / 2) * 460;
    const orbitColumn = clusterIndex % 6;
    const orbitRow = Math.floor(clusterIndex / 6);
    const orbitX = (orbitColumn - 2.5) * 76;
    const orbitY = (orbitRow - Math.max(0, Math.ceil(cluster.length / 6) - 1) / 2) * 78;
    const driftX = ((row.airs / 100) - 0.5) * 220;
    const driftY = ((hashValue(`${row.majorGroup}:${row.socCode}`) % 160) - 80) * 0.3;
    return {
      ...row,
      x: clusterX + orbitX + driftX,
      y: clusterY + orbitY + driftY,
      size: 13 + (1 - row.airs / 100) * 30,
      zIndex: 1000 - index
    };
  });
}

function computeLayout(rows) {
  if (state.viewMode === "risk") return computeRiskLayout(rows);
  if (state.viewMode === "group") return computeGroupLayout(rows);
  return computeMarketLayout(rows);
}

function currentSelection() {
  return state.rows.find((row) => row.socCode === state.selectedSocCode) || state.rows[0] || null;
}

function setMeter(bar, label, value) {
  bar.style.width = `${Math.round((value || 0) * 100)}%`;
  label.textContent = Number(value || 0).toFixed(2);
}

function updateMeters(row) {
  setMeter(els.replacementBar, els.replacementValue, row.replacement);
  setMeter(els.augmentationBar, els.augmentationValue, row.augmentation);
  setMeter(els.hiringBar, els.hiringValue, row.hiring);
  setMeter(els.historicalBar, els.historicalValue, row.historical);
}

function updateSelectedPanel() {
  const row = currentSelection();
  const emptyHref = `occupation-view.html?lang=${encodeURIComponent(state.lang)}`;
  if (!row) {
    const emptyTitle = state.loadError ? t(state.lang, "home.dataUnavailableTitle") : t(state.lang, "home.noOccupations");
    const emptySummary = state.loadError
      ? `${t(state.lang, "home.dataUnavailableSummary")} ${t(state.lang, "home.dataUnavailableHint")}`
      : t(state.lang, "home.noOccupationsSummary");
    document.documentElement.style.setProperty("--selection-hue", "214");
    els.detailTitle.textContent = emptyTitle;
    els.detailScore.textContent = "--";
    els.detailLabel.textContent = "--";
    els.detailSummary.textContent = emptySummary;
    els.detailSoc.textContent = t(state.lang, "home.socPlaceholder");
    els.heroFocusTitle.textContent = "--";
    els.heroFocusScore.textContent = "--";
    els.heroFocusLabel.textContent = "--";
    els.focusGroup.textContent = "--";
    els.focusPostings.textContent = "--";
    els.focusDelta.textContent = "--";
    els.signalSelectionTitle.textContent = emptyTitle;
    els.signalSelectionSummary.textContent = emptySummary;
    updateMeters({ replacement: 0, augmentation: 0, hiring: 0, historical: 0 });
    els.detailLink.href = emptyHref;
    els.portalButton.dataset.href = emptyHref;
    els.downButton.dataset.href = emptyHref;
    return;
  }

  const delta = row.monthlyAirs[row.monthlyAirs.length - 1] - row.monthlyAirs[0];
  const deltaText = `${t(state.lang, "home.twelveMonthShort")} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  const href = `occupation-view.html?soc=${encodeURIComponent(row.socCode)}&region=${encodeURIComponent(state.region)}&date=${encodeURIComponent(state.date)}&lang=${encodeURIComponent(state.lang)}`;
  document.documentElement.style.setProperty("--selection-hue", `${toneFromAirs(row.airs).toFixed(1)}`);

  els.heroFocusTitle.textContent = displayTitle(row);
  animateNumber(els.heroFocusScore, row.airs, { formatter: (next) => `${Math.round(next)}` });
  els.heroFocusLabel.textContent = labelText(state.lang, row.label);
  els.detailTitle.textContent = displayTitle(row);
  animateNumber(els.detailScore, row.airs, { formatter: (next) => `${Math.round(next)}` });
  els.detailLabel.textContent = labelText(state.lang, row.label);
  els.detailSummary.textContent = displaySummary(row);
  els.detailSoc.textContent = `${row.socCode} / ${groupText(state.lang, row.majorGroup)}`;
  els.focusGroup.textContent = groupText(state.lang, row.majorGroup);
  animateNumber(els.focusPostings, row.postings, { formatter: (next) => formatCompact(next) });
  els.focusDelta.textContent = deltaText;
  els.signalSelectionTitle.textContent = displayTitle(row);
  els.signalSelectionSummary.textContent = displaySummary(row);
  updateMeters(row);
  els.detailLink.href = href;
  els.portalButton.dataset.href = href;
  els.downButton.dataset.href = href;
}

function updateCanvasTransform() {
  const row = currentSelection();
  const focusStrength = state.viewMode === "market" ? 0.48 : state.viewMode === "group" ? 0.62 : 0.72;
  camera.targetZoom = state.zoom;
  camera.targetOffsetX = (row ? -row.x * state.zoom * focusStrength : 0) + state.panX;
  camera.targetOffsetY = (row ? -row.y * state.zoom * focusStrength : 0) + state.panY;

  if (!camera.initialized) {
    camera.zoom = camera.targetZoom;
    camera.offsetX = camera.targetOffsetX;
    camera.offsetY = camera.targetOffsetY;
    camera.initialized = true;
    els.occupationCanvas.style.transform = `translate(-50%, -50%) translate(${camera.offsetX}px, ${camera.offsetY}px) scale(${camera.zoom})`;
    els.occupationCanvas.style.setProperty("--node-scale", `${(1 / Math.max(camera.zoom, 0.0001)).toFixed(5)}`);
    els.occupationCanvas.dataset.zoomState = camera.zoom > 1.45 ? "close" : "far";
    els.zoomIndicator.textContent = `${Math.round(camera.zoom * 100)}%`;
    queueQuadrantTooltipOverlapSync();
    return;
  }

  if (!cameraFrame) cameraFrame = requestAnimationFrame(stepCamera);
}

function stepCamera() {
  const lerp = 0.16;
  camera.zoom += (camera.targetZoom - camera.zoom) * lerp;
  camera.offsetX += (camera.targetOffsetX - camera.offsetX) * lerp;
  camera.offsetY += (camera.targetOffsetY - camera.offsetY) * lerp;

  els.occupationCanvas.style.transform = `translate(-50%, -50%) translate(${camera.offsetX}px, ${camera.offsetY}px) scale(${camera.zoom})`;
  els.occupationCanvas.style.setProperty("--node-scale", `${(1 / Math.max(camera.zoom, 0.0001)).toFixed(5)}`);
  els.occupationCanvas.dataset.zoomState = camera.zoom > 1.45 ? "close" : "far";
  els.zoomIndicator.textContent = `${Math.round(camera.zoom * 100)}%`;
  queueQuadrantTooltipOverlapSync();

  const settled =
    Math.abs(camera.targetZoom - camera.zoom) < 0.01 &&
    Math.abs(camera.targetOffsetX - camera.offsetX) < 0.8 &&
    Math.abs(camera.targetOffsetY - camera.offsetY) < 0.8;

  if (settled) {
    camera.zoom = camera.targetZoom;
    camera.offsetX = camera.targetOffsetX;
    camera.offsetY = camera.targetOffsetY;
    els.occupationCanvas.style.transform = `translate(-50%, -50%) translate(${camera.offsetX}px, ${camera.offsetY}px) scale(${camera.zoom})`;
    els.occupationCanvas.style.setProperty("--node-scale", `${(1 / Math.max(camera.zoom, 0.0001)).toFixed(5)}`);
    els.zoomIndicator.textContent = `${Math.round(camera.zoom * 100)}%`;
    queueQuadrantTooltipOverlapSync();
    cameraFrame = 0;
    return;
  }

  cameraFrame = requestAnimationFrame(stepCamera);
}

function updateNodeElement(node, row) {
  const palette = nodePalette(row.airs);
  node.classList.toggle("is-selected", row.socCode === state.selectedSocCode);
  node.dataset.soc = row.socCode;
  node.style.width = `${row.size}px`;
  node.style.height = `${row.size}px`;
  node.style.setProperty("--node-x", `${row.x - row.size / 2}px`);
  node.style.setProperty("--node-y", `${row.y - row.size / 2}px`);
  node.style.zIndex = `${row.zIndex}`;
  node.style.setProperty("--node-fill", palette.fill);
  node.style.setProperty("--node-edge", palette.edge);
  node.style.setProperty("--node-glow", palette.glow);
  node.setAttribute("aria-label", `${displayTitle(row)} AIRS ${row.airs.toFixed(0)}`);
  updateFloatingLabel(node, row);
  queueQuadrantTooltipOverlapSync();
}

function createNodeElement(row) {
  const node = document.createElement("button");
  node.className = "occupation-node";
  node.type = "button";
  node.innerHTML = `
    <span class="occupation-node__halo"></span>
    <span class="occupation-node__core"></span>`;
  node.addEventListener("click", () => {
    if (dragState.moved) return;
    state.selectedSocCode = node.dataset.soc;
    state.zoom = Math.max(state.zoom, 1.45);
    state.panX = 0;
    state.panY = 0;
    state.storyStep = "focus";
    updateStoryStagePanel();
    renderUniverse();
    updateSelectedPanel();
  });
  node.addEventListener("pointerenter", queueQuadrantTooltipOverlapSync);
  node.addEventListener("pointerleave", queueQuadrantTooltipOverlapSync);
  node.addEventListener("focus", queueQuadrantTooltipOverlapSync);
  node.addEventListener("blur", queueQuadrantTooltipOverlapSync);
  updateNodeElement(node, row);
  return node;
}

function renderUniverse() {
  const layout = computeLayout(state.rows);
  state.rows = layout.sort((a, b) => a.airs - b.airs);
  if (!state.rows.length) {
    state.selectedSocCode = null;
    nodeElements.clear();
    labelElements.clear();
    if (els.occupationLabelLayer) {
      els.occupationLabelLayer.replaceChildren();
    }
    els.occupationCanvas.replaceChildren();
    updateCanvasTransform();
    return;
  }
  if (!state.selectedSocCode || !state.rows.some((row) => row.socCode === state.selectedSocCode)) {
    state.selectedSocCode = state.rows[0].socCode;
  }

  const fragment = document.createDocumentFragment();
  const seen = new Set();

  state.rows.forEach((row) => {
    let node = nodeElements.get(row.socCode);
    if (!node) {
      node = createNodeElement(row);
      nodeElements.set(row.socCode, node);
    } else {
      updateNodeElement(node, row);
    }
    seen.add(row.socCode);
    fragment.appendChild(node);
  });

  nodeElements.forEach((node, socCode) => {
    if (!seen.has(socCode)) {
      node.remove();
      nodeElements.delete(socCode);
      const label = labelElements.get(socCode);
      if (label) {
        label.remove();
        labelElements.delete(socCode);
      }
    }
  });

  els.occupationCanvas.replaceChildren(fragment);

  updateCanvasTransform();
}

function renderSummary(summary) {
  animateNumber(els.avgAirs, summary.avgAirs, { decimals: 1 });
  animateNumber(els.highRiskCount, summary.highRiskCount, { formatter: (next) => `${Math.round(next)}` });
  animateNumber(els.occupationCount, summary.occupationCount, { formatter: (next) => `${Math.round(next)}` });
  if (!state.rows.length) {
    els.restructuringRate.textContent = "--";
    els.augmentingRate.textContent = "--";
    els.mostChangedOccupation.textContent = "--";
    els.mostChangedDelta.textContent = "--";
    return;
  }
  const restructuringCount = state.rows.filter((row) => row.label === "restructuring" || row.label === "high_risk").length;
  const augmentingCount = state.rows.filter((row) => row.label === "augmenting").length;
  const biggestMove = [...state.rows]
    .map((row) => ({ ...row, delta: row.monthlyAirs[row.monthlyAirs.length - 1] - row.monthlyAirs[0] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  animateNumber(els.restructuringRate, (restructuringCount / state.rows.length) * 100, { formatter: (next) => `${Math.round(next)}%` });
  animateNumber(els.augmentingRate, (augmentingCount / state.rows.length) * 100, { formatter: (next) => `${Math.round(next)}%` });
  els.mostChangedOccupation.textContent = biggestMove ? displayTitle(biggestMove) : "--";
  els.mostChangedDelta.textContent = biggestMove ? `${t(state.lang, "home.twelveMonthShort")} ${biggestMove.delta > 0 ? "+" : ""}${biggestMove.delta.toFixed(1)}` : "--";
}

function renderTicker() {
  if (!els.riskTickerTrack) return;
  const items = state.rows.length
    ? [...state.rows].sort((a, b) => a.airs - b.airs).slice(0, 6)
    : [];
  const feed = items.length ? [...items, ...items] : [];
  els.riskTickerTrack.innerHTML = feed.map((row) => `
    <span class="risk-ribbon__item">
      <strong>${row.socCode}</strong>
      <span>${displayTitle(row)}</span>
      <em>${labelText(state.lang, row.label)} / AIRS ${row.airs.toFixed(0)}</em>
    </span>
  `).join("");
}

async function resolveVisitorTime() {
  const fallbackTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const fallback = { timezone: fallbackTimezone, city: "", cityKey: "home.browserLocale", region: "" };
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3200);
    const response = await fetch("https://ipwho.is/", { signal: controller.signal });
    window.clearTimeout(timeout);
    if (!response.ok) throw new Error("ip lookup failed");
    const payload = await response.json();
    if (payload && payload.success !== false && payload.timezone?.id) {
      return { timezone: payload.timezone.id, city: payload.city || payload.region || "", cityKey: payload.city || payload.region ? null : "home.visitorLocale", region: payload.country_code || payload.country || "" };
    }
  } catch { return fallback; }
  return fallback;
}

function startClock(timeContext) {
  if (clockTimer) window.clearInterval(clockTimer);
  const formatter = new Intl.DateTimeFormat(locale(), {
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", month: "short", day: "numeric", timeZone: timeContext.timezone
  });
  const update = () => {
    els.visitorTime.textContent = formatter.format(new Date());
    const cityText = timeContext.city || (timeContext.cityKey ? t(state.lang, timeContext.cityKey) : "");
    const regionText = timeContext.region ? `, ${timeContext.region}` : "";
    els.visitorPlace.textContent = `${cityText}${regionText} - ${timeContext.timezone}`;
  };
  update();
  clockTimer = window.setInterval(update, 1000);
}

function navigateToDetail(url) {
  document.body.classList.add("page-leaving");
  window.setTimeout(() => { window.location.href = url; }, 360);
}

function syncScrollProgress() {
  const progress = clamp(window.scrollY / Math.max(window.innerHeight * 0.9, 1), 0, 1);
  const introProgress = clamp(window.scrollY / Math.max(window.innerHeight * 0.42, 1), 0, 1);
  document.documentElement.style.setProperty("--home-progress", progress.toFixed(3));
  document.documentElement.style.setProperty("--intro-progress", introProgress.toFixed(3));
  els.downButton.classList.toggle("is-hidden", window.scrollY > window.innerHeight * 0.82);
}

function setViewMode(mode, options = {}) {
  if (!mode) return;
  const {
    zoom = VIEW_PRESETS[mode] ?? state.zoom,
    resetPan = true,
    preserveStory = false
  } = options;
  state.viewMode = mode;
  state.zoom = zoom;
  if (resetPan) {
    state.panX = 0;
    state.panY = 0;
  }
  if (!preserveStory) {
    const linkedScene = STORY_SCENES.find((scene) => scene.viewMode === mode && scene.id !== "focus") || STORY_SCENES[0];
    state.storyStep = linkedScene.id;
  }
  updateViewButtons();
  updateStoryStagePanel();
  renderUniverse();
  updateSelectedPanel();
}

function activateStoryStep(stepId) {
  const scene = STORY_SCENE_MAP.get(stepId);
  if (!scene) return;
  state.storyStep = scene.id;
  setViewMode(scene.viewMode, { zoom: scene.zoom, preserveStory: true, resetPan: true });
}

function bindUniverseInteractions() {
  const updatePointer = (event) => {
    const rect = els.occupationUniverse.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const normalizedX = clamp(x, 0, 100);
    const normalizedY = clamp(y, 0, 100);
    state.hoverPointerX = normalizedX;
    state.hoverPointerY = normalizedY;
    els.occupationUniverse.style.setProperty("--pointer-x", `${normalizedX.toFixed(2)}%`);
    els.occupationUniverse.style.setProperty("--pointer-y", `${normalizedY.toFixed(2)}%`);
    renderQuadrantTooltip(quadrantFromPointer(normalizedX, normalizedY), event.clientX, event.clientY);
  };

  const endDrag = (event) => {
    if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
    dragState.active = false;
    dragState.pointerId = null;
    els.occupationUniverse.classList.remove("is-dragging");
    window.setTimeout(() => { dragState.moved = false; }, 0);
  };

  els.occupationUniverse.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragState.active = true;
    dragState.moved = false;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.originPanX = state.panX;
    dragState.originPanY = state.panY;
    els.occupationUniverse.setPointerCapture(event.pointerId);
  });
  els.occupationUniverse.addEventListener("pointermove", (event) => {
    updatePointer(event);
    if (!dragState.active || event.pointerId !== dragState.pointerId) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) > 6) {
      dragState.moved = true;
      els.occupationUniverse.classList.add("is-dragging");
      hideQuadrantTooltip();
    }
    if (!dragState.moved) return;
    state.panX = dragState.originPanX + dx;
    state.panY = dragState.originPanY + dy;
    updateCanvasTransform();
  });
  els.occupationUniverse.addEventListener("pointerup", endDrag);
  els.occupationUniverse.addEventListener("pointercancel", endDrag);
  els.occupationUniverse.addEventListener("lostpointercapture", () => {
    dragState.active = false;
    dragState.pointerId = null;
    els.occupationUniverse.classList.remove("is-dragging");
  });
  els.occupationUniverse.addEventListener("pointerleave", () => {
    els.occupationUniverse.style.setProperty("--pointer-x", "50%");
    els.occupationUniverse.style.setProperty("--pointer-y", "42%");
    hideQuadrantTooltip();
  });
}

function setupReveals() {
  const nodes = document.querySelectorAll(".pressure-card, .method-step, .signal-panel, .focus-card, .hero-stat, .story-lead, .story-step-card, .release-card");
  nodes.forEach((node, index) => {
    node.classList.add("reveal-on-scroll");
    node.style.setProperty("--reveal-delay", `${Math.min(index * 50, 220)}ms`);
  });

  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -10% 0px" });

  nodes.forEach((node) => revealObserver.observe(node));
}

function setupStoryObserver() {
  if (!els.storyCards.length) return;
  storyObserver?.disconnect();
  storyObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const stepId = visible.target.dataset.storyStep;
    if (stepId && stepId !== state.storyStep) activateStoryStep(stepId);
  }, { threshold: [0.35, 0.55, 0.75], rootMargin: "-12% 0px -28% 0px" });

  els.storyCards.forEach((card) => {
    card.tabIndex = 0;
    card.addEventListener("click", () => activateStoryStep(card.dataset.storyStep));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateStoryStep(card.dataset.storyStep);
      }
    });
    storyObserver.observe(card);
  });
}

function bindActions() {
  els.dateSelect.addEventListener("change", (event) => { state.date = event.target.value; load(); });
  els.regionSelect.addEventListener("change", (event) => { state.region = event.target.value; load(); });
  els.majorGroupSelect.addEventListener("change", (event) => { state.majorGroup = event.target.value; load(); });
  els.labelSelect.addEventListener("change", (event) => { state.label = event.target.value; load(); });
  els.searchInput.addEventListener("input", (event) => {
    state.q = event.target.value.trim();
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => load(), 160);
  });
  els.languageButtons.forEach((button) => button.addEventListener("click", () => {
    state.lang = button.dataset.langOption;
    refreshStaticLanguage();
    if (state.timeContext) startClock(state.timeContext);
    renderUniverse();
    if (state.loadError) {
      resetSummaryStats();
      showPageAlert();
    } else {
      renderSummary(state.summary || { avgAirs: 0, highRiskCount: 0, occupationCount: 0 });
    }
    updateSelectedPanel();
    renderTicker();
  }));
  els.viewButtons.forEach((button) => button.addEventListener("click", () => {
    setViewMode(button.dataset.viewMode);
  }));
  els.occupationUniverse.addEventListener("wheel", (event) => {
    event.preventDefault();
    state.zoom = clamp(state.zoom * Math.exp(-event.deltaY * 0.0011), 0.78, 4.2);
    updateCanvasTransform();
  }, { passive: false });
  els.occupationUniverse.addEventListener("dblclick", () => {
    state.zoom = VIEW_PRESETS[state.viewMode] ?? 1;
    state.panX = 0;
    state.panY = 0;
    updateCanvasTransform();
  });
  els.portalButton.addEventListener("click", () => navigateToDetail(els.portalButton.dataset.href || els.detailLink.href));
  els.detailLink.addEventListener("click", (event) => { event.preventDefault(); navigateToDetail(els.detailLink.href); });
  els.downButton.addEventListener("click", () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    window.setTimeout(() => navigateToDetail(els.downButton.dataset.href || els.detailLink.href), 420);
  });
  window.addEventListener("scroll", syncScrollProgress, { passive: true });
  window.addEventListener("resize", () => {
    syncScrollProgress();
    updateCanvasTransform();
  });
}

async function load() {
  const token = ++loadToken;
  const requestedDate = state.date;
  const requestedRegion = state.region;
  try {
    const [summary, payload] = await Promise.all([getSummary(state), getOccupations(state)]);
    if (token !== loadToken) return;
    state.loadError = null;
    state.dataMode = summary.mode;
    state.dataSource = summary.source || payload.source || null;
    hidePageAlert();
    state.summary = summary;
    const groups = (payload.groups && payload.groups.length) ? payload.groups : [...new Set(payload.occupations.map((row) => row.majorGroup))].sort();
    state.meta = { dates: payload.dates || [], regions: payload.regions || [], labels: payload.labels || [], groups };
    if ((!state.date || !state.meta.dates.includes(state.date)) && state.meta.dates.length) state.date = state.meta.dates[state.meta.dates.length - 1];
    if ((!state.region || !state.meta.regions.includes(state.region)) && state.meta.regions.length) state.region = state.meta.regions[0];
    if ((state.date !== requestedDate || state.region !== requestedRegion) && (state.date || state.region)) return load();
    renderSelectOptions();
    els.lastUpdatedLabel.textContent = `${t(state.lang, "home.updatedPrefix")} ${new Date(summary.updatedAt).toLocaleString(locale(), { hour12: false })}`;
    els.dataModeLabel.textContent = renderModeLabel(summary.mode);
    syncReleaseNotes(summary.mode, summary.updatedAt, state.dataSource);
    state.rows = payload.occupations.slice();
    renderUniverse();
    renderSummary(summary);
    updateSelectedPanel();
    renderTicker();
  } catch (error) {
    if (token !== loadToken) return;
    state.loadError = error;
    state.summary = null;
    state.dataMode = null;
    state.dataSource = null;
    state.rows = [];
    els.lastUpdatedLabel.textContent = `${t(state.lang, "home.updatedPrefix")} --`;
    els.dataModeLabel.textContent = renderModeLabel(null);
    syncReleaseNotes(null, null, null);
    resetSummaryStats();
    renderUniverse();
    updateSelectedPanel();
    renderTicker();
    showPageAlert();
  }
}

async function init() {
  refreshStaticLanguage();
  document.body.classList.add("page-ready");
  bindActions();
  bindUniverseInteractions();
  setupReveals();
  setupStoryObserver();
  syncScrollProgress();
  await load();
  state.timeContext = await resolveVisitorTime();
  startClock(state.timeContext);
}

init();
