import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

try {
  const envText = readFileSync(fileURLToPath(new URL("./.env", import.meta.url)), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#") || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // .env is optional.
}

export const config = {
  port: Number(process.env.PORT || 8765),
  digestSize: Number(process.env.DIGEST_SIZE || 15),
  digestHour: Number(process.env.DIGEST_HOUR || 8),
  timezone: process.env.TIMEZONE || "Asia/Shanghai",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.5",
  deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  maxAgeHours: Number(process.env.MAX_AGE_HOURS || 72),
  editorialAi: process.env.EDITORIAL_AI !== "0",
  editorialCandidateSize: Number(process.env.EDITORIAL_CANDIDATE_SIZE || 36),
  minDigestScore: Number(process.env.MIN_DIGEST_SCORE || 52),
  xSignals: {
    enabled: process.env.X_SIGNALS_ENABLED !== "0",
    bearerToken: process.env.X_BEARER_TOKEN || "",
    maxResults: Number(process.env.X_MAX_RESULTS || 10),
    minCredibility: Number(process.env.X_MIN_CREDIBILITY || 65),
    accounts: (process.env.X_ACCOUNTS || "OpenAI,AnthropicAI,NVIDIA,AMD,Microsoft,Google,Meta,Tesla").split(",").map(item => item.trim()).filter(Boolean),
    keywords: (process.env.X_KEYWORDS || [
      "\"AI data center\" investment",
      "\"export control\" semiconductor",
      "\"power grid\" data center",
      "\"GPU\" supply chain",
      "\"central bank\" inflation",
      "\"China\" semiconductor",
      "\"nuclear\" power data center",
      "\"electricity demand\" AI"
    ].join("|")).split("|").map(item => item.trim()).filter(Boolean)
  },
  interests: {
    "人工智能": 1.35,
    "算力芯片": 1.3,
    "电力能源": 1.3,
    "全球经济": 1.2,
    "前沿科学": 1.15
  }
};

export function translationProvider() {
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export const feeds = [
  {
    name: "MIT Technology Review",
    url: "https://www.technologyreview.com/feed/",
    authority: 0.9,
    defaultTopic: "前沿科学"
  },
  {
    name: "IEEE Spectrum",
    url: "https://spectrum.ieee.org/feeds/feed.rss",
    authority: 0.9,
    defaultTopic: "前沿科学"
  },
  {
    name: "Nature",
    url: "https://www.nature.com/nature.rss",
    authority: 0.98,
    defaultTopic: "前沿科学"
  },
  {
    name: "ScienceDaily",
    url: "https://www.sciencedaily.com/rss/all.xml",
    authority: 0.75,
    defaultTopic: "前沿科学"
  },
  {
    name: "NASA",
    url: "https://www.nasa.gov/feed/",
    authority: 0.95,
    defaultTopic: "前沿科学"
  },
  {
    name: "arXiv AI",
    url: "https://rss.arxiv.org/rss/cs.AI",
    authority: 0.8,
    defaultTopic: "人工智能"
  },
  {
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    authority: 0.9,
    defaultTopic: "全球经济"
  },
  {
    name: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    authority: 1,
    defaultTopic: "全球经济"
  },
  {
    name: "European Central Bank",
    url: "https://www.ecb.europa.eu/rss/press.html",
    authority: 1,
    defaultTopic: "全球经济"
  },
  {
    name: "NPR Business",
    url: "https://feeds.npr.org/1006/rss.xml",
    authority: 0.9,
    defaultTopic: "全球经济"
  },
  {
    name: "CleanTechnica",
    url: "https://cleantechnica.com/feed/",
    authority: 0.72,
    defaultTopic: "电力能源"
  },
  {
    name: "Google Research",
    url: "https://research.google/blog/rss/",
    authority: 0.88,
    defaultTopic: "人工智能"
  }
];
