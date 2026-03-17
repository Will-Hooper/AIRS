export const MOCK_DATA = {
  dates: ["2025-12-31", "2026-01-31", "2026-02-28", "2026-03-08"],
  regions: ["National", "West", "Midwest", "South", "Northeast"],
  labels: ["stable", "light", "augmenting", "restructuring", "high_risk"],
  occupations: [
    {
      socCode: "15-1252",
      title: "Software Developers",
      majorGroup: "Computer and Mathematical",
      label: "augmenting",
      summary: "Coding copilots are rewriting the JD, but hiring stays active for architecture and review work.",
      regions: {
        National: { airs: 63, replacement: 0.49, augmentation: 0.88, hiring: 0.56, historical: 0.61, postings: 12840 },
        West: { airs: 60, replacement: 0.52, augmentation: 0.90, hiring: 0.59, historical: 0.61, postings: 4320 },
        Midwest: { airs: 65, replacement: 0.46, augmentation: 0.84, hiring: 0.52, historical: 0.61, postings: 2110 },
        South: { airs: 64, replacement: 0.47, augmentation: 0.86, hiring: 0.54, historical: 0.61, postings: 3890 },
        Northeast: { airs: 62, replacement: 0.50, augmentation: 0.89, hiring: 0.57, historical: 0.61, postings: 2520 }
      },
      monthlyAirs: [74, 73, 72, 70, 69, 68, 67, 67, 66, 65, 64, 63],
      evidence: [
        "JD mentions of copilots, LLMs, and AI-assisted coding keep rising.",
        "Hiring shifted toward system design, review, and product delivery instead of baseline code output.",
        "Entry-level engineering slots shrank faster than senior roles."
      ],
      tasks: [
        { name: "Coding", score: 0.82 },
        { name: "Code review", score: 0.55 },
        { name: "System design", score: 0.29 },
        { name: "Cross-team alignment", score: 0.22 }
      ]
    },
    {
      socCode: "43-9021",
      title: "Data Entry Keyers",
      majorGroup: "Office and Administrative Support",
      label: "high_risk",
      summary: "OCR, RPA, and generative input parsing compress most standard data entry roles.",
      regions: {
        National: { airs: 12, replacement: 0.94, augmentation: 0.31, hiring: 0.91, historical: 0.84, postings: 510 },
        West: { airs: 10, replacement: 0.95, augmentation: 0.33, hiring: 0.93, historical: 0.84, postings: 122 },
        Midwest: { airs: 14, replacement: 0.92, augmentation: 0.28, hiring: 0.88, historical: 0.84, postings: 96 },
        South: { airs: 13, replacement: 0.93, augmentation: 0.30, hiring: 0.90, historical: 0.84, postings: 189 },
        Northeast: { airs: 11, replacement: 0.94, augmentation: 0.32, hiring: 0.92, historical: 0.84, postings: 103 }
      },
      monthlyAirs: [24, 23, 22, 21, 19, 18, 17, 16, 15, 14, 13, 12],
      evidence: [
        "Document extraction and form-fill automation replaced a large share of standard input work.",
        "Net-new hiring is mostly exception handling instead of persistent entry labor.",
        "Basic entry duties are being merged into broader operations support jobs."
      ],
      tasks: [
        { name: "Structured input", score: 0.97 },
        { name: "Error checking", score: 0.52 },
        { name: "Formatting", score: 0.89 },
        { name: "System transfer", score: 0.91 }
      ]
    },
    {
      socCode: "43-4051",
      title: "Customer Service Representatives",
      majorGroup: "Office and Administrative Support",
      label: "restructuring",
      summary: "AI handles first-line questions, while humans retain escalations and empathy-heavy cases.",
      regions: {
        National: { airs: 31, replacement: 0.81, augmentation: 0.57, hiring: 0.79, historical: 0.71, postings: 3920 },
        West: { airs: 28, replacement: 0.83, augmentation: 0.58, hiring: 0.81, historical: 0.71, postings: 840 },
        Midwest: { airs: 34, replacement: 0.78, augmentation: 0.54, hiring: 0.74, historical: 0.71, postings: 780 },
        South: { airs: 30, replacement: 0.81, augmentation: 0.57, hiring: 0.80, historical: 0.71, postings: 1560 },
        Northeast: { airs: 32, replacement: 0.80, augmentation: 0.57, hiring: 0.77, historical: 0.71, postings: 740 }
      },
      monthlyAirs: [42, 41, 40, 39, 37, 36, 35, 34, 34, 33, 32, 31],
      evidence: [
        "Tier-one answers are increasingly routed to AI agents.",
        "Human roles now focus on escalations, churn prevention, and quality review.",
        "Knowledge-base operations are becoming a core hybrid function."
      ],
      tasks: [
        { name: "Standard answers", score: 0.90 },
        { name: "Complaint handling", score: 0.38 },
        { name: "Emotion management", score: 0.29 },
        { name: "Escalation", score: 0.44 }
      ]
    },
    {
      socCode: "13-2011",
      title: "Accountants and Auditors",
      majorGroup: "Business and Financial Operations",
      label: "restructuring",
      summary: "Matching and classification work automate fast, while judgment and compliance remain human-led.",
      regions: {
        National: { airs: 47, replacement: 0.68, augmentation: 0.71, hiring: 0.63, historical: 0.58, postings: 4160 },
        West: { airs: 45, replacement: 0.70, augmentation: 0.73, hiring: 0.65, historical: 0.58, postings: 830 },
        Midwest: { airs: 50, replacement: 0.65, augmentation: 0.69, hiring: 0.60, historical: 0.58, postings: 910 },
        South: { airs: 48, replacement: 0.67, augmentation: 0.70, hiring: 0.62, historical: 0.58, postings: 1500 },
        Northeast: { airs: 46, replacement: 0.69, augmentation: 0.72, hiring: 0.64, historical: 0.58, postings: 920 }
      },
      monthlyAirs: [57, 56, 55, 54, 53, 52, 51, 50, 49, 48, 47, 47],
      evidence: [
        "Automated reconciliation and anomaly detection appear in more finance JDs.",
        "Higher-value judgment and regulator-facing work still need human staff.",
        "Shared-service teams keep compressing low-complexity work."
      ],
      tasks: [
        { name: "Classification", score: 0.88 },
        { name: "Exception review", score: 0.58 },
        { name: "Compliance judgment", score: 0.34 },
        { name: "Regulator communication", score: 0.19 }
      ]
    },
    {
      socCode: "29-1141",
      title: "Registered Nurses",
      majorGroup: "Healthcare Practitioners and Technical",
      label: "stable",
      summary: "AI helps with records and triage, but bedside care and clinical accountability remain human.",
      regions: {
        National: { airs: 86, replacement: 0.16, augmentation: 0.38, hiring: 0.21, historical: 0.28, postings: 9380 },
        West: { airs: 85, replacement: 0.17, augmentation: 0.40, hiring: 0.23, historical: 0.28, postings: 1880 },
        Midwest: { airs: 87, replacement: 0.15, augmentation: 0.34, hiring: 0.20, historical: 0.28, postings: 2110 },
        South: { airs: 86, replacement: 0.16, augmentation: 0.37, hiring: 0.21, historical: 0.28, postings: 3660 },
        Northeast: { airs: 85, replacement: 0.17, augmentation: 0.39, hiring: 0.22, historical: 0.28, postings: 1730 }
      },
      monthlyAirs: [90, 90, 89, 89, 89, 88, 88, 87, 87, 87, 86, 86],
      evidence: [
        "AI is used mostly for charting, reminders, and early risk alerts.",
        "Bedside care and patient trust still require direct human presence.",
        "Hiring volume is driven more by care demand than by AI substitution."
      ],
      tasks: [
        { name: "Documentation", score: 0.56 },
        { name: "Bedside care", score: 0.12 },
        { name: "Patient communication", score: 0.18 },
        { name: "Order execution", score: 0.21 }
      ]
    },
    {
      socCode: "23-1011",
      title: "Lawyers",
      majorGroup: "Legal",
      label: "light",
      summary: "Search, summarization, and drafting accelerate, but representation and liability stay human.",
      regions: {
        National: { airs: 71, replacement: 0.34, augmentation: 0.73, hiring: 0.39, historical: 0.49, postings: 2740 },
        West: { airs: 69, replacement: 0.36, augmentation: 0.74, hiring: 0.41, historical: 0.49, postings: 630 },
        Midwest: { airs: 73, replacement: 0.32, augmentation: 0.70, hiring: 0.36, historical: 0.49, postings: 520 },
        South: { airs: 72, replacement: 0.33, augmentation: 0.72, hiring: 0.38, historical: 0.49, postings: 810 },
        Northeast: { airs: 70, replacement: 0.35, augmentation: 0.74, hiring: 0.40, historical: 0.49, postings: 780 }
      },
      monthlyAirs: [78, 77, 77, 76, 75, 75, 74, 73, 73, 72, 71, 71],
      evidence: [
        "Search and summarization cycles are shorter, but final legal responsibility is unchanged.",
        "Law firms increasingly hire for legal expertise plus AI governance fluency.",
        "The surviving demand skews toward analysis and client communication."
      ],
      tasks: [
        { name: "Case search", score: 0.79 },
        { name: "Drafting", score: 0.72 },
        { name: "Court representation", score: 0.14 },
        { name: "Client strategy", score: 0.26 }
      ]
    }
  ]
};
