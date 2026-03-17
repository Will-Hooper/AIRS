import { MOCK_DATA } from "./mock-data.js";

function withQuery(url, params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `${url}?${query}` : url;
}

function baseOccupation(occupation, region) {
  const metrics = occupation.regions[region] || occupation.regions.National;
  return {
    socCode: occupation.socCode,
    title: occupation.title,
    majorGroup: occupation.majorGroup,
    label: occupation.label,
    summary: occupation.summary,
    monthlyAirs: occupation.monthlyAirs,
    evidence: occupation.evidence,
    tasks: occupation.tasks,
    regionMetrics: occupation.regions,
    ...metrics
  };
}

function mockFilter(params = {}) {
  const region = params.region || "National";
  let rows = MOCK_DATA.occupations.map((occupation) => baseOccupation(occupation, region));

  if (params.majorGroup && params.majorGroup !== "all") {
    rows = rows.filter((row) => row.majorGroup === params.majorGroup);
  }
  if (params.label && params.label !== "all") {
    rows = rows.filter((row) => row.label === params.label);
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter((row) => row.title.toLowerCase().includes(q) || row.socCode.toLowerCase().includes(q));
  }

  return rows;
}

export async function getSummary(params = {}) {
  try {
    const response = await fetch(withQuery("/api/airs/summary", params));
    if (!response.ok) throw new Error("summary request failed");
    return { mode: "api", ...(await response.json()) };
  } catch {
    const rows = mockFilter(params);
    const avgAirs = rows.reduce((sum, row) => sum + row.airs, 0) / (rows.length || 1);
    return {
      mode: "mock",
      updatedAt: "2026-03-08T10:30:00+08:00",
      avgAirs,
      highRiskCount: rows.filter((row) => row.label === "AI高替代风险").length,
      occupationCount: rows.length
    };
  }
}

export async function getOccupations(params = {}) {
  try {
    const response = await fetch(withQuery("/api/airs/occupations", params));
    if (!response.ok) throw new Error("occupations request failed");
    return { mode: "api", ...(await response.json()) };
  } catch {
    return {
      mode: "mock",
      updatedAt: "2026-03-08T10:30:00+08:00",
      dates: MOCK_DATA.dates,
      regions: MOCK_DATA.regions,
      labels: MOCK_DATA.labels,
      occupations: mockFilter(params)
    };
  }
}

export async function getOccupationDetail(socCode, params = {}) {
  try {
    const response = await fetch(withQuery(`/api/airs/${encodeURIComponent(socCode)}`, params));
    if (!response.ok) throw new Error("detail request failed");
    return { mode: "api", ...(await response.json()) };
  } catch {
    const region = params.region || "National";
    const occupation = MOCK_DATA.occupations.find((row) => row.socCode === socCode) || MOCK_DATA.occupations[0];
    return { mode: "mock", updatedAt: "2026-03-08T10:30:00+08:00", occupation: baseOccupation(occupation, region), regions: MOCK_DATA.regions, dates: MOCK_DATA.dates };
  }
}
