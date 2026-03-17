import { getOccupations, getSummary } from "./api-client.js";
import { applyTranslations, getInitialLanguage, groupText, labelText, persistLanguage, t } from "./i18n.js";

const state = {
  date: "2026-03-08",
  region: "National",
  majorGroup: "all",
  label: "all",
  q: "",
  selectedSocCode: null,
  zoom: 1,
  rows: [],
  lang: getInitialLanguage(),
  meta: null,
  summary: null,
  timeContext: null
};

const els = {
  dateSelect: document.getElementById("dateSelect"),
  regionSelect: document.getElementById("regionSelect"),
  majorGroupSelect: document.getElementById("majorGroupSelect"),
  labelSelect: document.getElementById("labelSelect"),
  searchInput: document.getElementById("searchInput"),
  visitorTime: document.getElementById("visitorTime"),
  visitorPlace: document.getElementById("visitorPlace"),
  lastUpdatedLabel: document.getElementById("lastUpdatedLabel"),
  dataModeLabel: document.getElementById("dataModeLabel"),
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
  detailTitle: document.getElementById("detailTitle"),
  detailScore: document.getElementById("detailScore"),
  detailLabel: document.getElementById("detailLabel"),
  detailSummary: document.getElementById("detailSummary"),
  detailSoc: document.getElementById("detailSoc"),
  replacementBar: document.getElementById("replacementBar"),
  augmentationBar: document.getElementById("augmentationBar"),
  hiringBar: document.getElementById("hiringBar"),
  historicalBar: document.getElementById("historicalBar"),
  replacementValue: document.getElementById("replacementValue"),
  augmentationValue: document.getElementById("augmentationValue"),
  hiringValue: document.getElementById("hiringValue"),
  historicalValue: document.getElementById("historicalValue"),
  detailLink: document.getElementById("detailLink"),
  portalButton: document.getElementById("portalButton"),
  downButton: document.getElementById("downButton"),
  languageButtons: document.querySelectorAll("[data-lang-option]")
};

let clockTimer = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setOptions(select, options, defaultLabel, mapper = (value) => value) {
  select.innerHTML = [`<option value="all">${defaultLabel}</option>`, ...options.map((option) => `<option value="${option}">${mapper(option)}</option>`)].join("");
}

function displayTitle(row) {
  return state.lang === "zh" ? (row.titleZh || row.title) : row.title;
}

function displaySummary(row) {
  return state.lang === "zh" ? (row.summaryZh || row.summary) : row.summary;
}

function refreshStaticLanguage() {
  persistLanguage(state.lang);
  applyTranslations(document, state.lang);
  document.title = t(state.lang, "home.pageTitle");
  els.languageButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.langOption === state.lang);
  });
  if (state.meta) {
    renderSelectOptions();
  }
}

function renderSelectOptions() {
  if (!state.meta) return;
  els.dateSelect.innerHTML = state.meta.dates.map((date) => `<option value="${date}">${date}</option>`).join("");
  els.regionSelect.innerHTML = state.meta.regions.map((region) => `<option value="${region}">${region}</option>`).join("");
  setOptions(
    els.majorGroupSelect,
    state.meta.groups,
    t(state.lang, "home.allGroups"),
    (value) => groupText(state.lang, value)
  );
  setOptions(
    els.labelSelect,
    state.meta.labels,
    t(state.lang, "home.allLabels"),
    (value) => labelText(state.lang, value)
  );
  els.dateSelect.value = state.date;
  els.regionSelect.value = state.region;
  els.majorGroupSelect.value = state.majorGroup;
  els.labelSelect.value = state.label;
}

function hashValue(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1000003;
  }
  return hash;
}

function nodePalette(score) {
  const displaced = 1 - score / 100;
  const hue = 220 - displaced * 180;
  const fill = `hsla(${hue}, 92%, ${66 - displaced * 12}%, 0.95)`;
  const edge = `hsla(${hue}, 88%, ${48 - displaced * 10}%, 1)`;
  const glow = `hsla(${hue}, 96%, 64%, ${0.26 + displaced * 0.18})`;
  return { fill, edge, glow };
}

function computeLayout(rows) {
  const groups = [...new Set(rows.map((row) => row.majorGroup))];
  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.majorGroup)) grouped.set(row.majorGroup, []);
    grouped.get(row.majorGroup).push(row);
  });

  groups.forEach((group) => {
    grouped.get(group).sort((a, b) => a.airs - b.airs || a.title.localeCompare(b.title));
  });

  return rows.map((row, index) => {
    const groupRows = grouped.get(row.majorGroup);
    const groupIndex = groups.indexOf(row.majorGroup);
    const withinGroup = groupRows.findIndex((entry) => entry.socCode === row.socCode);
    const spreadX = ((row.airs / 100) - 0.5) * 1380;
    const groupBase = groups.length === 1 ? 0 : ((groupIndex / (groups.length - 1)) - 0.5) * 860;
    const rowOffset = groupRows.length === 1 ? 0 : ((withinGroup / (groupRows.length - 1)) - 0.5) * 220;
    const wobble = ((hashValue(row.socCode) % 200) - 100);
    const x = spreadX + wobble * 0.5;
    const y = groupBase + rowOffset + (((hashValue(row.title) % 160) - 80) * 0.7);
    const size = 12 + (1 - row.airs / 100) * 30;
    return { ...row, x, y, size, zIndex: 1000 - index };
  });
}

function currentSelection() {
  return state.rows.find((row) => row.socCode === state.selectedSocCode) || state.rows[0] || null;
}

function updateMeters(row) {
  const metrics = [
    [els.replacementBar, els.replacementValue, row.replacement],
    [els.augmentationBar, els.augmentationValue, row.augmentation],
    [els.hiringBar, els.hiringValue, row.hiring],
    [els.historicalBar, els.historicalValue, row.historical]
  ];
  metrics.forEach(([bar, label, value]) => {
    bar.style.width = `${Math.round(value * 100)}%`;
    label.textContent = value.toFixed(2);
  });
}

function updateSelectedPanel() {
  const row = currentSelection();
  if (!row) {
    els.detailTitle.textContent = t(state.lang, "home.noOccupations");
    els.detailScore.textContent = "--";
    els.detailLabel.textContent = "--";
    els.detailSummary.textContent = t(state.lang, "home.noOccupationsSummary");
    els.detailSoc.textContent = t(state.lang, "home.socPlaceholder");
    [
      [els.replacementBar, els.replacementValue],
      [els.augmentationBar, els.augmentationValue],
      [els.hiringBar, els.hiringValue],
      [els.historicalBar, els.historicalValue]
    ].forEach(([bar, label]) => {
      bar.style.width = "0%";
      label.textContent = "--";
    });
    const emptyHref = `occupation-view.html?lang=${encodeURIComponent(state.lang)}`;
    els.detailLink.href = emptyHref;
    els.portalButton.dataset.href = emptyHref;
    els.downButton.dataset.href = emptyHref;
    return;
  }
  els.detailTitle.textContent = displayTitle(row);
  els.detailScore.textContent = row.airs.toFixed(0);
  els.detailLabel.textContent = labelText(state.lang, row.label);
  els.detailSummary.textContent = displaySummary(row);
  els.detailSoc.textContent = `${row.socCode} / ${groupText(state.lang, row.majorGroup)}`;
  updateMeters(row);
  const href = `occupation-view.html?soc=${encodeURIComponent(row.socCode)}&region=${encodeURIComponent(state.region)}&date=${encodeURIComponent(state.date)}&lang=${encodeURIComponent(state.lang)}`;
  els.detailLink.href = href;
  els.portalButton.dataset.href = href;
  els.downButton.dataset.href = href;
}

function updateCanvasTransform() {
  const row = currentSelection();
  let offsetX = 0;
  let offsetY = 0;
  if (row) {
    offsetX = -row.x * state.zoom * 0.72;
    offsetY = -row.y * state.zoom * 0.72;
  }
  els.occupationCanvas.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${state.zoom})`;
  els.occupationCanvas.dataset.zoomState = state.zoom > 1.45 ? "close" : "far";
  els.zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
}

function renderUniverse() {
  const layout = computeLayout(state.rows);
  state.rows = layout.sort((a, b) => a.airs - b.airs);
  if (!state.rows.length) {
    state.selectedSocCode = null;
    els.occupationCanvas.innerHTML = "";
    updateCanvasTransform();
    return;
  }
  if (!state.selectedSocCode || !state.rows.some((row) => row.socCode === state.selectedSocCode)) {
    state.selectedSocCode = state.rows[0]?.socCode || null;
  }

  els.occupationCanvas.innerHTML = state.rows.map((row) => {
    const palette = nodePalette(row.airs);
    const selected = row.socCode === state.selectedSocCode ? "is-selected" : "";
    return `
      <button
        class="occupation-node ${selected}"
        data-soc="${row.socCode}"
        style="--x:${row.x}px; --y:${row.y}px; --size:${row.size}px; --node-fill:${palette.fill}; --node-edge:${palette.edge}; --node-glow:${palette.glow}; z-index:${row.zIndex};"
        type="button"
      >
        <span class="occupation-node__halo"></span>
        <span class="occupation-node__core"></span>
        <span class="occupation-node__label">
          <strong>${displayTitle(row)}</strong>
          <span>${row.socCode} - AIRS ${row.airs.toFixed(0)}</span>
        </span>
      </button>
    `;
  }).join("");

  els.occupationCanvas.querySelectorAll(".occupation-node").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedSocCode = node.dataset.soc;
      state.zoom = Math.max(state.zoom, 1.45);
      renderUniverse();
      updateSelectedPanel();
    });
  });

  updateCanvasTransform();
}

function renderSummary(summary) {
  els.avgAirs.textContent = summary.avgAirs.toFixed(1);
  els.highRiskCount.textContent = `${summary.highRiskCount}`;
  els.occupationCount.textContent = `${summary.occupationCount}`;
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

  els.restructuringRate.textContent = `${Math.round((restructuringCount / (state.rows.length || 1)) * 100)}%`;
  els.augmentingRate.textContent = `${Math.round((augmentingCount / (state.rows.length || 1)) * 100)}%`;
  els.mostChangedOccupation.textContent = biggestMove ? displayTitle(biggestMove) : "--";
  els.mostChangedDelta.textContent = biggestMove ? `${t(state.lang, "home.twelveMonthShort")} ${biggestMove.delta > 0 ? "+" : ""}${biggestMove.delta.toFixed(1)}` : "--";
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
    if (payload && payload.success !== false && payload.timezone && payload.timezone.id) {
      return {
        timezone: payload.timezone.id,
        city: payload.city || payload.region || "",
        cityKey: payload.city || payload.region ? null : "home.visitorLocale",
        region: payload.country_code || payload.country || ""
      };
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function startClock(timeContext) {
  if (clockTimer) window.clearInterval(clockTimer);
  const formatter = new Intl.DateTimeFormat(state.lang === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timeContext.timezone
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
  window.setTimeout(() => {
    window.location.href = url;
  }, 360);
}

function bindActions() {
  els.dateSelect.addEventListener("change", (event) => {
    state.date = event.target.value;
    load();
  });
  els.regionSelect.addEventListener("change", (event) => {
    state.region = event.target.value;
    load();
  });
  els.majorGroupSelect.addEventListener("change", (event) => {
    state.majorGroup = event.target.value;
    load();
  });
  els.labelSelect.addEventListener("change", (event) => {
    state.label = event.target.value;
    load();
  });
  els.searchInput.addEventListener("input", (event) => {
    state.q = event.target.value.trim();
    load();
  });
  els.languageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.lang = button.dataset.langOption;
      refreshStaticLanguage();
      if (state.timeContext) {
        startClock(state.timeContext);
      }
      renderUniverse();
      renderSummary(state.summary || { avgAirs: 0, highRiskCount: 0, occupationCount: 0 });
      updateSelectedPanel();
    });
  });

  els.occupationUniverse.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta = -event.deltaY * 0.0015;
    state.zoom = clamp(state.zoom + delta, 0.78, 4.2);
    updateCanvasTransform();
  }, { passive: false });

  els.portalButton.addEventListener("click", () => {
    navigateToDetail(els.portalButton.dataset.href || els.detailLink.href);
  });

  els.downButton.addEventListener("click", () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    window.setTimeout(() => {
      navigateToDetail(els.downButton.dataset.href || els.detailLink.href);
    }, 420);
  });

  els.detailLink.addEventListener("click", (event) => {
    event.preventDefault();
    navigateToDetail(els.detailLink.href);
  });
}

async function load() {
  const [summary, payload] = await Promise.all([getSummary(state), getOccupations(state)]);
  state.summary = summary;

  state.meta = {
    dates: payload.dates,
    regions: payload.regions,
    labels: payload.labels,
    groups: (payload.groups && payload.groups.length)
      ? payload.groups
      : [...new Set(payload.occupations.map((row) => row.majorGroup))].sort()
  };
  renderSelectOptions();

  els.lastUpdatedLabel.textContent = `${t(state.lang, "home.updatedPrefix")} ${new Date(summary.updatedAt).toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US", { hour12: false })}`;
  els.dataModeLabel.textContent = summary.mode === "api" ? t(state.lang, "home.liveApiMode") : t(state.lang, "home.mockMode");

  state.rows = payload.occupations.slice();
  renderUniverse();
  renderSummary(summary);
  updateSelectedPanel();
}

async function init() {
  refreshStaticLanguage();
  document.body.classList.add("page-ready");
  bindActions();
  await load();
  const timeContext = await resolveVisitorTime();
  state.timeContext = timeContext;
  startClock(timeContext);
}

init();
