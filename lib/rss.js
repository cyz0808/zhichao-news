const entities = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " "
};

function decode(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => entities[name] ?? all)
    .trim();
}

function stripHtml(value = "") {
  return decode(value.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " "));
}

function field(block, names) {
  for (const name of names) {
    const escaped = name.replace(":", "\\:");
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match) return decode(match[1]);
  }
  return "";
}

function atomLink(block) {
  const alternate = block.match(/<link[^>]+(?:rel=["']alternate["'][^>]+)?href=["']([^"']+)["'][^>]*>/i);
  return alternate?.[1] || "";
}

export function parseFeed(xml, feed) {
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)
  ].map(match => match[1]);

  return blocks.map(block => {
    const title = stripHtml(field(block, ["title"]));
    const description = stripHtml(field(block, ["description", "summary", "content", "content:encoded"]));
    const link = stripHtml(field(block, ["link", "guid"])) || atomLink(block);
    const rawDate = field(block, ["pubDate", "published", "updated", "dc:date"]);
    const publishedAt = new Date(rawDate);

    return {
      id: stableId(link || `${feed.name}:${title}`),
      title,
      description: description.slice(0, 1200),
      url: link,
      source: feed.name,
      authority: feed.authority,
      defaultTopic: feed.defaultTopic,
      publishedAt: Number.isNaN(publishedAt.valueOf()) ? new Date().toISOString() : publishedAt.toISOString(),
      collectedAt: new Date().toISOString()
    };
  }).filter(item => item.title && item.url);
}

export function stableId(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `n_${(hash >>> 0).toString(36)}`;
}
