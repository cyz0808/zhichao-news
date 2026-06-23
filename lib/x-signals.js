import { config } from "../config.js";
import { stableId } from "./rss.js";

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function stripHandle(value = "") {
  return value.replace(/^@/, "").trim();
}

function accountQuery(accounts) {
  return `(${accounts.map(account => `from:${stripHandle(account)}`).join(" OR ")}) -is:retweet`;
}

function keywordQuery(keyword) {
  return `(${keyword}) -is:retweet`;
}

function publicMetricsScore(metrics = {}) {
  const reposts = Number(metrics.retweet_count || 0);
  const quotes = Number(metrics.quote_count || 0);
  const replies = Number(metrics.reply_count || 0);
  const likes = Number(metrics.like_count || 0);
  return Math.min(24, reposts * 0.9 + quotes * 1.4 + replies * 0.35 + likes * 0.08);
}

function authorScore(author = {}, trustedAccounts = []) {
  const username = String(author.username || "").toLowerCase();
  const trusted = trustedAccounts.map(item => stripHandle(item).toLowerCase()).includes(username);
  const verifiedType = String(author.verified_type || "").toLowerCase();
  const followers = Number(author.public_metrics?.followers_count || 0);

  let score = trusted ? 46 : 0;
  if (author.verified) score += 12;
  if (["business", "government"].includes(verifiedType)) score += 14;
  if (followers >= 1000000) score += 12;
  else if (followers >= 100000) score += 8;
  else if (followers >= 20000) score += 4;
  return Math.min(76, score);
}

export function assessXCredibility(tweet, author, trustedAccounts = config.xSignals.accounts) {
  const score = Math.min(100, authorScore(author, trustedAccounts) + publicMetricsScore(tweet.public_metrics));
  const isTrustedAccount = trustedAccounts
    .map(item => stripHandle(item).toLowerCase())
    .includes(String(author?.username || "").toLowerCase());
  return {
    score: Number(score.toFixed(1)),
    isTrustedAccount,
    verified: Boolean(author?.verified),
    verifiedType: author?.verified_type || "",
    followers: Number(author?.public_metrics?.followers_count || 0),
    engagement: tweet.public_metrics || {},
    passed: score >= config.xSignals.minCredibility
  };
}

function normalizeUrl(tweetId, author) {
  const username = author?.username || "i";
  return `https://x.com/${username}/status/${tweetId}`;
}

function tweetToArticle(tweet, author, queryLabel) {
  const text = String(tweet.text || "").replace(/\s+/g, " ").trim();
  const credibility = assessXCredibility(tweet, author);
  return {
    id: stableId(`x:${tweet.id}`),
    title: `X线索：${text.slice(0, 110)}`,
    description: text,
    url: normalizeUrl(tweet.id, author),
    source: `X · @${author?.username || "unknown"}`,
    authority: Math.max(0.55, Math.min(0.88, credibility.score / 100)),
    defaultTopic: "人工智能",
    publishedAt: tweet.created_at || new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    isSocialSignal: true,
    contentBasis: "social",
    xSignal: {
      query: queryLabel,
      tweetId: tweet.id,
      authorName: author?.name || "",
      authorUsername: author?.username || "",
      credibility
    }
  };
}

async function fetchRecentSearch(query, label) {
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", String(Math.max(10, Math.min(100, config.xSignals.maxResults))));
  url.searchParams.set("sort_order", "recency");
  url.searchParams.set("tweet.fields", "created_at,public_metrics,lang,entities,referenced_tweets");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "verified,verified_type,public_metrics,name,username");

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${config.xSignals.bearerToken}`,
      "User-Agent": "ZhichaoNewsDesk/0.5 (+personal news reader)"
    }
  });
  if (!response.ok) throw new Error(`X API ${response.status}: ${await response.text()}`);

  const payload = await response.json();
  const users = new Map((payload.includes?.users || []).map(user => [user.id, user]));
  return (payload.data || [])
    .map(tweet => tweetToArticle(tweet, users.get(tweet.author_id), label))
    .filter(article => article.xSignal.credibility.passed);
}

export async function fetchXSignals() {
  if (!config.xSignals.enabled || !config.xSignals.bearerToken) {
    return { enabled: config.xSignals.enabled, configured: false, count: 0, articles: [], results: [] };
  }

  const queries = [
    ...chunk(config.xSignals.accounts, 8).map(accounts => ({
      label: `accounts:${accounts.join(",")}`,
      query: accountQuery(accounts)
    })),
    ...config.xSignals.keywords.map(keyword => ({
      label: `keyword:${keyword}`,
      query: keywordQuery(keyword)
    }))
  ];

  const settled = await Promise.allSettled(queries.map(item => fetchRecentSearch(item.query, item.label)));
  const articles = [];
  const results = settled.map((result, index) => {
    const query = queries[index];
    if (result.status === "fulfilled") {
      articles.push(...result.value);
      return { name: query.label, ok: true, count: result.value.length };
    }
    return { name: query.label, ok: false, error: result.reason?.message || "Unknown error" };
  });

  return {
    enabled: true,
    configured: true,
    count: articles.length,
    articles,
    results
  };
}
