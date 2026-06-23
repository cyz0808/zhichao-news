import test from "node:test";
import assert from "node:assert/strict";
import { classify, deduplicate, selectDigest, similarity } from "../lib/ranking.js";

test("classifies AI and energy stories", () => {
  assert.equal(classify({ title: "New AI language model", description: "machine learning", defaultTopic: "前沿科学" }), "人工智能");
  assert.equal(classify({ title: "Battery storage helps the power grid", description: "renewable energy", defaultTopic: "前沿科学" }), "电力能源");
});

test("detects similar titles", () => {
  assert.ok(similarity("New AI chip launches for data centers", "New AI chip for data center launches") > 0.5);
});

test("deduplicates same URL", () => {
  const result = deduplicate([
    { title: "First", url: "https://example.com/a", publishedAt: "2026-06-22T00:00:00Z", source: "A" },
    { title: "Second", url: "https://example.com/a", publishedAt: "2026-06-21T00:00:00Z", source: "B" }
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].relatedSources, ["B"]);
});

test("digest selection respects requested size", () => {
  const articles = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    topic: ["人工智能", "算力芯片", "电力能源", "全球经济", "前沿科学"][index % 5],
    source: `Source ${index % 7}`,
    score: 100 - index
  }));
  assert.equal(selectDigest(articles, 15).length, 15);
});

test("digest limits dominance by one source", () => {
  const articles = Array.from({ length: 10 }, (_, index) => ({
    id: String(index),
    topic: "人工智能",
    source: index < 7 ? "Dominant" : `Source ${index}`,
    score: 100 - index
  }));
  const digest = selectDigest(articles, 6);
  assert.ok(digest.filter(item => item.source === "Dominant").length <= 3);
});
