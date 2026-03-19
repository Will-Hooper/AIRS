import { getOccupations, getSummary } from "./api.js";

const state = { date: "2026-03-08", region: "National", majorGroup: "all", label: "all", q: "", selectedSocCode: null };

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

function fmtPercent(value) { return `${Math.round(value * 100)}%`; }
function fmtDelta(value) { return `${value > 0 ? "+" : ""}${value.toFixed(1)}`; }

function setOptions(select, options, defaultLabel) {
  select.innerHTML = [`<option value="all">${defaultLabel}</option>`, ...options.map((option) => `<option value="${option}">${option}</option>`)].join("");
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
  const months = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];
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
    ${points.map((point, index) => `<text x="${point.x}" y="${height - 6}" text-anchor="middle" font-size="11" fill="#5f6e76">${months[index]}</text>`).join("")}
  `;
}

function renderDistribution(rows) {
  const bands = [
    ["85-100", "基本稳定", (row) => row.airs >= 85],
    ["70-84", "AI轻度渗透", (row) => row.airs >= 70 && row.airs < 85],
    ["50-69", "AI增强中", (row) => row.airs >= 50 && row.airs < 70],
    ["30-49", "AI重构中", (row) => row.airs >= 30 && row.airs < 50],
    ["0-29", "AI高替代风险", (row) => row.airs < 30]
  ];
  els.distributionBands.innerHTML = bands.map(([range, label, filter]) => {
    const count = rows.filter(filter).length;
    const ratio = count / (rows.length || 1) * 100;
    return `<div class="band"><div class="band__top"><strong>${range}</strong><span>${label} · ${count} 个</span></div><div class="band__bar"><div style="width:${ratio}%"></div></div></div>`;
  }).join("");
}

function renderRegionHeatmap(rows) {
  if (!rows.length) {
    els.regionHeatmap.innerHTML = "<p>当前筛选下没有数据。</p>";
    return;
  }
  const first = rows[0];
  const regions = Object.entries(first.regionMetrics).map(([name]) => name);
  const averages = regions.map((region) => {
    const avg = rows.reduce((sum, row) => sum + row.regionMetrics[region].airs, 0) / rows.length;
    return { region, avg };
  });
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
      <span class="pill">${row.label}</span>
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
  els.detailLabel.textContent = row.label;
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
  els.timelineDelta.textContent = `近12个月 ${fmtDelta(row.monthlyAirs[row.monthlyAirs.length - 1] - row.monthlyAirs[0])} 分`;
}

function renderSummary(rows, summary) {
  const restructuringCount = rows.filter((row) => ["AI重构中", "AI高替代风险"].includes(row.label)).length;
  const augmentingCount = rows.filter((row) => row.label === "AI增强中").length;
  const mostChanged = [...rows]
    .map((row) => ({ ...row, delta: row.monthlyAirs[row.monthlyAirs.length - 1] - row.monthlyAirs[0] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  els.avgAirs.textContent = summary.avgAirs.toFixed(1);
  els.highRiskCount.textContent = `${summary.highRiskCount} 个`;
  els.occupationCount.textContent = `${summary.occupationCount} 个`;
  els.restructuringRate.textContent = fmtPercent(restructuringCount / (rows.length || 1));
  els.augmentingRate.textContent = fmtPercent(augmentingCount / (rows.length || 1));
  els.mostChangedOccupation.textContent = mostChanged?.title || "--";
  els.mostChangedDelta.textContent = mostChanged ? `12个月变化 ${fmtDelta(mostChanged.delta)} 分` : "--";
}

async function loadAndRender() {
  const [summary, payload] = await Promise.all([getSummary(state), getOccupations(state)]);
  els.dataModeLabel.textContent = summary.mode === "api" ? "当前使用实时 API 数据" : "当前使用本地 mock 数据";
  els.lastUpdatedLabel.textContent = `最近更新 ${new Date(summary.updatedAt).toLocaleString("zh-CN", { hour12: false })}`;

  if (!els.dateSelect.dataset.ready) {
    els.dateSelect.innerHTML = payload.dates.map((date) => `<option value="${date}">${date}</option>`).join("");
    els.regionSelect.innerHTML = payload.regions.map((region) => `<option value="${region}">${region}</option>`).join("");
    setOptions(els.majorGroupSelect, [...new Set(payload.occupations.map((row) => row.majorGroup))].sort(), "全部大类");
    setOptions(els.labelSelect, payload.labels, "全部标签");
    els.dateSelect.value = state.date;
    els.regionSelect.value = state.region;
    els.labelSelect.value = state.label;
    els.majorGroupSelect.value = state.majorGroup;
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
