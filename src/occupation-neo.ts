import { getOccupationDetail } from "./api-client.js";
import { applyTranslations, getInitialLanguage, labelText, persistLanguage, t } from "./i18n-neo.js";
import { getRuntimeEnvironment, isStrictDataMode } from "./runtime-config.js";
import type { Language, OccupationDetailPayload, OccupationRow, OccupationTask } from "./types/airs.js";

const byId = <T extends Element>(id: string) => document.getElementById(id) as unknown as T;
const query = <T extends Element>(selector: string) => document.querySelector(selector) as T;
const queryAll = <T extends Element>(selector: string) => Array.from(document.querySelectorAll(selector)) as T[];

interface DetailState {
  soc: string;
  region: string;
  date: string;
  lang: Language;
  loadError: Error | null;
  dataMode: string | null;
  dataSource: string | null;
  updatedAt: string | null;
}

interface DetailNumberAnimationOptions {
  formatter?: (value: number) => string;
}

const params = new URLSearchParams(window.location.search);
const state: DetailState = {
  soc: params.get("soc") || "15-1252",
  region: params.get("region") || "National",
  date: params.get("date") || "",
  lang: getInitialLanguage() as Language,
  loadError: null,
  dataMode: null,
  dataSource: null,
  updatedAt: null
};
let renderToken = 0;
let revealObserver: IntersectionObserver | null = null;
const numberFrames = new WeakMap<HTMLElement, number>();

const DETAIL_COPY = {
  en: {
    detail_nav_cta: "Open breakdown"
  },
  zh: {
    detail_nav_cta: "\u67e5\u770b\u5206\u9879\u89e3\u8bfb"
  }
};

const els = {
  occupationTitle: byId<HTMLElement>("occupationTitle"),
  occupationSummary: byId<HTMLElement>("occupationSummary"),
  occupationSoc: byId<HTMLElement>("occupationSoc"),
  occupationRegion: byId<HTMLElement>("occupationRegion"),
  occupationDate: byId<HTMLElement>("occupationDate"),
  occupationAirs: byId<HTMLElement>("occupationAirs"),
  occupationAirsMirror: byId<HTMLElement>("occupationAirsMirror"),
  occupationLabel: byId<HTMLElement>("occupationLabel"),
  occupationPostings: byId<HTMLElement>("occupationPostings"),
  occupationPostingsMirror: byId<HTMLElement>("occupationPostingsMirror"),
  detailHeroDelta: byId<HTMLElement>("detailHeroDelta"),
  replacementBar: byId<HTMLElement>("replacementBar"),
  augmentationBar: byId<HTMLElement>("augmentationBar"),
  hiringBar: byId<HTMLElement>("hiringBar"),
  historicalBar: byId<HTMLElement>("historicalBar"),
  replacementValue: byId<HTMLElement>("replacementValue"),
  augmentationValue: byId<HTMLElement>("augmentationValue"),
  hiringValue: byId<HTMLElement>("hiringValue"),
  historicalValue: byId<HTMLElement>("historicalValue"),
  timelineChart: byId<SVGElement>("timelineChart"),
  timelineDelta: byId<HTMLElement>("timelineDelta"),
  evidenceList: byId<HTMLElement>("evidenceList"),
  taskCloud: byId<HTMLElement>("taskCloud"),
  pageAlert: byId<HTMLElement>("pageAlert"),
  pageAlertTitle: byId<HTMLElement>("pageAlertTitle"),
  pageAlertText: byId<HTMLElement>("pageAlertText"),
  detailReleaseEnvironment: byId<HTMLElement>("detailReleaseEnvironment"),
  detailReleaseDataMode: byId<HTMLElement>("detailReleaseDataMode"),
  detailReleaseUpdatedAt: byId<HTMLElement>("detailReleaseUpdatedAt"),
  detailReleaseCoverage: byId<HTMLElement>("detailReleaseCoverage"),
  detailReleaseSource: byId<HTMLElement>("detailReleaseSource"),
  backLink: query<HTMLAnchorElement>(".detail-back"),
  languageButtons: queryAll<HTMLButtonElement>("[data-lang-option]")
};

const MONTH_LABELS = {
  en: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
  zh: ["4\u6708", "5\u6708", "6\u6708", "7\u6708", "8\u6708", "9\u6708", "10\u6708", "11\u6708", "12\u6708", "1\u6708", "2\u6708", "3\u6708"]
};

function locale() { return state.lang === "zh" ? "zh-CN" : "en-US"; }
function displayTitle(row: OccupationRow) { return state.lang === "zh" ? (row.titleZh || row.title) : row.title; }
function displaySummary(row: OccupationRow) { return state.lang === "zh" ? (row.summaryZh || row.summary) : row.summary; }
function displayEvidence(row: OccupationRow) { return state.lang === "zh" ? (row.evidenceZh || row.evidence) : row.evidence; }
function displayTaskName(task: OccupationTask) { return state.lang === "zh" ? (task.nameZh || task.name) : task.name; }
function toneFromAirs(airs: number) { return 214 - (1 - airs / 100) * 170; }
function copy(language: Language, key: string) { return DETAIL_COPY[language]?.[key] || DETAIL_COPY.en[key] || key; }

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

function renderSourceLabel() {
  if (state.dataSource === "json") return t(state.lang, "home.sourceJson");
  if (state.dataSource === "database") return t(state.lang, "home.sourceDatabase");
  if (state.dataSource === "mock") return t(state.lang, "home.sourceMock");
  return t(state.lang, "home.sourceUnavailable");
}

function syncReleaseNotes() {
  if (els.detailReleaseEnvironment) els.detailReleaseEnvironment.textContent = renderEnvironmentLabel();
  if (els.detailReleaseDataMode) els.detailReleaseDataMode.textContent = renderModeLabel(state.dataMode);
  if (els.detailReleaseUpdatedAt) {
    els.detailReleaseUpdatedAt.textContent = state.updatedAt
      ? new Date(state.updatedAt).toLocaleString(locale(), { hour12: false })
      : "--";
  }
  if (els.detailReleaseCoverage) els.detailReleaseCoverage.textContent = state.lang === "zh" ? "美国 / BLS SOC" : "United States / BLS SOC";
  if (els.detailReleaseSource) els.detailReleaseSource.textContent = renderSourceLabel();
}

function showPageAlert() {
  if (!els.pageAlert) return;
  els.pageAlert.hidden = false;
  els.pageAlertTitle.textContent = t(state.lang, "detail.dataUnavailableTitle");
  els.pageAlertText.textContent = `${t(state.lang, "detail.dataUnavailableSummary")} ${t(state.lang, "home.dataUnavailableHint")}`;
}

function hidePageAlert() {
  if (!els.pageAlert) return;
  els.pageAlert.hidden = true;
}

function renderErrorState() {
  state.dataMode = null;
  state.dataSource = null;
  state.updatedAt = null;
  els.occupationTitle.textContent = t(state.lang, "detail.dataUnavailableTitle");
  els.occupationSummary.textContent = `${t(state.lang, "detail.dataUnavailableSummary")} ${t(state.lang, "home.dataUnavailableHint")}`;
  els.occupationSoc.textContent = "SOC --";
  els.occupationRegion.textContent = state.region || "--";
  els.occupationDate.textContent = state.date || "--";
  [els.occupationAirs, els.occupationAirsMirror, els.occupationPostings, els.occupationPostingsMirror].forEach((element) => {
    element.dataset.value = "0";
    element.textContent = "--";
  });
  els.occupationLabel.textContent = "--";
  els.detailHeroDelta.textContent = "--";
  els.timelineDelta.textContent = "--";
  [els.replacementValue, els.augmentationValue, els.hiringValue, els.historicalValue].forEach((element) => { element.textContent = "--"; });
  [els.replacementBar, els.augmentationBar, els.hiringBar, els.historicalBar].forEach((bar) => { bar.style.width = "0%"; });
  els.timelineChart.innerHTML = "";
  els.evidenceList.innerHTML = "";
  els.taskCloud.innerHTML = "";
}

function animateNumber(element: HTMLElement | null, value: number, options: DetailNumberAnimationOptions = {}) {
  if (!element) return;
  const {
    formatter = (next) => `${Math.round(next)}`
  } = options;
  const previousFrame = numberFrames.get(element);
  if (previousFrame) cancelAnimationFrame(previousFrame);
  const from = Number(element.dataset.value || 0);
  const to = Number(value || 0);
  const start = performance.now();

  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / 420);
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

function applyNarrativeCopy() {
  document.querySelectorAll<HTMLElement>("[data-copy]").forEach((element) => {
    element.textContent = copy(state.lang, element.dataset.copy);
  });
}

function setupReveals() {
  const nodes = document.querySelectorAll<HTMLElement>(".detail-highlight, .detail-score-card, .detail-story__lead, .detail-panel");
  nodes.forEach((node, index) => {
    node.classList.add("reveal-on-scroll");
    node.style.setProperty("--reveal-delay", `${Math.min(index * 50, 220)}ms`);
  });

  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) (entry.target as HTMLElement).classList.add("is-visible");
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

  nodes.forEach((node) => revealObserver.observe(node));
}

function refreshStaticLanguage() {
  persistLanguage(state.lang);
  applyTranslations(document, state.lang);
  applyNarrativeCopy();
  document.title = t(state.lang, "detail.pageTitle");
  els.languageButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.langOption === state.lang);
  });
  els.backLink.href = `home.html?lang=${encodeURIComponent(state.lang)}&region=${encodeURIComponent(state.region)}&date=${encodeURIComponent(state.date)}`;
  syncReleaseNotes();
  if (state.loadError) showPageAlert();
}

function setMeter(bar: HTMLElement, label: HTMLElement, value: number) {
  bar.style.width = `${Math.round((value || 0) * 100)}%`;
  label.textContent = Number(value || 0).toFixed(2);
}

function renderTimeline(series) {
  const width = 640;
  const height = 260;
  const padding = 24;
  const min = Math.min(...series) - 4;
  const max = Math.max(...series) + 4;
  const stepX = (width - padding * 2) / (series.length - 1);
  const points = series.map((value, index) => ({
    x: padding + stepX * index,
    y: height - padding - ((value - min) / (max - min)) * (height - padding * 2)
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  const labels = MONTH_LABELS[state.lang] || MONTH_LABELS.en;

  els.timelineChart.innerHTML = `
    <defs>
      <linearGradient id="detailFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,113,227,0.34)"></stop>
        <stop offset="100%" stop-color="rgba(0,113,227,0.03)"></stop>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#detailFill)"></path>
    <path d="${linePath}" fill="none" stroke="#0071e3" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"></path>
    ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#0071e3"></circle>`).join("")}
    ${points.map((point, index) => `<text x="${point.x}" y="${height - 6}" text-anchor="middle" font-size="11" fill="#6e6e73">${labels[index]}</text>`).join("")}
  `;

  const delta = series[series.length - 1] - series[0];
  const deltaText = `${t(state.lang, "home.twelveMonthShort")} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  els.timelineDelta.textContent = deltaText;
  els.detailHeroDelta.textContent = deltaText;
}

async function renderPage() {
  const token = ++renderToken;
  try {
    const payload: OccupationDetailPayload = await getOccupationDetail(state.soc, state);
    if (token !== renderToken) return;
    state.loadError = null;
    state.dataMode = payload.mode;
    state.dataSource = payload.source || null;
    state.updatedAt = payload.updatedAt || null;
    hidePageAlert();
    const row = payload.occupation;
    if (!state.date && payload.dates?.length) state.date = payload.dates[payload.dates.length - 1];
    document.documentElement.style.setProperty("--selection-hue", `${toneFromAirs(row.airs).toFixed(1)}`);

    els.occupationTitle.textContent = displayTitle(row);
    els.occupationSummary.textContent = displaySummary(row);
    els.occupationSoc.textContent = row.socCode;
    els.occupationRegion.textContent = state.region;
    els.occupationDate.textContent = state.date || "--";
    animateNumber(els.occupationAirs, row.airs);
    animateNumber(els.occupationAirsMirror, row.airs);
    els.occupationLabel.textContent = labelText(state.lang, row.label);
    animateNumber(els.occupationPostings, row.postings, { formatter: (next) => Math.round(next).toLocaleString(locale()) });
    animateNumber(els.occupationPostingsMirror, row.postings, { formatter: (next) => Math.round(next).toLocaleString(locale()) });

    setMeter(els.replacementBar, els.replacementValue, row.replacement);
    setMeter(els.augmentationBar, els.augmentationValue, row.augmentation);
    setMeter(els.hiringBar, els.hiringValue, row.hiring);
    setMeter(els.historicalBar, els.historicalValue, row.historical);
    renderTimeline(row.monthlyAirs);

    els.evidenceList.innerHTML = displayEvidence(row).map((item) => `
      <article class="evidence-item">
        <h4>${t(state.lang, "detail.signal")}</h4>
        <p>${item}</p>
      </article>
    `).join("");

    els.taskCloud.innerHTML = row.tasks.map((task) => `
      <article>
        <h4>${displayTaskName(task)}</h4>
        <p>${t(state.lang, "detail.exposure")} ${Number(task.score || 0).toFixed(2)}</p>
      </article>
    `).join("");
  } catch (error) {
    if (token !== renderToken) return;
    state.loadError = error;
    renderErrorState();
    showPageAlert();
  }

  refreshStaticLanguage();
}

function bindLanguage() {
  els.languageButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      state.lang = (button.dataset.langOption || "en") as Language;
      refreshStaticLanguage();
      await renderPage();
    });
  });
}

function syncScrollProgress() {
  const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(window.innerHeight * 0.8, 1)));
  document.documentElement.style.setProperty("--detail-progress", progress.toFixed(3));
}

async function init() {
  refreshStaticLanguage();
  document.body.classList.add("page-ready");
  bindLanguage();
  setupReveals();
  syncScrollProgress();
  window.addEventListener("scroll", syncScrollProgress, { passive: true });
  window.addEventListener("resize", syncScrollProgress);
  await renderPage();
}

init();
