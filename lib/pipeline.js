import { feeds, config } from "../config.js";
import { parseFeed } from "./rss.js";
import { prepareArticles, selectDigest } from "./ranking.js";
import { enrichDigest } from "./ai.js";
import { sendDigestNotifications } from "./notifications.js";
import { fetchDigestContent } from "./article-content.js";
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
  const settled = await Promise.allSettled(feeds.map(fetchFeed));
  const incoming = [];
  const feedResults = settled.map((result, index) => {
    const feed = feeds[index];
    if (result.status === "fulfilled") {
      incoming.push(...result.value);
      return { name: feed.name, ok: true, count: result.value.length };
    }
    return { name: feed.name, ok: false, error: result.reason?.message || "Unknown error" };
  });

  const merged = new Map(store.articles.map(article => [article.id, article]));
  incoming.forEach(article => merged.set(article.id, article));
  const articles = prepareArticles([...merged.values()]).slice(0, 500);

  store.articles = articles;
  store.meta = {
    ...store.meta,
    lastCollectedAt: new Date().toISOString(),
    feedResults,
    mode: incoming.length ? "live" : store.meta.mode
  };
  await writeStore(store);
  return { collected: incoming.length, retained: articles.length, feedResults };
}

export async function generateDigest() {
  const store = await readStore();
  const selected = selectDigest(prepareArticles(store.articles), config.digestSize);
  if (!selected.length) return { count: 0, digest: [] };
  const withContent = await fetchDigestContent(selected);
  store.digest = await enrichDigest(withContent);
  const translatedCount = store.digest.filter(article => article.translated).length;
  const translationErrors = [...new Set(store.digest.map(article => article.translationError).filter(Boolean))];
  store.meta = {
    ...store.meta,
    lastDigestAt: new Date().toISOString(),
    translatedCount,
    translationErrors
  };
  await writeStore(store);
  return {
    count: store.digest.length,
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
