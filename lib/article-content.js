const entities = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“"
};

function decodeHtml(text = "") {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => entities[name] ?? all);
}

function cleanText(text = "") {
  return decodeHtml(text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonLd(html) {
  const candidates = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(decodeHtml(match[1]));
      const queue = Array.isArray(value) ? value : [value];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
        if (typeof item.articleBody === "string" && item.articleBody.length > 300) {
          candidates.push(cleanText(item.articleBody));
        }
      }
    } catch {
      // Ignore malformed publisher metadata.
    }
  }
  return candidates.sort((a, b) => b.length - a.length)[0] || "";
}

function extractParagraphs(html) {
  const articleMatch = html.match(/<article(?:\s[^>]*)?>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main(?:\s[^>]*)?>([\s\S]*?)<\/main>/i);
  const scope = articleMatch?.[1] || mainMatch?.[1] || html;
  const paragraphs = [...scope.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
    .map(match => cleanText(match[1]))
    .filter(text => text.length >= 45)
    .filter(text => !/cookie|privacy policy|newsletter|sign up|subscribe|advertisement/i.test(text));
  return paragraphs.join("\n\n");
}

export function extractArticleText(html) {
  const structured = extractJsonLd(html);
  const paragraphs = extractParagraphs(html);
  const text = structured.length >= paragraphs.length * 0.6 ? structured : paragraphs;
  return text.slice(0, 18000);
}

export async function fetchArticleContent(article) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(article.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ZhichaoNewsDesk/0.4; personal reader)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("html")) throw new Error("页面不是 HTML");
    const text = extractArticleText(await response.text());
    if (text.length < 500) throw new Error("未提取到足够正文，可能存在付费墙或访问限制");
    return {
      ...article,
      sourceText: text,
      sourceTextLength: text.length,
      contentBasis: "article",
      contentFetchedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ...article,
      sourceText: article.description || "",
      sourceTextLength: (article.description || "").length,
      contentBasis: "summary",
      contentFetchError: error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchDigestContent(articles, concurrency = 4) {
  const output = new Array(articles.length);
  let cursor = 0;
  async function worker() {
    while (cursor < articles.length) {
      const index = cursor++;
      output[index] = await fetchArticleContent(articles[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, articles.length) }, worker));
  return output;
}
