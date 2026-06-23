import { feeds, config } from "../config.js";
import { parseFeed } from "./rss.js";
import { prepareArticles } from "./ranking.js";
import { curateDigest } from "./editorial.js";
import { enrichDigest } from "./ai.js";
import { sendDigestNotifications } from "./notifications.js";
import { fetchDigestContent } from "./article-content.js";
import { fetchXSignals } from "./x-signals.js";
import { readStore, writeStore } from "./store.js";

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "ZhichaoNewsDesk/0.2 (+personal news reader)" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseFeed(await response.text(), feed);
  } finally {
    clearTimeout(timer);
  }
}

export async function collectNews() {
  const store = await readStore();
  const [settled, xSignals] = await Promise.all([
    Promise.allSettled(feeds.map(fetchFeed)),
    fetchXSignals()
  ]);
  const incoming = [];
  const feedResults = settled.map((result, index) => {
    const feed = feeds[index];
    if (result.status === "fulfilled") {
      incoming.push(...result.value);
      return { name: feed.name, ok: true, count: result.value.length };
    }
    return { name: feed.name, ok: false, error: result.reason?.message || "Unknown error" };
  });
  incoming.push(...xSignals.articles);

  const merged = new Map(store.articles.map(article => [article.id, article]));
  incoming.forEach(article => merged.set(article.id, article));
  const articles = prepareArticles([...merged.values()]).slice(0, 500);

  store.articles = articles;
  store.meta = {
    ...store.meta,
    lastCollectedAt: new Date().toISOString(),
    feedResults,
    xSignalResults: xSignals.results,
    xSignalCount: xSignals.count,
    xSignalsEnabled: xSignals.enabled,
    xSignalsConfigured: xSignals.configured,
    mode: incoming.length ? "live" : store.meta.mode
  };
  await writeStore(store);
  return { collected: incoming.length, retained: articles.length, feedResults, xSignals };
}

export async function generateDigest() {
  const store = await readStore();
  const prepared = prepareArticles(store.articles);
  const selected = await curateDigest(prepared, config.digestSize);
  if (!selected.length) return { count: 0, digest: [] };
  const withContent = await fetchDigestContent(selected);
  store.digest = await enrichDigest(withContent);
  const translatedCount = store.digest.filter(article => article.translated).length;
  const translationErrors = [...new Set(store.digest.map(article => article.translationError).filter(Boolean))];
  const editorialMode = store.digest[0]?.editorialReview?.mode || "unknown";
  store.meta = {
    ...store.meta,
    lastDigestAt: new Date().toISOString(),
    editorialMode,
    editorialAiEnabled: config.editorialAi,
    editorialCandidateSize: config.editorialCandidateSize,
    translatedCount,
    translationErrors
  };
  await writeStore(store);
  return {
    count: store.digest.length,
    editorialMode,
    translatedCount,
    translationErrors,
    digest: store.digest
  };
}

export async function runPipeline({ notify = false } = {}) {
  const collection = await collectNews();
  const digest = await generateDigest();
  const notification = notify
    ? await sendDigestNotifications(digest.digest)
    : { sent: false, skipped: true, results: [] };
  return {
    collection,
    digest: {
      count: digest.count,
      translatedCount: digest.translatedCount,
      translationErrors: digest.translationErrors
    },
    notification
  };
}
