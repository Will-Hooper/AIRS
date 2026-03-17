import { getOccupationDetail } from "./api.js";

const params = new URLSearchParams(window.location.search);
const state = {
  soc: params.get("soc") || "15-1252",
  region: params.get("region") || "National",
  date: params.get("date") || "2026-03-08"
};

const els = {
  occupationTitle: document.getElementById("occupationTitle"),
  occupationSummary: document.getElementById("occupationSummary"),
  occupationSoc: document.getElementById("occupationSoc"),
  occupationRegion: document.getElementById("occupationRegion"),
  occupationDate: document.getElementById("occupationDate"),
  occupationAirs: document.getElementById("occupationAirs"),
  occupationLabel: document.getElementById("occupationLabel"),
  occupationPostings: document.getElementById("occupationPostings"),
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
  evidenceList: document.getElementById("evidenceList"),
  taskCloud: document.getElementById("taskCloud")
};

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
      <linearGradient id="detailFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(143,66,95,0.35)"></stop>
        <stop offset="100%" stop-color="rgba(143,66,95,0.03)"></stop>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#detailFill)"></path>
    <path d="${linePath}" fill="none" stroke="#8f425f" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"></path>
    ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#8f425f"></circle>`).join("")}
    ${points.map((point, index) => `<text x="${point.x}" y="${height - 6}" text-anchor="middle" font-size="11" fill="#5f6e76">${months[index]}</text>`).join("")}
  `;
  els.timelineDelta.textContent = `近12个月 ${series[series.length - 1] - series[0] > 0 ? "+" : ""}${(series[series.length - 1] - series[0]).toFixed(1)} 分`;
}

async function init() {
  const payload = await getOccupationDetail(state.soc, state);
  const row = payload.occupation;
  els.occupationTitle.textContent = row.title;
  els.occupationSummary.textContent = row.summary;
  els.occupationSoc.textContent = row.socCode;
  els.occupationRegion.textContent = state.region;
  els.occupationDate.textContent = state.date;
  els.occupationAirs.textContent = row.airs.toFixed(0);
  els.occupationLabel.textContent = row.label;
  els.occupationPostings.textContent = row.postings.toLocaleString("en-US");
  setMeter(els.replacementBar, els.replacementValue, row.replacement);
  setMeter(els.augmentationBar, els.augmentationValue, row.augmentation);
  setMeter(els.hiringBar, els.hiringValue, row.hiring);
  setMeter(els.historicalBar, els.historicalValue, row.historical);
  renderTimeline(row.monthlyAirs);
  els.evidenceList.innerHTML = row.evidence.map((item) => `<article class="evidence-item"><h4>证据</h4><p>${item}</p></article>`).join("");
  els.taskCloud.innerHTML = row.tasks.map((task) => `<article class="task-chip"><h4>${task.name}</h4><p>暴露度 ${task.score.toFixed(2)}</p></article>`).join("");
}

init();
