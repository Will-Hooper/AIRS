import { getOccupationDetail } from "./api-client.js";
import { applyTranslations, getInitialLanguage, labelText, persistLanguage, t } from "./i18n.js";

const params = new URLSearchParams(window.location.search);
const state = {
  soc: params.get("soc") || "15-1252",
  region: params.get("region") || "National",
  date: params.get("date") || "2026-03-08",
  lang: getInitialLanguage()
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
  taskCloud: document.getElementById("taskCloud"),
  backLink: document.querySelector(".detail-back"),
  languageButtons: document.querySelectorAll("[data-lang-option]")
};

const MONTH_LABELS = {
  en: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
  zh: ["4\u6708", "5\u6708", "6\u6708", "7\u6708", "8\u6708", "9\u6708", "10\u6708", "11\u6708", "12\u6708", "1\u6708", "2\u6708", "3\u6708"]
};

function displayTitle(row) {
  return state.lang === "zh" ? (row.titleZh || row.title) : row.title;
}

function displaySummary(row) {
  return state.lang === "zh" ? (row.summaryZh || row.summary) : row.summary;
}

function displayEvidence(row) {
  return state.lang === "zh" ? (row.evidenceZh || row.evidence) : row.evidence;
}

function displayTaskName(task) {
  return state.lang === "zh" ? (task.nameZh || task.name) : task.name;
}

function refreshStaticLanguage() {
  persistLanguage(state.lang);
  applyTranslations(document, state.lang);
  document.title = t(state.lang, "detail.pageTitle");
  els.languageButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.langOption === state.lang);
  });
  els.backLink.href = `home.html?lang=${encodeURIComponent(state.lang)}&region=${encodeURIComponent(state.region)}&date=${encodeURIComponent(state.date)}`;
}

function setMeter(bar, label, value) {
  bar.style.width = `${Math.round(value * 100)}%`;
  label.textContent = value.toFixed(2);
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
        <stop offset="0%" stop-color="rgba(38,116,255,0.34)"></stop>
        <stop offset="100%" stop-color="rgba(38,116,255,0.03)"></stop>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#detailFill)"></path>
    <path d="${linePath}" fill="none" stroke="#2674ff" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"></path>
    ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#2674ff"></circle>`).join("")}
    ${points.map((point, index) => `<text x="${point.x}" y="${height - 6}" text-anchor="middle" font-size="11" fill="#6e7380">${labels[index]}</text>`).join("")}
  `;

  const delta = series[series.length - 1] - series[0];
  els.timelineDelta.textContent = `${t(state.lang, "home.twelveMonthShort")} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
}

async function renderPage() {
  const payload = await getOccupationDetail(state.soc, state);
  const row = payload.occupation;

  els.occupationTitle.textContent = displayTitle(row);
  els.occupationSummary.textContent = displaySummary(row);
  els.occupationSoc.textContent = row.socCode;
  els.occupationRegion.textContent = state.region;
  els.occupationDate.textContent = state.date;
  els.occupationAirs.textContent = row.airs.toFixed(0);
  els.occupationLabel.textContent = labelText(state.lang, row.label);
  els.occupationPostings.textContent = row.postings.toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US");

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
      <p>${t(state.lang, "detail.exposure")} ${task.score.toFixed(2)}</p>
    </article>
  `).join("");
}

function bindLanguage() {
  els.languageButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      state.lang = button.dataset.langOption;
      refreshStaticLanguage();
      await renderPage();
    });
  });
}

async function init() {
  refreshStaticLanguage();
  document.body.classList.add("page-ready");
  bindLanguage();
  await renderPage();
}

init();
