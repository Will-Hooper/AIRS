const TEXT = {
  en: {
    home: {
      pageTitle: "AIRS Universe",
      language: "Language",
      brandTitle: "All Occupations",
      visitorLocalTime: "Visitor local time",
      detectingTimezone: "Detecting timezone...",
      browserLocale: "Browser locale",
      visitorLocale: "Visitor locale",
      heroKicker: "AI Recruitment Stability Score",
      heroTitle: "From the whole labor market to a single job, one scroll reveals how AI is rewriting hiring.",
      heroText: "The field below shows every occupation returned by the AIRS dataset. Use the wheel to zoom from a market-wide view into a single occupation's penetration pattern.",
      date: "Date",
      region: "Region",
      group: "Group",
      label: "Label",
      search: "Search",
      searchPlaceholder: "SOC code or occupation",
      averageAirs: "Average AIRS",
      highRisk: "High Risk",
      occupations: "Occupations",
      zoom: "Zoom",
      axisLow: "0 = fully displaced by AI",
      axisHigh: "100 = barely touched by AI",
      restructuringShare: "Restructuring share",
      augmentingShare: "Augmenting share",
      largestMove: "Largest 12m move",
      selectedOccupation: "Selected occupation",
      selectNode: "Select a node",
      selectNodeSummary: "Click any occupation node to inspect its current AI penetration profile.",
      replacement: "Replacement",
      augmentation: "Augmentation",
      hiring: "Hiring",
      historical: "Historical",
      openDetail: "Open detail page",
      smoothEnter: "Smooth enter detail",
      enterDetail: "Enter detail page",
      allGroups: "All groups",
      allLabels: "All labels",
      noOccupations: "No occupations in this filter",
      noOccupationsSummary: "Try another date, region, group, or label.",
      updatedPrefix: "updated",
      liveApiMode: "live api mode",
      mockMode: "mock mode",
      twelveMonthShort: "12m",
      socPlaceholder: "SOC --"
    },
    detail: {
      pageTitle: "AIRS Occupation Detail",
      back: "Back to universe",
      kicker: "Occupation detail",
      loadingTitle: "Loading occupation...",
      loadingSummary: "Pulling AIRS detail now.",
      airs: "AIRS",
      openPostings: "Open postings",
      breakdownKicker: "Breakdown",
      breakdownTitle: "How the score is being pulled down",
      trendKicker: "Trend",
      trendTitle: "Twelve-month AIRS movement",
      evidenceKicker: "Evidence",
      evidenceTitle: "Recruitment-side proof points",
      taskKicker: "Task exposure",
      taskTitle: "What AI can reach inside the job",
      signal: "Signal",
      exposure: "Exposure"
    },
    labels: {
      stable: "Stable",
      light: "Light",
      augmenting: "Augmenting",
      restructuring: "Restructuring",
      high_risk: "High Risk"
    },
    groups: {
      "Computer and Mathematical": "Computer and Mathematical",
      "Office and Administrative Support": "Office and Administrative Support",
      "Business and Financial Operations": "Business and Financial Operations",
      "Healthcare Practitioners and Technical": "Healthcare Practitioners and Technical",
      "Legal": "Legal"
    }
  },
  zh: {
    home: {
      pageTitle: "AIRS \u804c\u4e1a\u5168\u666f",
      language: "\u8bed\u8a00",
      brandTitle: "\u5168\u90e8\u804c\u4e1a",
      visitorLocalTime: "\u8bbf\u95ee\u8005\u5f53\u5730\u65f6\u95f4",
      detectingTimezone: "\u6b63\u5728\u8bc6\u522b\u65f6\u533a...",
      browserLocale: "\u6d4f\u89c8\u5668\u6240\u5728\u5730",
      visitorLocale: "\u8bbf\u95ee\u8005\u6240\u5728\u5730",
      heroKicker: "AI\u62db\u8058\u7a33\u5b9a\u5ea6\u6307\u6570",
      heroTitle: "\u4ece\u6574\u4e2a\u52b3\u52a8\u529b\u5e02\u573a\u5230\u5355\u4e2a\u804c\u4e1a\uff0c\u4e00\u6b21\u6eda\u8f6e\u7f29\u653e\u5c31\u80fd\u770b\u5230 AI \u5982\u4f55\u6539\u5199\u62db\u8058\u3002",
      heroText: "\u4e0b\u65b9\u89c6\u56fe\u5c55\u793a AIRS \u6570\u636e\u96c6\u4e2d\u8fd4\u56de\u7684\u5168\u90e8\u804c\u4e1a\u3002\u6eda\u52a8\u9f20\u6807\u6eda\u8f6e\u5373\u53ef\u4ece\u5b8f\u89c2\u5e02\u573a\u89c6\u89d2\u7f29\u653e\u5230\u5355\u4e2a\u804c\u4e1a\u7684 AI \u6e17\u900f\u72b6\u6001\u3002",
      date: "\u65e5\u671f",
      region: "\u5730\u533a",
      group: "\u804c\u4e1a\u5927\u7c7b",
      label: "\u6807\u7b7e",
      search: "\u641c\u7d22",
      searchPlaceholder: "\u8f93\u5165 SOC \u4ee3\u7801\u6216\u804c\u4e1a\u540d\u79f0",
      averageAirs: "\u5e73\u5747 AIRS",
      highRisk: "\u9ad8\u98ce\u9669\u804c\u4e1a",
      occupations: "\u804c\u4e1a\u6570\u91cf",
      zoom: "\u7f29\u653e",
      axisLow: "0 = \u5df2\u51e0\u4e4e\u88ab AI \u5b8c\u5168\u53d6\u4ee3",
      axisHigh: "100 = \u51e0\u4e4e\u672a\u53d7 AI \u5f71\u54cd",
      restructuringShare: "\u91cd\u6784\u4e2d\u5360\u6bd4",
      augmentingShare: "\u589e\u5f3a\u4e2d\u5360\u6bd4",
      largestMove: "\u8fd112\u4e2a\u6708\u53d8\u5316\u6700\u5927",
      selectedOccupation: "\u5f53\u524d\u9009\u4e2d\u804c\u4e1a",
      selectNode: "\u8bf7\u9009\u62e9\u4e00\u4e2a\u8282\u70b9",
      selectNodeSummary: "\u70b9\u51fb\u4efb\u610f\u804c\u4e1a\u8282\u70b9\uff0c\u67e5\u770b\u8be5\u804c\u4e1a\u5f53\u524d\u7684 AI \u6e17\u900f\u753b\u50cf\u3002",
      replacement: "\u66ff\u4ee3\u5f3a\u5ea6",
      augmentation: "\u589e\u5f3a\u6539\u5199",
      hiring: "\u62db\u8058\u5151\u73b0",
      historical: "\u5386\u53f2\u7d2f\u8ba1",
      openDetail: "\u6253\u5f00\u8be6\u60c5\u9875",
      smoothEnter: "\u5e73\u6ed1\u8fdb\u5165\u8be6\u60c5\u9875",
      enterDetail: "\u8fdb\u5165\u8be6\u60c5\u9875",
      allGroups: "\u5168\u90e8\u5927\u7c7b",
      allLabels: "\u5168\u90e8\u6807\u7b7e",
      noOccupations: "\u5f53\u524d\u7b5b\u9009\u6ca1\u6709\u804c\u4e1a",
      noOccupationsSummary: "\u8bf7\u5c1d\u8bd5\u5207\u6362\u65e5\u671f\u3001\u5730\u533a\u3001\u5927\u7c7b\u6216\u6807\u7b7e\u3002",
      updatedPrefix: "\u66f4\u65b0\u4e8e",
      liveApiMode: "\u5b9e\u65f6 API \u6a21\u5f0f",
      mockMode: "\u672c\u5730\u6a21\u62df\u6570\u636e\u6a21\u5f0f",
      twelveMonthShort: "\u8fd112\u4e2a\u6708",
      socPlaceholder: "SOC --"
    },
    detail: {
      pageTitle: "AIRS \u804c\u4e1a\u8be6\u60c5",
      back: "\u8fd4\u56de\u804c\u4e1a\u5b87\u5b99",
      kicker: "\u804c\u4e1a\u8be6\u60c5",
      loadingTitle: "\u6b63\u5728\u52a0\u8f7d\u804c\u4e1a...",
      loadingSummary: "\u6b63\u5728\u62c9\u53d6 AIRS \u8be6\u60c5\u6570\u636e\u3002",
      airs: "AIRS",
      openPostings: "\u5f00\u653e\u5c97\u4f4d\u6570",
      breakdownKicker: "\u62c6\u89e3",
      breakdownTitle: "\u8fd9\u4e2a\u5206\u6570\u5982\u4f55\u88ab\u62c9\u4f4e",
      trendKicker: "\u8d8b\u52bf",
      trendTitle: "\u8fc7\u53bb12\u4e2a\u6708 AIRS \u53d8\u5316",
      evidenceKicker: "\u8bc1\u636e",
      evidenceTitle: "\u62db\u8058\u4fa7\u8bc1\u636e\u94fe",
      taskKicker: "\u4efb\u52a1\u66b4\u9732",
      taskTitle: "AI \u80fd\u6e17\u900f\u5230\u8fd9\u4e2a\u804c\u4e1a\u7684\u54ea\u4e9b\u4efb\u52a1",
      signal: "\u4fe1\u53f7",
      exposure: "\u66b4\u9732\u5ea6"
    },
    labels: {
      stable: "\u57fa\u672c\u7a33\u5b9a",
      light: "\u8f7b\u5ea6\u6e17\u900f",
      augmenting: "\u589e\u5f3a\u4e2d",
      restructuring: "\u91cd\u6784\u4e2d",
      high_risk: "\u9ad8\u66ff\u4ee3\u98ce\u9669"
    },
    groups: {
      "Computer and Mathematical": "\u8ba1\u7b97\u673a\u4e0e\u6570\u5b66",
      "Office and Administrative Support": "\u529e\u516c\u5ba4\u4e0e\u884c\u653f\u652f\u6301",
      "Business and Financial Operations": "\u5546\u4e1a\u4e0e\u8d22\u52a1\u8fd0\u8425",
      "Healthcare Practitioners and Technical": "\u533b\u7597\u4e13\u4e1a\u4e0e\u6280\u672f",
      "Legal": "\u6cd5\u5f8b"
    }
  }
};

function getValue(language, key) {
  return key.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), TEXT[language]);
}

export function t(language, key) {
  return getValue(language, key) ?? getValue("en", key) ?? key;
}

export function labelText(language, label) {
  return getValue(language, `labels.${label}`) ?? getValue("en", `labels.${label}`) ?? label;
}

export function groupText(language, group) {
  return getValue(language, `groups.${group}`) ?? getValue("en", `groups.${group}`) ?? group;
}

export function getInitialLanguage() {
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("lang");
  if (queryValue === "zh" || queryValue === "en") {
    localStorage.setItem("airs_lang", queryValue);
    return queryValue;
  }
  const stored = localStorage.getItem("airs_lang");
  if (stored === "zh" || stored === "en") {
    return stored;
  }
  return navigator.language && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function persistLanguage(language) {
  localStorage.setItem("airs_lang", language);
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
}

export function applyTranslations(root, language) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(language, element.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(language, element.dataset.i18nPlaceholder));
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(language, element.dataset.i18nAriaLabel));
  });
}
