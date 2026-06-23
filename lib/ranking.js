import { config } from "../config.js";

const topicKeywords = {
  "人工智能": ["artificial intelligence", " ai ", "machine learning", "language model", "llm", "agent", "deep learning", "neural"],
  "算力芯片": ["chip", "semiconductor", "gpu", "compute", "data center", "datacenter", "processor", "memory", "hbm", "nvidia", "amd", "intel"],
  "电力能源": ["electricity", "power grid", "energy", "battery", "nuclear", "solar", "wind", "storage", "fusion", "renewable"],
  "全球经济": ["economy", "economic", "inflation", "interest rate", "central bank", "trade", "gdp", "market", "manufacturing", "investment"],
  "前沿科学": ["science", "research", "quantum", "space", "climate", "biology", "material", "physics", "chemistry", "telescope"]
};

const importanceTerms = [
  "breakthrough", "first", "record", "launch", "policy", "regulation", "billion",
  "trillion", "approval", "ban", "discovery", "investment", "grid", "infrastructure"
];

function normalize(text = "") {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}

function containsKeyword(text, keyword) {
  return text.includes(` ${normalize(keyword).trim()} `);
}

export function classify(article) {
  const text = normalize(`${article.title} ${article.description}`);
  let best = { topic: article.defaultTopic || "前沿科学", count: 0 };
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const count = keywords.reduce((sum, word) => sum + (containsKeyword(text, word) ? 1 : 0), 0);
    if (count > best.count) best = { topic, count };
  }
  return best.topic;
}

function relevanceCount(article) {
  const text = normalize(`${article.title} ${article.description}`);
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
  const text = normalize(`${article.title} ${article.description}`);
  const importance = Math.min(1, importanceTerms.filter(term => containsKeyword(text, term)).length / 3);
  const interest = config.interests[topic] || 1;
  const multiSource = Math.min(0.15, (article.relatedSources?.length || 0) * 0.05);
  const score = (article.authority * 0.3 + freshness * 0.28 + importance * 0.22 + multiSource + 0.2) * interest;
  return Number((score * 100).toFixed(1));
}

export function prepareArticles(articles) {
  return deduplicate(articles)
    .filter(isRelevant)
    .map(article => ({ ...article, topic: classify(article) }))
    .map(article => ({ ...article, score: scoreArticle(article) }))
    .filter(article => {
      const age = (Date.now() - new Date(article.publishedAt).valueOf()) / 36e5;
      return age <= config.maxAgeHours;
    })
    .sort((a, b) => b.score - a.score);
}

export function selectDigest(articles, size = config.digestSize) {
  const quotas = { "人工智能": 4, "算力芯片": 3, "电力能源": 3, "全球经济": 3, "前沿科学": 3 };
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
