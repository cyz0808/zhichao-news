import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, feeds, translationProvider } from "./config.js";
import { readStore, writeStore } from "./lib/store.js";
import { runPipeline, collectNews, generateDigest } from "./lib/pipeline.js";
import { notificationStatus, sendDigestNotifications, testNotificationConnection } from "./lib/notifications.js";
import { testTranslationConnection } from "./lib/ai.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function publicArticle(article) {
  const { sourceText, ...safe } = article;
  return safe;
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1e6) throw new Error("Request too large");
  }
  return body ? JSON.parse(body) : {};
}

async function api(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/status") {
    const store = await readStore();
    return json(response, 200, {
      ok: true,
      version: "0.4.1",
      articleCount: store.articles.length,
      digestCount: store.digest.length,
      detailedDigestCount: store.digest.filter(article => article.detailedAnalysisZh).length,
      fullArticleCount: store.digest.filter(article => article.contentBasis === "article").length,
      aiEnabled: Boolean(translationProvider()),
      translationEnabled: Boolean(translationProvider()),
      translationProvider: translationProvider(),
      notifications: notificationStatus(),
      feeds: feeds.length,
      ...store.meta
    });
  }
  if (request.method === "GET" && url.pathname === "/api/digest") {
    const store = await readStore();
    return json(response, 200, { digest: store.digest.map(publicArticle), saved: store.saved || [], meta: store.meta });
  }
  if (request.method === "GET" && url.pathname === "/api/articles") {
    const store = await readStore();
    const topic = url.searchParams.get("topic");
    const articles = topic ? store.articles.filter(item => item.topic === topic) : store.articles;
    return json(response, 200, { articles: articles.slice(0, 100).map(publicArticle) });
  }
  if (request.method === "GET" && url.pathname === "/api/feeds") {
    return json(response, 200, { feeds: feeds.map(({ name, url, defaultTopic }) => ({ name, url, defaultTopic })) });
  }
  if (request.method === "POST" && url.pathname === "/api/refresh") {
    try {
      return json(response, 200, await runPipeline({ notify: false }));
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/push") {
    try {
      const store = await readStore();
      if (!notificationStatus().enabled) {
        return json(response, 400, { error: "尚未配置微信推送密钥或企业微信 Webhook" });
      }
      return json(response, 200, await sendDigestNotifications(store.digest));
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/integrations/test") {
    const translation = await testTranslationConnection();
    const wechat = await testNotificationConnection();
    return json(response, 200, { translation, wechat });
  }
  if (request.method === "POST" && url.pathname === "/api/collect") {
    try {
      return json(response, 200, await collectNews());
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/generate") {
    try {
      return json(response, 200, await generateDigest());
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/saved") {
    const { id, saved } = await readJsonBody(request);
    const store = await readStore();
    const ids = new Set(store.saved || []);
    saved ? ids.add(id) : ids.delete(id);
    store.saved = [...ids];
    await writeStore(store);
    return json(response, 200, { saved: store.saved });
  }
  return false;
}

async function serveStatic(response, pathname) {
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const file = path.resolve(root, relative);
  if (!file.startsWith(root) || relative.startsWith("data/") || relative.startsWith("lib/")) return false;
  try {
    if (!(await stat(file)).isFile()) return false;
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(await readFile(file));
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      if (await api(request, response, url) !== false) return;
      return json(response, 404, { error: "Not found" });
    }
    if (!(await serveStatic(response, url.pathname))) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  } catch (error) {
    json(response, 500, { error: error.message });
  }
});

function schedule() {
  let lastRunDate = "";
  setInterval(async () => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timezone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
    });
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(part => [part.type, part.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    if (Number(parts.hour) === config.digestHour && lastRunDate !== date) {
      lastRunDate = date;
      try { await runPipeline({ notify: true }); } catch (error) { console.error("Scheduled pipeline failed:", error); }
    }
  }, 60_000).unref();
}

if (process.argv.includes("--collect-once")) {
  runPipeline({ notify: process.argv.includes("--notify") }).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }).catch(error => {
    console.error(error);
    process.exit(1);
  });
} else {
  server.listen(config.port, "127.0.0.1", () => {
    console.log(`知潮已启动：http://127.0.0.1:${config.port}`);
    const provider = translationProvider();
    const model = provider === "deepseek" ? config.deepseekModel : config.openaiModel;
    console.log(`AI 摘要：${provider ? `开启 (${provider}/${model})` : "未开启，使用规则摘要"}`);
    console.log(`微信推送：${notificationStatus().enabled ? "已配置" : "未配置"}`);
  });
  schedule();
}
