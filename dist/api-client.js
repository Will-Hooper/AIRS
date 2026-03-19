import { translateOccupationTitle, withTranslatedOccupationTitle } from "./occupation-translation.js";
const DATA_URL = "./backend/data/airs_data.json";
let datasetPromise = null;
export class AirsDataUnavailableError extends Error {
    status;
    cause;
    constructor(message, options = {}) {
        super(message);
        this.name = "AirsDataUnavailableError";
        this.status = options.status ?? 503;
        this.cause = options.cause;
    }
}
function updatedAtFromDataset(dataset) {
    const lastDate = Array.isArray(dataset?.dates) && dataset.dates.length
        ? dataset.dates[dataset.dates.length - 1]
        : null;
    return lastDate ? `${lastDate}T12:00:00-05:00` : new Date().toISOString();
}
function uniqueStrings(values = []) {
    return [...new Set((values || []).filter(Boolean).map((value) => String(value)))];
}
const SEARCH_CJK_RE = /[\u3400-\u9fff]/;
const MAJOR_GROUP_ZH = new Map([
    ["Management", "管理"],
    ["Business and Financial Operations", "商业与财务运营"],
    ["Computer and Mathematical", "计算机与数学"],
    ["Architecture and Engineering", "建筑与工程"],
    ["Life, Physical, and Social Science", "生命、物理与社会科学"],
    ["Community and Social Service", "社区与社会服务"],
    ["Legal", "法律"],
    ["Educational Instruction and Library", "教育与图书馆"],
    ["Arts, Design, Entertainment, Sports, and Media", "艺术、设计、娱乐、体育与媒体"],
    ["Healthcare Practitioners and Technical", "医疗专业与技术"],
    ["Healthcare Support", "医疗支持"],
    ["Protective Service", "保护服务"],
    ["Food Preparation and Serving Related", "餐饮制备与服务"],
    ["Building and Grounds Cleaning and Maintenance", "楼宇与场地清洁维护"],
    ["Personal Care and Service", "个人护理与服务"],
    ["Sales and Related", "销售及相关"],
    ["Office and Administrative Support", "办公室与行政支持"],
    ["Farming, Fishing, and Forestry", "农业、渔业与林业"],
    ["Construction and Extraction", "建筑与采掘"],
    ["Installation, Maintenance, and Repair", "安装、维护与维修"],
    ["Production", "生产制造"],
    ["Transportation and Material Moving", "运输与物料搬运"],
    ["Military Specific Occupations", "军事特定职业"],
    ["Other", "其他"]
]);
const SEARCH_ALIAS_RULES = [
    {
        pattern: /computer programmers?|software developers?|web developers?|computer systems analysts?|software quality assurance analysts?|database administrators?|database architects?/i,
        aliases: ["程序员", "软件工程师", "开发", "开发工程师", "前端", "后端", "算法", "系统分析师", "数据库管理员", "数据库架构师", "码农", "IT"]
    },
    {
        pattern: /computer science teachers?|data scientists?|information technology management|information technology student trainee|information technology|computer clerk/i,
        aliases: ["信息技术", "计算机", "数据分析", "数据岗", "IT", "计算机教师", "数据科学"]
    },
    {
        pattern: /management and program analysis|program management|project management specialists?|business operations specialists?|computer and information systems managers?|marketing managers?/i,
        aliases: ["产品经理", "项目经理", "项目管理", "项目专员", "业务分析", "产品运营"]
    },
    {
        pattern: /support services administration|logistics management|transportation operations|facility operations services|social insurance administration/i,
        aliases: ["运营", "运营经理"]
    },
    {
        pattern: /interior design|visual information|illustrat/i,
        aliases: ["设计师", "平面设计", "视觉设计", "插画师", "美工", "UI设计"]
    },
    {
        pattern: /public affairs|government information|writing and editing|visual information|audiovisual production/i,
        aliases: ["编辑", "文案", "记者", "媒体", "传媒", "公关", "新媒体", "媒体运营", "传播", "策划"]
    },
    {
        pattern: /music specialist|theater specialist|museum specialist|general arts and information|audiovisual production/i,
        aliases: ["艺术", "文娱", "演艺", "影视", "影视表演", "展馆", "博物馆", "艺术家", "演员", "表演", "导演", "编导", "摄影师", "剪辑师", "策展"]
    },
    {
        pattern: /sports specialist|recreation specialist|recreation aid/i,
        aliases: ["体育", "康乐", "文体", "教练", "球探", "体能"]
    },
    {
        pattern: /contact representative/i,
        aliases: ["客服", "客户服务", "客诉", "呼叫中心"]
    },
    {
        pattern: /administrative officer|mail and file|secretary|passport and visa examining|office automation|financial clerical|administration and office support/i,
        aliases: ["行政", "文员", "前台", "内勤", "办公室", "行政助理"]
    },
    {
        pattern: /account|budget|finance|financial|purchasing|procurement|property disposal|contracting|accounting/i,
        aliases: ["财务", "会计", "会计师", "出纳", "审计", "审计师", "预算", "采购", "招采", "合同管理", "商务", "记账", "薪酬"]
    },
    {
        pattern: /legal|attorney|paralegal|law/i,
        aliases: ["法务", "律师", "法律", "法务专员", "合规法务"]
    },
    {
        pattern: /teacher|education|training|instructional|professor|postsecondary/i,
        aliases: ["老师", "教师", "讲师", "教授", "培训", "教培", "教育", "教务", "高校教师"]
    },
    {
        pattern: /library|librarian/i,
        aliases: ["图书馆", "图书馆员", "图书管理员", "图书馆技术员"]
    },
    {
        pattern: /registered nurse|licensed practical nurse|nursing assistant|nurse practitioner|nurse/i,
        aliases: ["护士", "注册护士", "执业护士", "护理", "护工"]
    },
    {
        pattern: /physicians?|surgeons?|general internal medicine physicians?|pediatricians?|radiologists?|pathologists?|psychiatrists?|obstetricians? and gynecologists?/i,
        aliases: ["医生", "医师", "临床医生", "大夫", "门诊医生", "主治医生"]
    },
    {
        pattern: /medical|health|physician|therap|pharmacist|dental|radiologic|laboratory|optometrist|audiology/i,
        aliases: ["药师", "医技", "医疗", "康复", "治疗师", "临床", "口腔", "检验", "医师助理", "放射技师", "药剂师"]
    },
    {
        pattern: /mechanic|maintenance|repair|electrician|machining|equipment mechanic|industrial equipment|technician/i,
        aliases: ["机械", "维修", "机修", "技工", "设备", "机电", "电工", "维护"]
    },
    {
        pattern: /security guard|security administration|police|investigation|border patrol|fire|ranger|protective/i,
        aliases: ["保安", "安保", "警察", "警务", "执法", "调查", "消防", "巡逻"]
    },
    {
        pattern: /materials handler|packing|logistics management|inventory management|store working|warehousing|shipping|receiving|stockers?|order fillers?|logisticians?|storage and distribution/i,
        aliases: ["物流", "仓储", "运输", "配送", "分拣", "搬运", "调度", "物料"]
    },
    {
        pattern: /shipping, receiving, and inventory clerks|stockers and order fillers|logisticians|transportation, storage, and distribution managers|laborers and freight, stock, and material movers, hand/i,
        aliases: ["仓库管理员", "仓管", "仓储管理", "库管", "理货", "收发货", "库存管理员", "物流师"]
    },
    {
        pattern: /stockers and order fillers|merchandise displayers?|shipping, receiving, and inventory clerks/i,
        aliases: ["理货员", "补货员", "上货员", "货架补货", "陈列补货"]
    },
    {
        pattern: /plumbers?|pipefitters?|steamfitters?/i,
        aliases: ["水管工", "管道工", "水暖工", "管道安装工", "管工"]
    },
    {
        pattern: /chemistry|physics|meteorology|biology|social science|economics|geography|history|intelligence|foreign affairs|industrial hygiene/i,
        aliases: ["研究员", "科研", "科学家", "理科", "社会科学", "经济学", "情报", "外交", "研究岗"]
    },
    {
        pattern: /artist|designer|illustrat|media|communication|writer|editor|journalist|public relations|reporter|performer|entertain/i,
        aliases: ["艺术家", "设计师", "插画师", "编辑", "记者", "媒体人", "传播", "公关", "主持人", "主播", "演员", "表演", "演艺", "影视", "影视表演", "新媒体", "内容运营"]
    },
    {
        pattern: /developer|programmer|systems analyst|web developer|software|database administrator|database architect/i,
        aliases: ["程序员", "软件工程师", "开发工程师", "系统分析师", "数据库管理员", "数据库架构师", "IT工程师"]
    },
    {
        pattern: /engineer|architect/i,
        aliases: ["工程师", "建筑师", "技术工程"]
    },
    {
        pattern: /accountant|auditor|bookkeeping|payroll|tax/i,
        aliases: ["会计", "会计师", "审计", "审计师", "税务", "记账", "薪酬"]
    },
    {
        pattern: /architect|planner|draft/i,
        aliases: ["建筑师", "规划师", "制图员", "城市规划", "设计院"]
    },
    {
        pattern: /teacher|professor|instructor/i,
        aliases: ["教师", "老师", "教授", "讲师", "高校教师"]
    },
    {
        pattern: /librarian|library technician/i,
        aliases: ["图书馆员", "图书管理员", "图书馆技术员"]
    },
    {
        pattern: /registered nurse|nurse practitioner|physician assistant/i,
        aliases: ["注册护士", "护士", "执业护士", "医师助理"]
    },
    {
        pattern: /construction|carpentry|masonry|plumbing|welding|rigging|drill rig/i,
        aliases: ["施工", "建筑", "土建", "焊工", "水电", "木工", "装修", "工地"]
    },
    {
        pattern: /food|cooking|waiter|bartending|meatcutting/i,
        aliases: ["餐饮", "厨师", "服务员", "酒吧", "后厨", "餐服"]
    },
    {
        pattern: /student trainee|trainee/i,
        aliases: ["实习生", "见习岗", "校招"]
    }
];
const QUERY_EXPANSION_RULES = [
    { pattern: /程序员|软件工程师|开发|前端|后端|码农|算法|it/i, terms: ["computer programmer", "software developer", "web developer", "systems analyst", "database administrator", "计算机"] },
    { pattern: /产品经理|项目经理|项目管理/i, terms: ["program management", "management and program analysis", "information technology management", "项目管理", "项目分析"] },
    { pattern: /运营/i, terms: ["support services administration", "transportation operations", "facility operations services", "logistics management", "运营"] },
    { pattern: /设计师|平面设计|视觉设计|插画|美工|ui/i, terms: ["design", "visual information", "illustrating", "interior design", "设计"] },
    { pattern: /编辑|文案|记者/i, terms: ["writing and editing", "public affairs", "government information", "editing", "媒体"] },
    { pattern: /公关|新媒体|媒体运营|传媒/i, terms: ["public affairs", "government information", "audiovisual production", "visual information", "media"] },
    { pattern: /客服|客户服务|前台|内勤/i, terms: ["contact representative", "office", "administrative", "passport and visa examining", "联络代表"] },
    { pattern: /法务|律师|法律/i, terms: ["legal", "attorney", "paralegal", "法律"] },
    { pattern: /护士|护理/i, terms: ["nurse", "nursing assistant", "practical nurse", "护理"] },
    { pattern: /医生|医师|临床医生|大夫/i, terms: ["physician", "doctor", "surgeon", "internal medicine", "pediatrician", "radiologist", "pathologist", "psychiatrist", "medical doctor"] },
    { pattern: /医疗|医技|药师|检验|康复|治疗师/i, terms: ["medical", "health", "pharmacist", "laboratory", "therapist", "rehabilitation", "医疗"] },
    { pattern: /保安|安保|警察|消防|执法/i, terms: ["security guard", "security administration", "police", "protective", "fire"] },
    { pattern: /物流|仓储|配送|分拣|搬运/i, terms: ["logistics", "materials handler", "packing", "inventory management", "warehouse", "shipping", "receiving", "stockers", "order fillers"] },
    { pattern: /仓库管理员|仓管|库管|库存管理员/i, terms: ["shipping receiving inventory clerk", "inventory clerk", "warehouse", "stockers and order fillers", "storage and distribution manager", "logistician", "inventory manager"] },
    { pattern: /理货员|补货员|上货员/i, terms: ["stockers and order fillers", "stockers", "order fillers", "inventory clerk", "merchandise"] },
    { pattern: /水管工|管道工|水暖工|管道安装工/i, terms: ["plumbers", "pipefitters", "steamfitters", "plumbing", "plumber"] },
    { pattern: /老师|教师|讲师|培训/i, terms: ["education", "instructional", "training", "teacher", "professor"] },
    { pattern: /图书馆员|图书管理员|图书馆技术员/i, terms: ["librarian", "library technician", "library"] },
    { pattern: /采购|招采|合同/i, terms: ["purchasing", "procurement", "contracting", "property disposal"] },
    { pattern: /科研|研究员|科学家/i, terms: ["science", "research", "physics", "chemistry", "biology", "economics", "psychology"] },
    { pattern: /艺术家|演员|表演|演艺|影视|影视表演|导演|编导|摄影师|剪辑师|主持人|主播/i, terms: ["actors", "performer", "performing arts", "entertainment", "media", "communication", "producer", "director", "audiovisual"] },
    { pattern: /工程师/i, terms: ["engineer", "engineering", "systems analyst"] },
    { pattern: /建筑师/i, terms: ["architect", "architecture", "naval architect", "landscape architect"] },
    { pattern: /规划师/i, terms: ["planner", "planning", "urban planner"] },
    { pattern: /制图员/i, terms: ["drafter", "drafting"] },
    { pattern: /会计师|会计|记账/i, terms: ["accountant", "bookkeeping", "auditor"] },
    { pattern: /审计师|审计/i, terms: ["auditor", "audit", "accountant"] },
    { pattern: /税务/i, terms: ["tax", "revenue", "accountant"] },
    { pattern: /护士|护理/i, terms: ["registered nurse", "nurse practitioner", "nursing assistant", "licensed practical nurse", "nurse"] }
];
const QUERY_INTENT_RULES = [
    {
        pattern: /程序员|软件工程师|开发|前端|后端|码农|算法/i,
        match: /computer programmers?|software developers?|web developers?|computer systems analysts?|database administrators?|database architects?|software quality assurance analysts?|data scientists?/i,
        boost: 110
    },
    {
        pattern: /产品经理|项目经理|项目管理/i,
        match: /project management specialists?|management analysts?|business operations specialists?|computer and information systems managers?|marketing managers?/i,
        boost: 145
    },
    {
        pattern: /艺术家|演员|表演|演艺|影视|影视表演/i,
        match: /artists?|actors?|performers?|entertainers?|producers? and directors?|art directors?/i,
        boost: 155
    },
    {
        pattern: /导演|编导/i,
        match: /producers? and directors?|art directors?|camera operators?|editors?|media and communication workers?/i,
        boost: 105
    },
    {
        pattern: /建筑师/i,
        match: /architects?|landscape architects?|naval architects?/i,
        boost: 120
    },
    {
        pattern: /会计师|会计|审计|审计师/i,
        match: /accountants? and auditors?|bookkeeping.*clerks?|tax examiners?|financial examiners?/i,
        boost: 120
    },
    {
        pattern: /护士|护理/i,
        match: /registered nurses?|licensed practical.*nurses?|nurse practitioners?|nursing assistants?/i,
        boost: 120
    },
    {
        pattern: /医生|医师|临床医生|大夫/i,
        match: /physicians?|surgeons?|general internal medicine physicians?|pediatricians?|radiologists?|pathologists?|psychiatrists?|obstetricians? and gynecologists?/i,
        boost: 190
    },
    {
        pattern: /药剂师|药师/i,
        match: /pharmacists?|pharmacy technicians?/i,
        boost: 150
    },
    {
        pattern: /图书馆员|图书管理员|图书馆技术员/i,
        match: /librarians?|library technicians?|library assistants?|media collections specialists?/i,
        boost: 120
    },
    {
        pattern: /仓库管理员|仓管|仓储/i,
        match: /shipping.*clerks?|stockers? and order fillers?|storage and distribution managers?|logisticians?/i,
        boost: 185
    },
    {
        pattern: /理货员|补货员|上货员/i,
        match: /stockers? and order fillers?|shipping.*inventory clerks?/i,
        boost: 195
    },
    {
        pattern: /水管工|管道工|水暖工|管道安装工/i,
        match: /plumbers?|pipefitters?|steamfitters?/i,
        boost: 210
    },
    {
        pattern: /保安|安保/i,
        match: /security guards?|transportation security screeners?|security and fire alarm systems installers?/i,
        boost: 140
    }
];
function buildDataUrlCandidates() {
    const candidates = new Set();
    const addCandidate = (value) => {
        if (!value)
            return;
        try {
            candidates.add(new URL(value, window.location.href).href);
        }
        catch {
            // Ignore malformed candidate URLs and continue with the remaining fallbacks.
        }
    };
    addCandidate(DATA_URL);
    const pathname = window.location.pathname || "/";
    const directoryPath = pathname.endsWith("/")
        ? pathname
        : pathname.slice(0, pathname.lastIndexOf("/") + 1) || "/";
    addCandidate(`${directoryPath}backend/data/airs_data.json`);
    if (window.location.hostname.endsWith(".github.io")) {
        const firstSegment = pathname.split("/").filter(Boolean)[0];
        if (firstSegment) {
            addCandidate(`/${firstSegment}/backend/data/airs_data.json`);
        }
    }
    addCandidate("/backend/data/airs_data.json");
    return [...candidates];
}
function normalizeSearchText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\u3400-\u9fff\s/-]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function compactSearchText(value) {
    return normalizeSearchText(value).replace(/[\s/-]+/g, "");
}
function tokenizeSearchText(value) {
    return normalizeSearchText(value).split(" ").filter(Boolean);
}
function containsCjk(value) {
    return SEARCH_CJK_RE.test(String(value || ""));
}
function makeBigrams(value) {
    const text = compactSearchText(value);
    if (!text)
        return [];
    if (text.length === 1)
        return [text];
    const grams = [];
    for (let index = 0; index < text.length - 1; index += 1) {
        grams.push(text.slice(index, index + 2));
    }
    return grams;
}
function diceCoefficient(a, b) {
    const left = makeBigrams(a);
    const right = makeBigrams(b);
    if (!left.length || !right.length)
        return 0;
    const counts = new Map();
    left.forEach((gram) => counts.set(gram, (counts.get(gram) || 0) + 1));
    let overlap = 0;
    right.forEach((gram) => {
        const count = counts.get(gram) || 0;
        if (count > 0) {
            overlap += 1;
            counts.set(gram, count - 1);
        }
    });
    return (2 * overlap) / (left.length + right.length);
}
function tokenOverlapScore(query, candidate) {
    const queryTokens = tokenizeSearchText(query);
    const candidateTokens = tokenizeSearchText(candidate);
    if (!queryTokens.length || !candidateTokens.length)
        return 0;
    let matches = 0;
    queryTokens.forEach((queryToken) => {
        if (candidateTokens.some((candidateToken) => candidateToken.includes(queryToken) || queryToken.includes(candidateToken))) {
            matches += 1;
        }
    });
    return matches / queryTokens.length;
}
function scoreSearchValue(query, candidate) {
    const queryNormalized = normalizeSearchText(query);
    const candidateNormalized = normalizeSearchText(candidate);
    const queryCompact = compactSearchText(query);
    const candidateCompact = compactSearchText(candidate);
    if (!queryCompact || !candidateCompact)
        return 0;
    let score = 0;
    if (queryCompact === candidateCompact) {
        score = Math.max(score, 240);
    }
    else if (candidateCompact.startsWith(queryCompact)) {
        score = Math.max(score, Math.max(170, 215 - Math.max(0, candidateCompact.length - queryCompact.length) * 3));
    }
    else if (candidateCompact.includes(queryCompact)) {
        score = Math.max(score, Math.max(130, 190 - Math.max(0, candidateCompact.length - queryCompact.length) * 2));
    }
    else if (queryCompact.length >= 3 && queryCompact.includes(candidateCompact)) {
        score = Math.max(score, Math.max(90, 150 - Math.max(0, queryCompact.length - candidateCompact.length) * 4));
    }
    const overlap = tokenOverlapScore(queryNormalized, candidateNormalized);
    if (overlap > 0) {
        score = Math.max(score, overlap * 110);
    }
    const similarity = diceCoefficient(queryCompact, candidateCompact);
    if (similarity > 0) {
        const multiplier = containsCjk(query) || containsCjk(candidate) ? 115 : 92;
        score = Math.max(score, similarity * multiplier);
    }
    return score;
}
function buildSearchAliases(row) {
    const aliases = new Set([
        row.socCode,
        row.title,
        row.titleZh,
        translateOccupationTitle(row.title)
    ]);
    const corpus = [row.title, row.titleZh]
        .filter(Boolean)
        .join(" ");
    SEARCH_ALIAS_RULES.forEach((rule) => {
        if (rule.pattern.test(corpus)) {
            rule.aliases.forEach((alias) => aliases.add(alias));
        }
    });
    return uniqueStrings([
        ...aliases,
        ...[...aliases].map((value) => normalizeSearchText(value)),
        ...[...aliases].map((value) => compactSearchText(value))
    ]);
}
function expandSearchQueries(query) {
    const values = [query];
    QUERY_EXPANSION_RULES.forEach((rule) => {
        if (rule.pattern.test(String(query || ""))) {
            values.push(...rule.terms);
        }
    });
    return uniqueStrings([
        ...values,
        ...values.map((value) => normalizeSearchText(value)),
        ...values.map((value) => compactSearchText(value))
    ]);
}
function rankRowsByQuery(rows, query) {
    const queryCandidates = expandSearchQueries(query);
    const queryCompact = compactSearchText(query);
    const scored = rows
        .map((row) => ({
        row,
        score: (() => {
            const aliasScore = Math.max(...queryCandidates.flatMap((queryCandidate) => {
                const weight = compactSearchText(queryCandidate) === queryCompact ? 1 : 0.72;
                return (row.searchIndex || []).map((candidate) => scoreSearchValue(queryCandidate, candidate) * weight);
            }), 0);
            const titleZhScore = scoreSearchValue(query, row.titleZh);
            const titleEnScore = scoreSearchValue(query, row.title);
            const exactBoost = compactSearchText(row.titleZh) === queryCompact
                ? 120
                : compactSearchText(row.titleZh).includes(queryCompact) && queryCompact
                    ? 55
                    : 0;
            const intentBoost = QUERY_INTENT_RULES.reduce((best, rule) => {
                if (!rule.pattern.test(String(query || "")))
                    return best;
                return rule.match.test(`${row.title} ${row.titleZh}`) ? Math.max(best, rule.boost) : best;
            }, 0);
            const supportRolePenalty = !/助手|助理|assistant|helper|aide/i.test(String(query || "")) &&
                /助手|助理|assistants?|helpers?|aides?/i.test(`${row.title} ${row.titleZh}`)
                ? 85
                : 0;
            const warehousePenalty = /仓库管理员|仓管|库管|库存管理员/i.test(String(query || "")) &&
                /laborers and freight, stock, and material movers, hand/i.test(row.title)
                ? 95
                : 0;
            return Math.max(0, Math.max(aliasScore, titleZhScore + exactBoost + intentBoost, titleEnScore + intentBoost) - supportRolePenalty - warehousePenalty);
        })()
    }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score ||
        Number(right.row.airs || 0) - Number(left.row.airs || 0) ||
        Number(right.row.postings || 0) - Number(left.row.postings || 0) ||
        String(left.row.title).localeCompare(String(right.row.title)));
    if (!scored.length)
        return [];
    const bestScore = scored[0].score;
    const minScore = bestScore >= 180
        ? Math.max(110, bestScore * 0.5)
        : bestScore >= 120
            ? Math.max(72, bestScore * 0.5)
            : bestScore >= 70
                ? Math.max(36, bestScore * 0.5)
                : 18;
    const filtered = scored.filter((entry) => entry.score >= minScore).slice(0, 24);
    const fallback = filtered.length ? filtered : scored.slice(0, 8);
    return fallback.map((entry) => entry.row);
}
function resolveDate(requestedDate, dates) {
    if (requestedDate && dates.includes(requestedDate))
        return requestedDate;
    return dates.length ? dates[dates.length - 1] : "";
}
function resolveRegion(requestedRegion, regions) {
    if (requestedRegion && regions.includes(requestedRegion))
        return requestedRegion;
    return regions.includes("National") ? "National" : (regions[0] || "National");
}
function getDatasetMeta(dataset) {
    const dates = uniqueStrings(dataset?.dates);
    const regions = uniqueStrings(dataset?.regions?.length
        ? dataset.regions
        : dataset?.occupations?.flatMap((occupation) => Object.keys(occupation.regions || {})));
    const labels = uniqueStrings(dataset?.labels?.length
        ? dataset.labels
        : dataset?.occupations?.map((occupation) => occupation.label));
    const groups = uniqueStrings(dataset?.groups?.length
        ? dataset.groups
        : dataset?.occupations?.map((occupation) => occupation.majorGroup)).sort();
    return { dates, regions, labels, groups };
}
function regionMetricsFor(occupation, region) {
    const regions = occupation.regions;
    if (regions?.[region])
        return regions[region];
    if (regions?.National)
        return regions.National;
    const firstRegion = Object.values(regions || {})[0];
    return firstRegion || {};
}
function percentLabel(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
}
function chineseDemandPhrase(summary = "") {
    if (summary.includes("still active"))
        return "仍然偏活跃";
    if (summary.includes("already weak"))
        return "已经明显走弱";
    return "处于中性区间";
}
function chineseGroupLabel(group = "") {
    return MAJOR_GROUP_ZH.get(group) || "其他";
}
function chineseLabelText(label = "") {
    const labelMap = new Map([
        ["stable", "影响较小"],
        ["light", "轻度影响"],
        ["augmenting", "以 AI 辅助为主"],
        ["restructuring", "招聘结构调整中"],
        ["high_risk", "替代风险高"]
    ]);
    return labelMap.get(label) || "待观察";
}
function chineseDriverLabel(row) {
    const pairs = [
        ["replacement", "替代压力"],
        ["augmentation", "岗位改写"],
        ["hiring", "招聘兑现"],
        ["historical", "历史累计渗透"]
    ];
    return pairs
        .map(([key, label]) => ({ key, label, value: Number(row?.[key] || 0) }))
        .sort((a, b) => b.value - a.value)[0]?.label || "综合影响";
}
function extractDemandPercentile(evidence = []) {
    const demandLine = (evidence || []).find((line) => String(line).includes("percentile"));
    const match = demandLine ? String(demandLine).match(/(\d+)%/) : null;
    return match ? `${match[1]}%` : "—";
}
function chineseImpactSentence(row) {
    if (row.label === "high_risk")
        return "岗位数量和岗位结构都已经出现更明显的 AI 压缩迹象";
    if (row.label === "restructuring")
        return "岗位仍在存在，但招聘要求和岗位结构已经开始被 AI 重写";
    if (row.label === "augmenting")
        return "岗位还在持续招聘，但工作方式更像是向 AI 协同执行转移";
    if (row.label === "light")
        return "AI 已进入这类岗位，但当前对招聘规模的压缩还相对有限";
    return "当前招聘总体仍相对稳定，AI 对岗位数量的直接压缩尚不明显";
}
function buildChineseSummary(row, englishSummary) {
    return `${row.titleZh || row.title} 属于${chineseGroupLabel(row.majorGroup)}，当前 AIRS 为 ${Number(row.airs || 0).toFixed(1)}，处于“${chineseLabelText(row.label)}”区间。整体看，${chineseImpactSentence(row)}；相对同类岗位，招聘${chineseDemandPhrase(englishSummary)}。`;
}
function buildChineseEvidence(row, englishEvidence) {
    return [
        `职业对应：${row.titleZh || row.title}（SOC ${row.socCode}；英文名称：${row.title}），归属于${chineseGroupLabel(row.majorGroup)}。`,
        `当前招聘信号：全国相关招聘数约 ${Number(row.postings || 0)}；在同类岗位中的招聘热度分位约为 ${extractDemandPercentile(englishEvidence)}。`,
        `影响拆解：替代压力 ${percentLabel(row.replacement)}，岗位改写 ${percentLabel(row.augmentation)}，招聘兑现 ${percentLabel(row.hiring)}，历史累计渗透 ${percentLabel(row.historical)}。`,
        `一句话判断：${chineseImpactSentence(row)}。`
    ];
}
function mapJsonOccupation(occupation, region) {
    const metrics = regionMetricsFor(occupation, region);
    const englishSummary = occupation.summary || "";
    const englishEvidence = occupation.evidence || [];
    const translatedRow = withTranslatedOccupationTitle({
        socCode: occupation.socCode,
        title: occupation.title,
        titleZh: occupation.titleZh,
        majorGroup: occupation.majorGroup,
        label: occupation.label,
        summary: englishSummary,
        summaryZh: occupation.summaryZh || englishSummary,
        monthlyAirs: occupation.monthlyAirs || [],
        evidence: englishEvidence,
        evidenceZh: occupation.evidenceZh || englishEvidence,
        tasks: occupation.tasks || [],
        regionMetrics: occupation.regions || {},
        ...metrics
    });
    const summaryZh = buildChineseSummary(translatedRow, englishSummary);
    const evidenceZh = buildChineseEvidence(translatedRow, englishEvidence);
    return {
        ...translatedRow,
        summaryZh: summaryZh || occupation.summaryZh || englishSummary,
        evidenceZh: evidenceZh.length ? evidenceZh : (occupation.evidenceZh || englishEvidence),
        searchIndex: buildSearchAliases(translatedRow)
    };
}
function applyClientFilters(rows, params = {}) {
    const baseRows = rows.slice();
    let nextRows = baseRows;
    if (params.majorGroup && params.majorGroup !== "all") {
        nextRows = nextRows.filter((row) => row.majorGroup === params.majorGroup);
    }
    if (params.label && params.label !== "all") {
        nextRows = nextRows.filter((row) => row.label === params.label);
    }
    if (params.q) {
        const rankedWithinFilter = rankRowsByQuery(nextRows, params.q);
        nextRows = rankedWithinFilter.length ? rankedWithinFilter : rankRowsByQuery(baseRows, params.q);
    }
    return nextRows;
}
function summarizeRows(rows, updatedAt) {
    return {
        mode: "json",
        source: "json",
        updatedAt,
        date: "",
        avgAirs: rows.reduce((sum, row) => sum + Number(row.airs || 0), 0) / (rows.length || 1),
        highRiskCount: rows.filter((row) => row.label === "high_risk").length,
        occupationCount: rows.length
    };
}
async function loadDataset() {
    if (!datasetPromise) {
        datasetPromise = (async () => {
            let lastError = null;
            for (const url of buildDataUrlCandidates()) {
                try {
                    const response = await fetch(url, { cache: "no-cache" });
                    if (!response.ok) {
                        lastError = new AirsDataUnavailableError(`json request failed: ${response.status}`, { status: response.status });
                        continue;
                    }
                    const payload = await response.json();
                    if (!payload || !Array.isArray(payload.occupations)) {
                        lastError = new AirsDataUnavailableError("invalid json dataset");
                        continue;
                    }
                    return payload;
                }
                catch (error) {
                    lastError = error;
                }
            }
            throw lastError instanceof AirsDataUnavailableError
                ? lastError
                : new AirsDataUnavailableError("json request failed", { cause: lastError });
        })()
            .catch((error) => {
            datasetPromise = null;
            if (error instanceof AirsDataUnavailableError)
                throw error;
            throw new AirsDataUnavailableError("json request failed", { cause: error });
        });
    }
    return datasetPromise;
}
function buildRows(dataset, params = {}) {
    const meta = getDatasetMeta(dataset);
    const region = resolveRegion(params.region, meta.regions);
    return applyClientFilters(dataset.occupations.map((occupation) => mapJsonOccupation(occupation, region)), params);
}
export async function getSummary(params = {}) {
    const dataset = await loadDataset();
    const updatedAt = updatedAtFromDataset(dataset);
    const rows = buildRows(dataset, params);
    const meta = getDatasetMeta(dataset);
    return {
        ...summarizeRows(rows, updatedAt),
        date: resolveDate(params.date, meta.dates)
    };
}
export async function getOccupations(params = {}) {
    const dataset = await loadDataset();
    const meta = getDatasetMeta(dataset);
    const date = resolveDate(params.date, meta.dates);
    const region = resolveRegion(params.region, meta.regions);
    const occupations = applyClientFilters(dataset.occupations.map((occupation) => mapJsonOccupation(occupation, region)), params);
    return {
        mode: "json",
        source: "json",
        updatedAt: updatedAtFromDataset(dataset),
        date,
        dates: meta.dates,
        regions: meta.regions,
        labels: meta.labels,
        groups: meta.groups,
        occupations
    };
}
export async function getOccupationDetail(socCode, params = {}) {
    const dataset = await loadDataset();
    const meta = getDatasetMeta(dataset);
    const date = resolveDate(params.date, meta.dates);
    const region = resolveRegion(params.region, meta.regions);
    const matched = dataset.occupations.find((occupation) => occupation.socCode === socCode) || dataset.occupations[0];
    return {
        mode: "json",
        source: "json",
        updatedAt: updatedAtFromDataset(dataset),
        date,
        dates: meta.dates,
        regions: meta.regions,
        occupation: mapJsonOccupation(matched, region)
    };
}
