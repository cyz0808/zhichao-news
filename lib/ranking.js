import { config } from "../config.js";

const TOPICS = {
  AI: "\u4eba\u5de5\u667a\u80fd",
  COMPUTE: "\u7b97\u529b\u82af\u7247",
  ENERGY: "\u7535\u529b\u80fd\u6e90",
  ECONOMY: "\u5168\u7403\u7ecf\u6d4e",
  SCIENCE: "\u524d\u6cbf\u79d1\u5b66"
};

const topicKeywords = {
  [TOPICS.AI]: [
    "artificial intelligence", " ai ", "machine learning", "language model", "llm", "agent",
    "deep learning", "neural", "model training", "inference", "openai", "anthropic", "deepseek",
    "人工智能", "大模型", "算力", "模型训练", "推理"
  ],
  [TOPICS.COMPUTE]: [
    "chip", "semiconductor", "gpu", "compute", "data center", "datacenter", "processor",
    "memory", "hbm", "nvidia", "amd", "intel", "tsmc", "asml", "samsung", "server"
    , "芯片", "半导体", "英伟达", "台积电", "光刻机", "服务器", "数据中心"
  ],
  [TOPICS.ENERGY]: [
    "electricity", "power grid", "energy", "battery", "nuclear", "solar", "wind", "storage",
    "fusion", "renewable", "transmission", "natural gas", "power plant", "grid"
    , "电力", "电网", "储能", "核电", "天然气", "发电", "输电"
  ],
  [TOPICS.ECONOMY]: [
    "economy", "economic", "inflation", "interest rate", "central bank", "trade", "gdp",
    "market", "manufacturing", "investment", "tariff", "export control", "supply chain"
    , "经济", "央行", "通胀", "利率", "关税", "出口管制", "供应链", "投资"
  ],
  [TOPICS.SCIENCE]: [
    "science", "research", "quantum", "space", "climate", "biology", "material",
    "physics", "chemistry", "telescope", "breakthrough", "discovery"
    , "科学", "量子", "材料", "突破", "发现"
  ]
};

const realitySignals = {
  policy: [
    "policy", "regulation", "regulator", "law", "bill", "executive order", "ban", "approval",
    "subsidy", "tariff", "export control", "sanction", "central bank", "federal reserve",
    "ecb", "treasury", "ministry", "government", "court", "antitrust"
    , "政策", "监管", "法案", "禁令", "批准", "补贴", "财政部", "发改委", "央行", "政府"
  ],
  capital: [
    "investment", "invest", "funding", "billion", "trillion", "million", "capex",
    "capital expenditure", "revenue", "earnings", "profit", "loss", "contract",
    "procurement", "acquisition", "merger", "ipo", "valuation"
    , "投资", "融资", "亿美元", "亿元", "万亿", "收入", "利润", "订单", "合同", "收购", "估值"
  ],
  infrastructure: [
    "data center", "datacenter", "cloud region", "power grid", "grid", "transmission",
    "substation", "power plant", "nuclear", "natural gas", "battery storage", "factory",
    "fab", "plant", "warehouse", "logistics", "infrastructure"
    , "数据中心", "电网", "输电", "变电站", "电厂", "核电", "储能", "工厂", "晶圆厂", "基础设施"
  ],
  industry: [
    "supply chain", "manufacturing", "production", "shipment", "capacity", "shortage",
    "demand", "partnership", "customers", "enterprise", "deployment", "commercial",
    "license", "market share", "competition"
    , "供应链", "制造", "产能", "出货", "短缺", "需求", "合作", "部署", "商业化", "市场份额"
  ],
  majorPlayers: [
    "nvidia", "amd", "intel", "tsmc", "asml", "samsung", "microsoft", "google",
    "alphabet", "amazon", "aws", "meta", "openai", "anthropic", "deepseek", "tesla",
    "byd", "huawei", "apple", "oracle", "broadcom", "arm", "softbank", "xai"
    , "阿里", "腾讯", "百度", "字节跳动", "华为", "比亚迪", "中芯国际", "长江存储"
  ],
  hardData: [
    "percent", "%", "forecast", "estimate", "guidance", "target", "record", "first",
    "largest", "new standard", "benchmark", "megawatt", "gigawatt", "terawatt", "mw", "gw"
    , "增长", "下降", "预计", "创纪录", "最大", "兆瓦", "吉瓦"
  ],
  scienceMilestone: [
    "breakthrough", "peer reviewed", "clinical trial", "phase 2", "phase 3", "nature",
    "science", "discovery", "demonstrated", "validated", "commercialization"
    , "同行评审", "临床试验", "验证", "商业化"
  ]
};

const softNewsTerms = [
  "could", "may", "might", "opinion", "podcast", "newsletter", "watch", "how to",
  "tips", "guide", "quiz", "rumor", "mystery", "surprising", "weird", "strange",
  "fun", "viral", "concept", "prototype", "student project", "explainer"
];

function normalize(text = "") {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, " ").trim()} `;
}

function containsKeyword(text, keyword) {
  return text.includes(` ${normalize(keyword).trim()} `);
}

function countMatches(text, terms) {
  return terms.filter(term => containsKeyword(text, term)).length;
}

function articleText(article) {
  return normalize(`${article.title || ""} ${article.description || ""}`);
}

export function classify(article) {
  const text = articleText(article);
  let best = { topic: article.defaultTopic || TOPICS.SCIENCE, count: 0 };
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const count = keywords.reduce((sum, word) => sum + (containsKeyword(text, word) ? 1 : 0), 0);
    if (count > best.count) best = { topic, count };
  }
  return best.topic;
}

function relevanceCount(article) {
  const text = articleText(article);
  return Object.values(topicKeywords)
    .flat()
    .filter(keyword => containsKeyword(text, keyword))
    .length;
}

function isRelevant(article) {
  const dedicatedSources = new Set([
    "Nature", "ScienceDaily", "arXiv AI", "Federal Reserve",
    "CleanTechnica", "MIT Technology Review", "Google Research", "NASA"
  ]);
  return relevanceCount(article) > 0 || dedicatedSources.has(article.source);
}

export function assessRealitySignal(article) {
  const text = articleText(article);
  const matches = Object.fromEntries(
    Object.entries(realitySignals).map(([name, terms]) => [name, countMatches(text, terms)])
  );
  const penalties = countMatches(text, softNewsTerms);

  const signalScore =
    matches.policy * 16 +
    matches.capital * 14 +
    matches.infrastructure * 14 +
    matches.industry * 11 +
    matches.majorPlayers * 10 +
    matches.hardData * 8 +
    matches.scienceMilestone * 9;

  const authorityBoost = Math.max(0, (article.authority || 0) - 0.82) * 16;
  const socialCredibilityBoost = article.isSocialSignal
    ? Math.min(12, Math.max(0, (article.xSignal?.credibility?.score || 0) - 60) * 0.35)
    : 0;
  const multiSourceBoost = Math.min(8, (article.relatedSources?.length || 0) * 4);
  const socialSourcePenalty = article.isSocialSignal ? 8 : 0;
  const penalty = Math.min(24, penalties * 6) + socialSourcePenalty;
  const score = Math.max(0, Math.min(100, signalScore + authorityBoost + socialCredibilityBoost + multiSourceBoost - penalty));

  let label = "soft_news";
  if (matches.policy) label = "policy";
  else if (matches.infrastructure) label = "infrastructure";
  else if (matches.capital) label = "capital";
  else if (matches.industry || matches.majorPlayers) label = "industry";
  else if (matches.scienceMilestone) label = "science_breakthrough";

  return {
    score: Number(score.toFixed(1)),
    label,
    matches,
    penalties,
    isPractical: score >= 24
  };
}

function tokens(text) {
  return new Set(normalize(text).split(" ").filter(word => word.length > 2));
}

export function similarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  const intersection = [...left].filter(token => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function deduplicate(articles) {
  const sorted = [...articles].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const unique = [];
  for (const article of sorted) {
    const duplicate = unique.find(existing =>
      article.url === existing.url || similarity(article.title, existing.title) > 0.68
    );
    if (!duplicate) unique.push(article);
    else {
      duplicate.relatedSources = [...new Set([...(duplicate.relatedSources || []), article.source])];
    }
  }
  return unique;
}

export function scoreArticle(article, now = Date.now()) {
  const topic = article.topic || classify(article);
  const ageHours = Math.max(0, (now - new Date(article.publishedAt).valueOf()) / 36e5);
  const freshness = Math.max(0, 1 - ageHours / config.maxAgeHours);
  const text = articleText(article);
  const reality = article.realitySignal || assessRealitySignal(article);
  const interest = config.interests[topic] || 1;
  const multiSource = Math.min(1, (article.relatedSources?.length || 0) / 3);
  const novelty = Math.min(1, countMatches(text, realitySignals.hardData) / 2);

  const realityScore = reality.score / 100;
  const policyCapitalIndustry = Math.min(1, (
    reality.matches.policy +
    reality.matches.capital +
    reality.matches.infrastructure +
    reality.matches.industry
  ) / 3);

  const score = (
    realityScore * 0.3 +
    Math.min(1.4, interest) / 1.4 * 0.2 +
    policyCapitalIndustry * 0.2 +
    (article.authority || 0.7) * 0.1 +
    freshness * 0.1 +
    novelty * 0.05 +
    multiSource * 0.05
  );

  return Number((score * 100).toFixed(1));
}

function isWithinAgeLimit(article) {
  const age = (Date.now() - new Date(article.publishedAt).valueOf()) / 36e5;
  return age <= config.maxAgeHours;
}

function passesRealityFilter(article) {
  if (article.isSocialSignal) {
    return article.xSignal?.credibility?.passed && article.realitySignal.score >= 34;
  }
  if (article.realitySignal.isPractical) return true;

  const trustedInstitutionalSources = new Set([
    "Federal Reserve", "European Central Bank", "Nature", "NASA", "MIT Technology Review"
  ]);
  const hasStrongAuthority = (article.authority || 0) >= 0.94 || trustedInstitutionalSources.has(article.source);
  const isCoreTopic = [TOPICS.AI, TOPICS.COMPUTE, TOPICS.ENERGY, TOPICS.ECONOMY].includes(article.topic);

  return hasStrongAuthority && isCoreTopic && article.realitySignal.score >= 14;
}

export function prepareArticles(articles) {
  return deduplicate(articles)
    .filter(isRelevant)
    .map(article => ({ ...article, topic: classify(article) }))
    .map(article => ({ ...article, realitySignal: assessRealitySignal(article) }))
    .filter(isWithinAgeLimit)
    .filter(passesRealityFilter)
    .map(article => ({ ...article, score: scoreArticle(article) }))
    .sort((a, b) => b.score - a.score);
}

export function selectDigest(articles, size = config.digestSize) {
  const quotas = {
    [TOPICS.AI]: 4,
    [TOPICS.COMPUTE]: 3,
    [TOPICS.ENERGY]: 3,
    [TOPICS.ECONOMY]: 3,
    [TOPICS.SCIENCE]: 2
  };
  const used = {};
  const sourceUsed = {};
  const selected = [];

  for (const article of articles) {
    if (selected.length >= size) break;
    const topic = article.topic;
    if ((used[topic] || 0) < (quotas[topic] || 2) && (sourceUsed[article.source] || 0) < 3) {
      selected.push(article);
      used[topic] = (used[topic] || 0) + 1;
      sourceUsed[article.source] = (sourceUsed[article.source] || 0) + 1;
    }
  }
  if (selected.length < size) {
    for (const article of articles) {
      if (selected.length >= size) break;
      if (!selected.some(item => item.id === article.id) && (sourceUsed[article.source] || 0) < 3) {
        selected.push(article);
        sourceUsed[article.source] = (sourceUsed[article.source] || 0) + 1;
      }
    }
  }
  return selected.sort((a, b) => b.score - a.score);
}
