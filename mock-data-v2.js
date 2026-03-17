export const LABEL_TEXT = {
  stable: "Stable",
  light: "Light",
  augmenting: "Augmenting",
  restructuring: "Restructuring",
  high_risk: "High Risk"
};

export const MOCK_DATA_V2 = {
  dates: ["2025-12-31", "2026-01-31", "2026-02-28", "2026-03-08"],
  regions: ["National", "West", "Midwest", "South", "Northeast"],
  labels: Object.keys(LABEL_TEXT),
  occupations: [
    {
      socCode: "15-1252",
      title: "Software Developers",
      titleZh: "软件开发人员",
      majorGroup: "Computer and Mathematical",
      label: "augmenting",
      summary: "Coding copilots reshape hiring, but firms still recruit for design, review, and product delivery.",
      summaryZh: "代码副驾驶正在重写招聘要求，但企业仍在招聘负责架构、评审和产品交付的人才。",
      regions: {
        National: { airs: 63, replacement: 0.49, augmentation: 0.88, hiring: 0.56, historical: 0.61, postings: 12840 },
        West: { airs: 60, replacement: 0.52, augmentation: 0.90, hiring: 0.59, historical: 0.61, postings: 4320 },
        Midwest: { airs: 65, replacement: 0.46, augmentation: 0.84, hiring: 0.52, historical: 0.61, postings: 2110 },
        South: { airs: 64, replacement: 0.47, augmentation: 0.86, hiring: 0.54, historical: 0.61, postings: 3890 },
        Northeast: { airs: 62, replacement: 0.50, augmentation: 0.89, hiring: 0.57, historical: 0.61, postings: 2520 }
      },
      monthlyAirs: [74, 73, 72, 70, 69, 68, 67, 67, 66, 65, 64, 63],
      evidence: [
        "Mentions of copilots, LLMs, and AI-assisted coding keep rising.",
        "Entry-level coding output matters less than architecture and review quality.",
        "Junior slots shrink faster than senior engineering roles."
      ],
      evidenceZh: [
        "岗位描述中对 Copilot、LLM 和 AI 辅助编码的提及持续增加。",
        "企业更看重架构设计、评审质量和落地能力，而不是基础代码产出。",
        "初级岗位收缩速度快于资深工程岗位。"
      ],
      tasks: [
        { name: "Coding", nameZh: "编码实现", score: 0.82 },
        { name: "Code review", nameZh: "代码评审", score: 0.55 },
        { name: "System design", nameZh: "系统设计", score: 0.29 },
        { name: "Cross-team alignment", nameZh: "跨团队协同", score: 0.22 }
      ]
    },
    {
      socCode: "43-9021",
      title: "Data Entry Keyers",
      titleZh: "数据录入员",
      majorGroup: "Office and Administrative Support",
      label: "high_risk",
      summary: "OCR, RPA, and generative parsing compress most standard data entry demand.",
      summaryZh: "OCR、RPA 和生成式解析正在压缩大部分标准化数据录入需求。",
      regions: {
        National: { airs: 12, replacement: 0.94, augmentation: 0.31, hiring: 0.91, historical: 0.84, postings: 510 },
        West: { airs: 10, replacement: 0.95, augmentation: 0.33, hiring: 0.93, historical: 0.84, postings: 122 },
        Midwest: { airs: 14, replacement: 0.92, augmentation: 0.28, hiring: 0.88, historical: 0.84, postings: 96 },
        South: { airs: 13, replacement: 0.93, augmentation: 0.30, hiring: 0.90, historical: 0.84, postings: 189 },
        Northeast: { airs: 11, replacement: 0.94, augmentation: 0.32, hiring: 0.92, historical: 0.84, postings: 103 }
      },
      monthlyAirs: [24, 23, 22, 21, 19, 18, 17, 16, 15, 14, 13, 12],
      evidence: [
        "Document extraction and form-fill automation replaced standard entry work.",
        "New hiring is mostly for exception handling instead of persistent input labor.",
        "Basic input duties are folded into broader operations roles."
      ],
      evidenceZh: [
        "文档抽取和表单自动回填已经替代了大量标准录入工作。",
        "新增招聘更多集中在例外处理，而不是持续性的录入劳动。",
        "基础录入职责正在被并入更宽的运营岗位。"
      ],
      tasks: [
        { name: "Structured input", nameZh: "结构化录入", score: 0.97 },
        { name: "Error checking", nameZh: "异常检查", score: 0.52 },
        { name: "Formatting", nameZh: "格式整理", score: 0.89 },
        { name: "System transfer", nameZh: "跨系统传递", score: 0.91 }
      ]
    },
    {
      socCode: "43-4051",
      title: "Customer Service Representatives",
      titleZh: "客服代表",
      majorGroup: "Office and Administrative Support",
      label: "restructuring",
      summary: "AI absorbs first-line requests while humans retain escalation and empathy-heavy work.",
      summaryZh: "AI 正在吸收一线标准请求，而人类保留升级处理和高同理心工作。",
      regions: {
        National: { airs: 31, replacement: 0.81, augmentation: 0.57, hiring: 0.79, historical: 0.71, postings: 3920 },
        West: { airs: 28, replacement: 0.83, augmentation: 0.58, hiring: 0.81, historical: 0.71, postings: 840 },
        Midwest: { airs: 34, replacement: 0.78, augmentation: 0.54, hiring: 0.74, historical: 0.71, postings: 780 },
        South: { airs: 30, replacement: 0.81, augmentation: 0.57, hiring: 0.80, historical: 0.71, postings: 1560 },
        Northeast: { airs: 32, replacement: 0.80, augmentation: 0.57, hiring: 0.77, historical: 0.71, postings: 740 }
      },
      monthlyAirs: [42, 41, 40, 39, 37, 36, 35, 34, 34, 33, 32, 31],
      evidence: [
        "Tier-one answers route to AI agents more often.",
        "Human roles focus on escalations, churn prevention, and QA review.",
        "Knowledge-base operations become a core hybrid function."
      ],
      evidenceZh: [
        "一级问答越来越多地被路由给 AI 智能体。",
        "人工岗位更加聚焦升级处理、流失挽回和质检复核。",
        "知识库运营正成为核心的人机协同职能。"
      ],
      tasks: [
        { name: "Standard answers", nameZh: "标准答复", score: 0.90 },
        { name: "Complaint handling", nameZh: "投诉处理", score: 0.38 },
        { name: "Emotion management", nameZh: "情绪安抚", score: 0.29 },
        { name: "Escalation", nameZh: "工单升级", score: 0.44 }
      ]
    },
    {
      socCode: "13-2011",
      title: "Accountants and Auditors",
      titleZh: "会计与审计人员",
      majorGroup: "Business and Financial Operations",
      label: "restructuring",
      summary: "Matching and classification automate fast, while judgment and compliance stay human-led.",
      summaryZh: "匹配和归类正在快速自动化，而判断与合规仍由人主导。",
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
        "Higher-value judgment and regulator-facing work still need people.",
        "Shared-service teams keep compressing low-complexity work."
      ],
      evidenceZh: [
        "越来越多财务岗位描述中出现自动对账和异常识别系统。",
        "高价值判断和面向监管的工作仍需要人工承担。",
        "共享服务团队仍在持续压缩低复杂度工作。"
      ],
      tasks: [
        { name: "Classification", nameZh: "归类处理", score: 0.88 },
        { name: "Exception review", nameZh: "异常复核", score: 0.58 },
        { name: "Compliance judgment", nameZh: "合规判断", score: 0.34 },
        { name: "Regulator communication", nameZh: "监管沟通", score: 0.19 }
      ]
    },
    {
      socCode: "29-1141",
      title: "Registered Nurses",
      titleZh: "注册护士",
      majorGroup: "Healthcare Practitioners and Technical",
      label: "stable",
      summary: "AI supports records and triage, but bedside care and accountability remain human.",
      summaryZh: "AI 可辅助病历和分诊，但床旁护理与责任承担仍由人类完成。",
      regions: {
        National: { airs: 86, replacement: 0.16, augmentation: 0.38, hiring: 0.21, historical: 0.28, postings: 9380 },
        West: { airs: 85, replacement: 0.17, augmentation: 0.40, hiring: 0.23, historical: 0.28, postings: 1880 },
        Midwest: { airs: 87, replacement: 0.15, augmentation: 0.34, hiring: 0.20, historical: 0.28, postings: 2110 },
        South: { airs: 86, replacement: 0.16, augmentation: 0.37, hiring: 0.21, historical: 0.28, postings: 3660 },
        Northeast: { airs: 85, replacement: 0.17, augmentation: 0.39, hiring: 0.22, historical: 0.28, postings: 1730 }
      },
      monthlyAirs: [90, 90, 89, 89, 89, 88, 88, 87, 87, 87, 86, 86],
      evidence: [
        "AI is used for charting, reminders, and early risk alerts.",
        "Bedside care and patient trust still require direct human presence.",
        "Hiring volume is driven more by care demand than AI substitution."
      ],
      evidenceZh: [
        "AI 主要用于记录、提醒和早期风险预警。",
        "床旁护理和患者信任仍需要直接的人类在场。",
        "招聘规模更多由医疗需求驱动，而不是 AI 替代。"
      ],
      tasks: [
        { name: "Documentation", nameZh: "病历文书", score: 0.56 },
        { name: "Bedside care", nameZh: "床旁护理", score: 0.12 },
        { name: "Patient communication", nameZh: "患者沟通", score: 0.18 },
        { name: "Order execution", nameZh: "医嘱执行", score: 0.21 }
      ]
    },
    {
      socCode: "23-1011",
      title: "Lawyers",
      titleZh: "律师",
      majorGroup: "Legal",
      label: "light",
      summary: "Search, summarization, and drafting accelerate, but representation and liability stay human.",
      summaryZh: "检索、摘要和起草被加速，但代理和责任承担仍掌握在人手里。",
      regions: {
        National: { airs: 71, replacement: 0.34, augmentation: 0.73, hiring: 0.39, historical: 0.49, postings: 2740 },
        West: { airs: 69, replacement: 0.36, augmentation: 0.74, hiring: 0.41, historical: 0.49, postings: 630 },
        Midwest: { airs: 73, replacement: 0.32, augmentation: 0.70, hiring: 0.36, historical: 0.49, postings: 520 },
        South: { airs: 72, replacement: 0.33, augmentation: 0.72, hiring: 0.38, historical: 0.49, postings: 810 },
        Northeast: { airs: 70, replacement: 0.35, augmentation: 0.74, hiring: 0.40, historical: 0.49, postings: 780 }
      },
      monthlyAirs: [78, 77, 77, 76, 75, 75, 74, 73, 73, 72, 71, 71],
      evidence: [
        "Search and summarization cycles are shorter, but final responsibility is unchanged.",
        "Firms increasingly hire for legal expertise plus AI governance fluency.",
        "Demand skews toward analysis and client communication."
      ],
      evidenceZh: [
        "检索和摘要周期显著缩短，但最终责任并未转移。",
        "律所越来越倾向招聘同时具备法律专业能力和 AI 治理能力的人。",
        "需求正在向分析与客户沟通倾斜。"
      ],
      tasks: [
        { name: "Case search", nameZh: "案例检索", score: 0.79 },
        { name: "Drafting", nameZh: "文件起草", score: 0.72 },
        { name: "Court representation", nameZh: "法庭代理", score: 0.14 },
        { name: "Client strategy", nameZh: "客户策略沟通", score: 0.26 }
      ]
    }
  ]
};
