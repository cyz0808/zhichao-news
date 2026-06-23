import test from "node:test";
import assert from "node:assert/strict";
import { extractArticleText } from "../lib/article-content.js";

test("extracts articleBody from JSON-LD", () => {
  const html = `
    <html><script type="application/ld+json">
      {"@type":"NewsArticle","articleBody":"${"A detailed sentence about energy systems. ".repeat(20)}"}
    </script></html>`;
  const text = extractArticleText(html);
  assert.ok(text.length > 500);
  assert.match(text, /energy systems/);
});

test("extracts readable article paragraphs and ignores short navigation", () => {
  const html = `<main>
    <p>Home</p>
    <p>${"Researchers reported a meaningful scientific result with supporting context. ".repeat(8)}</p>
    <p>${"The finding could influence future engineering and policy decisions. ".repeat(8)}</p>
  </main>`;
  const text = extractArticleText(html);
  assert.ok(text.length > 500);
  assert.doesNotMatch(text, /^Home/);
});
