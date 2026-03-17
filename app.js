const RAW_DATA = {
  updatedAt: "2026-03-08T10:30:00+08:00",
  occupations: [
    { socCode: "15-1252", title: "Software Developers", majorGroup: "Computer and Mathematical", airs: 63, replacement: 0.49, augmentation: 0.88, hiring: 0.56, historical: 0.61, label: "AI增强中", summary: "代码生成和协作式开发工具显著改写 JD，但岗位招聘仍保持活跃。", monthlyAirs: [74, 73, 72, 70, 69, 68, 67, 67, 66, 65, 64, 63] },
    { socCode: "15-2051", title: "Data Scientists", majorGroup: "Computer and Mathematical", airs: 58, replacement: 0.41, augmentation: 0.91, hiring: 0.68, historical: 0.66, label: "AI增强中", summary: "职业需求未消失，但岗位职责快速转向 LLM、评测和数据工作流编排。", monthlyAirs: [69, 68, 67, 66, 64, 63, 62, 61, 61, 60, 59, 58] },
    { socCode: "43-6014", title: "Secretaries and Administrative Assistants", majorGroup: "Office and Administrative Support", airs: 24, replacement: 0.89, augmentation: 0.52, hiring: 0.83, historical: 0.73, label: "AI高替代风险", summary: "文档整理、日程安排和信息归档型任务受 AI 办公助手强烈冲击。", monthlyAirs: [37, 36, 35, 33, 31, 30, 29, 28, 27, 26, 25, 24] },
    { socCode: "43-4051", title: "Customer Service Representatives", majorGroup: "Office and Administrative Support", airs: 31, replacement: 0.81, augmentation: 0.57, hiring: 0.79, historical: 0.71, label: "AI重构中", summary: "AI 客服替代一线问答，但复杂升级工单和人机协同岗位仍持续存在。", monthlyAirs: [42, 41, 40, 39, 37, 36, 35, 34, 34, 33, 32, 31] },
    { socCode: "13-1161", title: "Market Research Analysts and Marketing Specialists", majorGroup: "Business and Financial Operations", airs: 54, replacement: 0.56, augmentation: 0.79, hiring: 0.62, historical: 0.64, label: "AI增强中", summary: "内容洞察、报告生成和受众分析被 AI 加速，岗位要求更偏策略与验证。", monthlyAirs: [63, 63, 62, 61, 60, 59, 58, 57, 56, 56, 55, 54] },
    { socCode: "11-2021", title: "Marketing Managers", majorGroup: "Management", airs: 68, replacement: 0.32, augmentation: 0.77, hiring: 0.44, historical: 0.53, label: "AI轻度渗透", summary: "AI 更像放大器，提升投放、创意和分析效率，但核心决策仍由人主导。", monthlyAirs: [75, 74, 74, 73, 72, 72, 71, 70, 69, 69, 68, 68] },
    { socCode: "29-1141", title: "Registered Nurses", majorGroup: "Healthcare Practitioners and Technical", airs: 86, replacement: 0.16, augmentation: 0.38, hiring: 0.21, historical: 0.28, label: "基本稳定", summary: "文书和初步分诊被 AI 辅助，但临床责任、现场护理和患者信任高度依赖人工。", monthlyAirs: [90, 90, 89, 89, 89, 88, 88, 87, 87, 87, 86, 86] },
    { socCode: "29-1216", title: "General Internal Medicine Physicians", majorGroup: "Healthcare Practitioners and Technical", airs: 82, replacement: 0.21, augmentation: 0.54, hiring: 0.24, historical: 0.33, label: "基本稳定", summary: "诊断支持和病历生成提升效率，但最终责任和患者互动仍强依赖医生。", monthlyAirs: [86, 86, 85, 85, 84, 84, 83, 83, 83, 82, 82, 82] },
    { socCode: "23-1011", title: "Lawyers", majorGroup: "Legal", airs: 71, replacement: 0.34, augmentation: 0.73, hiring: 0.39, historical: 0.49, label: "AI轻度渗透", summary: "检索、摘要和合同初稿已被自动化改写，但代理和责任边界压住了替代速度。", monthlyAirs: [78, 77, 77, 76, 75, 75, 74, 73, 73, 72, 71, 71] },
    { socCode: "47-2061", title: "Construction Laborers", majorGroup: "Construction and Extraction", airs: 91, replacement: 0.08, augmentation: 0.16, hiring: 0.11, historical: 0.19, label: "基本稳定", summary: "现场施工的物理性、环境变化和安全责任使 AI 当前更多停留在计划和记录层。", monthlyAirs: [93, 93, 93, 92, 92, 92, 92, 91, 91, 91, 91, 91] },
    { socCode: "41-4012", title: "Sales Representatives, Wholesale and Manufacturing", majorGroup: "Sales and Related", airs: 66, replacement: 0.37, augmentation: 0.69, hiring: 0.43, historical: 0.45, label: "AI轻度渗透", summary: "线索筛选和销售辅助脚本已显著 AI 化，但复杂成交仍看人际博弈。", monthlyAirs: [72, 72, 71, 70, 70, 69, 69, 68, 67, 67, 66, 66] },
    { socCode: "27-3043", title: "Writers and Authors", majorGroup: "Arts, Design, Entertainment, Sports, and Media", airs: 28, replacement: 0.85, augmentation: 0.76, hiring: 0.81, historical: 0.77, label: "AI高替代风险", summary: "通用内容生产被大幅压价，岗位需求转向品牌判断、编辑和高价值原创。", monthlyAirs: [43, 42, 40, 38, 36, 34, 33, 32, 31, 30, 29, 28] },
    { socCode: "43-9021", title: "Data Entry Keyers", majorGroup: "Office and Administrative Support", airs: 12, replacement: 0.94, augmentation: 0.31, hiring: 0.91, historical: 0.84, label: "AI高替代风险", summary: "OCR、RPA 和生成式输入理解共同压缩了该职业的大部分标准化岗位。", monthlyAirs: [24, 23, 22, 21, 19, 18, 17, 16, 15, 14, 13, 12] },
    { socCode: "51-9198", title: "Helpers--Production Workers", majorGroup: "Production", airs: 74, replacement: 0.27, augmentation: 0.28, hiring: 0.29, historical: 0.41, label: "AI轻度渗透", summary: "AI 当前更多影响排产和质检，而不是直接替代现场辅助工位。", monthlyAirs: [78, 78, 77, 77, 76, 76, 75, 75, 75, 74, 74, 74] },
    { socCode: "19-3033", title: "Clinical and Counseling Psychologists", majorGroup: "Life, Physical, and Social Science", airs: 88, replacement: 0.12, augmentation: 0.27, hiring: 0.15, historical: 0.22, label: "基本稳定", summary: "AI 可辅助记录和初筛，但治疗关系与专业责任显著限制替代。", monthlyAirs: [91, 91, 91, 90, 90, 90, 89, 89, 89, 88, 88, 88] },
    { socCode: "13-2011", title: "Accountants and Auditors", majorGroup: "Business and Financial Operations", airs: 47, replacement: 0.68, augmentation: 0.71, hiring: 0.63, historical: 0.58, label: "AI重构中", summary: "核对、归类和底稿整理被强力自动化，岗位向判断、合规和解释迁移。", monthlyAirs: [57, 56, 55, 54, 53, 52, 51, 50, 49, 48, 47, 47] },
    { socCode: "13-1082", title: "Project Management Specialists", majorGroup: "Business and Financial Operations", airs: 72, replacement: 0.29, augmentation: 0.64, hiring: 0.33, historical: 0.42, label: "AI轻度渗透", summary: "AI 正在吸收文档和跟进工作，但跨团队协调与责任承接仍稳定存在。", monthlyAirs: [78, 77, 77, 76, 75, 75, 74, 74, 73, 73, 72, 72] },
    { socCode: "35-3031", title: "Waiters and Waitresses", majorGroup: "Food Preparation and Serving Related", airs: 84, replacement: 0.15, augmentation: 0.18, hiring: 0.17, historical: 0.24, label: "基本稳定", summary: "点单和排队可被系统化，但服务体验和现场响应仍强依赖人工。", monthlyAirs: [87, 87, 87, 86, 86, 86, 85, 85, 85, 84, 84, 84] }
  ]
};

const state = { majorGroup: "all", label: "all", query: "", selectedSocCode: null };

const els = {
  majorGroupSelect: document.getElementById("majorGroupSelect"),
  labelSelect: document.getElementById("labelSelect"),
  searchInput: document.getElementById("searchInput"),
  lastUpdatedLabel: document.getElementById("lastUpdatedLabel"),
  avgAirs: document.getElementById("avgAirs"),
  highRiskCount: document.getElementById("highRiskCount"),
  occupationCount: document.getElementById("occupationCount"),
  restructuringRate: document.getElementById("restructuringRate"),
  augmentingRate: document.getElementById("augmentingRate"),
  mostChangedOccupation: document.getElementById("mostChangedOccupation"),
  mostChangedDelta: document.getElementById("mostChangedDelta"),
  distributionBands: document.getElementById("distributionBands"),
  rankingTable: document.getElementById("rankingTable"),
  detailTitle: document.getElementById("detailTitle"),
  detailSoc: document.getElementById("detailSoc"),
  detailScore: document.getElementById("detailScore"),
  detailLabel: document.getElementById("detailLabel"),
  detailSummary: document.getElementById("detailSummary"),
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

function getFilteredOccupations() {
  return RAW_DATA.occupations.filter((occupation) => {
    const majorOk = state.majorGroup === "all" || occupation.majorGroup === state.majorGroup;
    const labelOk = state.label === "all" || occupation.label === state.label;
    const query = state.query.trim().toLowerCase();
    const queryOk = !query || occupation.title.toLowerCase().includes(query) || occupation.socCode.toLowerCase().includes(query);
    return majorOk && labelOk && queryOk;
  });
}

function buildFilters() {
  const majorGroups = [...new Set(RAW_DATA.occupations.map((d) => d.majorGroup))].sort();
  const labels = [...new Set(RAW_DATA.occupations.map((d) => d.label))];
  els.majorGroupSelect.innerHTML = ['<option value="all">全部大类</option>', ...majorGroups.map((group) => `<option value="${group}">${group}</option>`)].join("");
  els.labelSelect.innerHTML = ['<option value="all">全部标签</option>', ...labels.map((label) => `<option value="${label}">${label}</option>`)].join("");
}

function computeSummary(rows) {
  const avgAirs = rows.reduce((sum, row) => sum + row.airs, 0) / (rows.length || 1);
  const highRiskCount = rows.filter((row) => row.label === "AI高替代风险").length;
  const restructuringCount = rows.filter((row) => ["AI重构中", "AI高替代风险"].includes(row.label)).length;
  const augmentingCount = rows.filter((row) => row.label === "AI增强中").length;
  const mostChanged = [...rows].map((row) => ({ ...row, delta: row.monthlyAirs.at(-1) - row.monthlyAirs[0] })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  els.avgAirs.textContent = avgAirs.toFixed(1);
  els.highRiskCount.textContent = `${highRiskCount} 个`;
  els.occupationCount.textContent = `${rows.length} 个`;
  els.restructuringRate.textContent = fmtPercent(restructuringCount / (rows.length || 1));
  els.augmentingRate.textContent = fmtPercent(augmentingCount / (rows.length || 1));
  els.mostChangedOccupation.textContent = mostChanged ? mostChanged.title : "--";
  els.mostChangedDelta.textContent = mostChanged ? `12个月变化 ${fmtDelta(mostChanged.delta)} 分` : "--";
}

function renderDistribution(rows) {
  const bands = [
    { name: "85-100", desc: "基本稳定", filter: (x) => x.airs >= 85 },
    { name: "70-84", desc: "AI轻度渗透", filter: (x) => x.airs >= 70 && x.airs < 85 },
    { name: "50-69", desc: "AI增强中", filter: (x) => x.airs >= 50 && x.airs < 70 },
    { name: "30-49", desc: "AI重构中", filter: (x) => x.airs >= 30 && x.airs < 50 },
    { name: "0-29", desc: "AI高替代风险", filter: (x) => x.airs < 30 }
  ];
  els.distributionBands.innerHTML = bands.map((band) => {
    const count = rows.filter(band.filter).length;
    const ratio = (count / (rows.length || 1)) * 100;
    return `<div class="band"><div class="band__top"><strong>${band.name}</strong><span>${band.desc} · ${count} 个</span></div><div class="band__bar"><div style="width:${ratio}%"></div></div></div>`;
  }).join("");
}

function renderRanking(rows) {
  const sorted = [...rows].sort((a, b) => a.airs - b.airs);
  if (!state.selectedSocCode || !sorted.some((row) => row.socCode === state.selectedSocCode)) state.selectedSocCode = sorted[0]?.socCode ?? null;
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
      render();
    });
  });
}

function setMeter(barEl, valueEl, value) {
  barEl.style.width = `${Math.round(value * 100)}%`;
  valueEl.textContent = value.toFixed(2);
}

function renderTimeline(series) {
  const width = 600;
  const height = 220;
  const padding = 24;
  const min = Math.min(...series) - 4;
  const max = Math.max(...series) + 4;
  const stepX = (width - padding * 2) / (series.length - 1);
  const points = series.map((value, index) => {
    const x = padding + stepX * index;
    const y = height - padding - ((value - min) / (max - min)) * (height - padding * 2);
    return { x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points.at(-1).x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  const labels = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];
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
    ${points.map((point, index) => `<text x="${point.x}" y="${height - 6}" text-anchor="middle" font-size="11" fill="#5f6e76">${labels[index]}</text>`).join("")}
  `;
  const delta = series.at(-1) - series[0];
  els.timelineDelta.textContent = `近12个月 ${fmtDelta(delta)} 分`;
}

function renderDetail(rows) {
  const selected = rows.find((row) => row.socCode === state.selectedSocCode) ?? rows[0];
  if (!selected) return;
  els.detailTitle.textContent = selected.title;
  els.detailSoc.textContent = selected.socCode;
  els.detailScore.textContent = selected.airs.toFixed(0);
  els.detailLabel.textContent = selected.label;
  els.detailSummary.textContent = selected.summary;
  const circumference = 2 * Math.PI * 48;
  els.scoreRing.style.strokeDasharray = `${circumference}`;
  els.scoreRing.style.strokeDashoffset = `${circumference * (1 - selected.airs / 100)}`;
  setMeter(els.replacementBar, els.replacementValue, selected.replacement);
  setMeter(els.augmentationBar, els.augmentationValue, selected.augmentation);
  setMeter(els.hiringBar, els.hiringValue, selected.hiring);
  setMeter(els.historicalBar, els.historicalValue, selected.historical);
  renderTimeline(selected.monthlyAirs);
}

function renderLastUpdated() {
  const dt = new Date(RAW_DATA.updatedAt);
  els.lastUpdatedLabel.textContent = `最近更新 ${dt.toLocaleString("zh-CN", { hour12: false })}`;
}

function render() {
  const rows = getFilteredOccupations();
  computeSummary(rows);
  renderDistribution(rows);
  renderRanking(rows);
  renderDetail(rows);
}

function bindEvents() {
  els.majorGroupSelect.addEventListener("change", (event) => { state.majorGroup = event.target.value; render(); });
  els.labelSelect.addEventListener("change", (event) => { state.label = event.target.value; render(); });
  els.searchInput.addEventListener("input", (event) => { state.query = event.target.value; render(); });
}

function init() {
  buildFilters();
  bindEvents();
  renderLastUpdated();
  render();
}

init();
