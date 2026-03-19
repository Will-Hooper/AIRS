import { getOccupations, getSummary } from "./api-client.js";
import { LABEL_TEXT } from "./mock-data-v2.js";

const state = {
  date: "2026-03-08",
  region: "National",
  majorGroup: "all",
  label: "all",
  q: "",
  selectedSocCode: null
};

const els = {
  dateSelect: document.getElementById("dateSelect"),
  regionSelect: document.getElementById("regionSelect"),
  majorGroupSelect: document.getElementById("majorGroupSelect"),
  labelSelect: document.getElementById("labelSelect"),
  searchInput: document.getElementById("searchInput"),
  dataModeLabel: document.getElementById("dataModeLabel"),
  lastUpdatedLabel: document.getElementById("lastUpdatedLabel"),
  avgAirs: document.getElementById("avgAirs"),
  highRiskCount: document.getElementById("highRiskCount"),
  occupationCount: document.getElementById("occupationCount"),
  restructuringRate: document.getElementById("restructuringRate"),
  augmentingRate: document.getElementById("augmentingRate"),
  mostChangedOccupation: document.getElementById("mostChangedOccupation"),
  mostChangedDelta: document.getElementById("mostChangedDelta"),
  distributionBands: document.getElementById("distributionBands"),
  regionHeatmap: document.getElementById("regionHeatmap"),
  rankingTable: document.getElementById("rankingTable"),
  detailTitle: document.getElementById("detailTitle"),
  detailLink: document.getElementById("detailLink"),
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
  timelineChart: document.getElementById("timelineChart"),
  timelineDelta: document.getElementById("timelineDelta"),
  scoreRing: document.getElementById("scoreRing")
};

const MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

function labelText(label) {
  return LABEL_TEXT[label] || label;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function deltaText(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function setOptions(select, options, defaultLabel, mapper = (value) => value) {
  select.innerHTML = [`<option value="all">${defaultLabel}</option>`, ...options.map((option) => `<option value="${option}">${mapper(option)}</option>`)].join("");
}

function setMeter(bar, label, value) {
  bar.style.width = `${Math.round(value * 100)}%`;
  label.textContent = value.toFixed(2);
}

function renderTimeline(series) {
  const width = 600;
  const height = 220;
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
  els.timelineChart.innerHTML = `
    <defs>
      <linearGradient id="timelineFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(14,122,120,0.35)"></stop>
        <stop offset="100%" stop-color="rgba(14,122,120,0.02)"></stop>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#timelineFill)"></path>
    <path d="${linePath}" fill="none" stroke="#0e7a78" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"></path>
    ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#0e7a78"></circle>`).join("")}
    ${points.map((point, index) => `<text x="${point.x}" y="${height - 6}" text-anchor="middle" font-size="11" fill="#5f6e76">${MONTH_LABELS[index]}</text>`).join("")}
  `;
}

function renderDistribution(rows) {
  const bands = [
    ["85-100", "Stable", (row) => row.airs >= 85],
    ["70-84", "Light", (row) => row.airs >= 70 && row.airs < 85],
    ["50-69", "Augmenting", (row) => row.airs >= 50 && row.airs < 70],
    ["30-49", "Restructuring", (row) => row.airs >= 30 && row.airs < 50],
    ["0-29", "High Risk", (row) => row.airs < 30]
  ];
  els.distributionBands.innerHTML = bands.map(([range, name, filter]) => {
    const count = rows.filter(filter).length;
    const ratio = count / (rows.length || 1) * 100;
    return `<div class="band"><div class="band__top"><strong>${range}</strong><span>${name} · ${count}</span></div><div class="band__bar"><div style="width:${ratio}%"></div></div></div>`;
  }).join("");
}

function renderRegionHeatmap(rows) {
  if (!rows.length) {
    els.regionHeatmap.innerHTML = "<p>No rows in the current filter.</p>";
    return;
  }
  const regions = Object.keys(rows[0].regionMetrics);
  const averages = regions.map((region) => ({
    region,
    avg: rows.reduce((sum, row) => sum + row.regionMetrics[region].airs, 0) / rows.length
  }));
  els.regionHeatmap.innerHTML = averages.map(({ region, avg }) => `
    <div class="heatmap-row">
      <strong>${region}</strong>
      <div class="heatmap-track"><div class="heatmap-fill" style="width:${avg}%"></div></div>
      <span>${avg.toFixed(0)}</span>
    </div>
  `).join("");
}

function renderRanking(rows) {
  const sorted = [...rows].sort((a, b) => a.airs - b.airs);
  if (!state.selectedSocCode || !sorted.some((row) => row.socCode === state.selectedSocCode)) {
    state.selectedSocCode = sorted[0]?.socCode ?? null;
  }
  els.rankingTable.innerHTML = sorted.map((row, index) => `
    <button class="ranking-row ${row.socCode === state.selectedSocCode ? "is-active" : ""}" data-soc="${row.socCode}">
      <span class="ranking-row__rank">#${index + 1}</span>
      <span class="ranking-row__title"><strong>${row.title}</strong><span>${row.socCode}</span></span>
      <span class="ranking-row__score">${row.airs}</span>
      <span class="pill">${labelText(row.label)}</span>
    </button>
  `).join("");
  els.rankingTable.querySelectorAll(".ranking-row").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSocCode = button.dataset.soc;
      renderSelected(rows);
      renderRanking(rows);
    });
  });
}

function renderSelected(rows) {
  const row = rows.find((item) => item.socCode === state.selectedSocCode) || rows[0];
  if (!row) return;
  els.detailTitle.textContent = row.title;
  els.detailLink.href = `occupation-view.html?soc=${encodeURIComponent(row.socCode)}&region=${encodeURIComponent(state.region)}&date=${encodeURIComponent(state.date)}`;
  els.detailScore.textContent = row.airs.toFixed(0);
  els.detailLabel.textContent = labelText(row.label);
  els.detailSummary.textContent = row.summary;
  els.detailSoc.textContent = `${row.socCode} / ${row.majorGroup}`;
  const circumference = 2 * Math.PI * 48;
  els.scoreRing.style.strokeDasharray = `${circumference}`;
  els.scoreRing.style.strokeDashoffset = `${circumference * (1 - row.airs / 100)}`;
  setMeter(els.replacementBar, els.replacementValue, row.replacement);
  setMeter(els.augmentationBar, els.augmentationValue, row.augmentation);
  setMeter(els.hiringBar, els.hiringValue, row.hiring);
  setMeter(els.historicalBar, els.historicalValue, row.historical);
  renderTimeline(row.monthlyAirs);
  els.timelineDelta.textContent = `12m ${deltaText(row.monthlyAirs[row.monthlyAirs.length - 1] - row.monthlyAirs[0])}`;
}

function renderSummary(rows, summary) {
  const restructuringCount = rows.filter((row) => row.label === "restructuring" || row.label === "high_risk").length;
  const augmentingCount = rows.filter((row) => row.label === "augmenting").length;
  const mostChanged = [...rows]
    .map((row) => ({ ...row, delta: row.monthlyAirs[row.monthlyAirs.length - 1] - row.monthlyAirs[0] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  els.avgAirs.textContent = summary.avgAirs.toFixed(1);
  els.highRiskCount.textContent = `${summary.highRiskCount}`;
  els.occupationCount.textContent = `${summary.occupationCount}`;
  els.restructuringRate.textContent = pct(restructuringCount / (rows.length || 1));
  els.augmentingRate.textContent = pct(augmentingCount / (rows.length || 1));
  els.mostChangedOccupation.textContent = mostChanged?.title || "--";
  els.mostChangedDelta.textContent = mostChanged ? `12m ${deltaText(mostChanged.delta)}` : "--";
}

async function loadAndRender() {
  const [summary, payload] = await Promise.all([getSummary(state), getOccupations(state)]);
  els.dataModeLabel.textContent = summary.mode === "api" ? "live api mode" : "mock data mode";
  els.lastUpdatedLabel.textContent = `updated ${new Date(summary.updatedAt).toLocaleString("zh-CN", { hour12: false })}`;

  if (!els.dateSelect.dataset.ready) {
    els.dateSelect.innerHTML = payload.dates.map((date) => `<option value="${date}">${date}</option>`).join("");
    els.regionSelect.innerHTML = payload.regions.map((region) => `<option value="${region}">${region}</option>`).join("");
    setOptions(els.majorGroupSelect, [...new Set(payload.occupations.map((row) => row.majorGroup))].sort(), "All groups");
    setOptions(els.labelSelect, payload.labels, "All labels", labelText);
    els.dateSelect.value = state.date;
    els.regionSelect.value = state.region;
    els.majorGroupSelect.value = state.majorGroup;
    els.labelSelect.value = state.label;
    els.dateSelect.dataset.ready = "1";
  }

  const rows = payload.occupations;
  renderSummary(rows, summary);
  renderDistribution(rows);
  renderRegionHeatmap(rows);
  renderRanking(rows);
  renderSelected(rows);
}

function bindEvents() {
  els.dateSelect.addEventListener("change", (event) => { state.date = event.target.value; loadAndRender(); });
  els.regionSelect.addEventListener("change", (event) => { state.region = event.target.value; loadAndRender(); });
  els.majorGroupSelect.addEventListener("change", (event) => { state.majorGroup = event.target.value; loadAndRender(); });
  els.labelSelect.addEventListener("change", (event) => { state.label = event.target.value; loadAndRender(); });
  els.searchInput.addEventListener("input", (event) => { state.q = event.target.value.trim(); loadAndRender(); });
}

bindEvents();
loadAndRender();
