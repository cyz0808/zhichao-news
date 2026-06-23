import { mkdir, rm, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../lib/pipeline.js";
import { readStore } from "../lib/store.js";
import { feeds, translationProvider } from "../config.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");
const apiDir = path.join(dist, "api");
const publicFiles = ["index.html", "styles.css", "app.js"];

function publicArticle(article) {
  const { sourceText, translationError, ...safe } = article;
  return safe;
}

async function build() {
  const useExisting = process.env.PAGES_USE_EXISTING_DATA === "1";
  if (!useExisting && !translationProvider()) {
    throw new Error("Missing DEEPSEEK_API_KEY or OPENAI_API_KEY. Configure it as a GitHub Actions secret.");
  }

  const result = useExisting
    ? { digest: { count: 0, translatedCount: 0, translationErrors: [] }, notification: { skipped: true } }
    : await runPipeline({
      notify: process.env.SEND_NOTIFICATION !== "0" &&
        Boolean(process.env.SERVERCHAN_SENDKEY || process.env.WECOM_WEBHOOK_URL)
    });
  const store = await readStore();
  if (useExisting) {
    result.digest.count = store.digest.length;
    result.digest.translatedCount = store.digest.filter(article => article.translated).length;
  }
  if (!result.digest.count) throw new Error("No news digest was generated.");
  if (!useExisting && !result.digest.translatedCount) {
    throw new Error(`No articles were translated: ${result.digest.translationErrors?.join("; ") || "unknown error"}`);
  }

  await rm(dist, { recursive: true, force: true });
  await mkdir(apiDir, { recursive: true });
  await Promise.all(publicFiles.map(file => copyFile(path.join(root, file), path.join(dist, file))));
  await writeFile(path.join(dist, ".nojekyll"), "", "utf8");
  await writeFile(path.join(apiDir, "digest.json"), JSON.stringify({
    digest: store.digest.map(publicArticle),
    saved: [],
    meta: store.meta
  }), "utf8");
  await writeFile(path.join(apiDir, "status.json"), JSON.stringify({
    ok: true,
    version: "0.5.0-pages",
    staticMode: true,
    articleCount: store.articles.length,
    digestCount: store.digest.length,
    detailedDigestCount: store.digest.filter(article => article.detailedAnalysisZh).length,
    fullArticleCount: store.digest.filter(article => article.contentBasis === "article").length,
    translationEnabled: Boolean(translationProvider()) || store.digest.some(article => article.translated),
    translationProvider: translationProvider(),
    notifications: {
      enabled: Boolean(process.env.SERVERCHAN_SENDKEY || process.env.WECOM_WEBHOOK_URL),
      serverChan: Boolean(process.env.SERVERCHAN_SENDKEY),
      weCom: Boolean(process.env.WECOM_WEBHOOK_URL)
    },
    feeds: feeds.length,
    ...store.meta
  }), "utf8");
  await writeFile(path.join(dist, "404.html"), await import("node:fs/promises").then(fs => fs.readFile(path.join(root, "index.html"), "utf8")), "utf8");
  console.log(JSON.stringify({ built: true, dist, ...result.digest, notification: result.notification }, null, 2));
}

build().catch(error => {
  console.error(error);
  process.exit(1);
});
