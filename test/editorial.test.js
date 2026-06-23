import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../config.js";
import { applyEditorialDecisions, curateDigest } from "../lib/editorial.js";

test("editorial decisions reorder candidates by practical value", () => {
  const articles = [
    {
      id: "soft",
      title: "A fun AI concept might change the future",
      topic: "人工智能",
      source: "Source A",
      score: 80
    },
    {
      id: "infra",
      title: "Nvidia chips drive new data center power grid investment",
      topic: "算力芯片",
      source: "Source B",
      score: 72
    }
  ];

  const selected = applyEditorialDecisions(articles, [
    { id: "soft", keep: false, editorialScore: 20, signalType: "soft_news", rejectReason: "离现实影响较远" },
    { id: "infra", keep: true, editorialScore: 95, signalType: "infrastructure", whyForUser: "涉及算力和电力基础设施" }
  ], 2);

  assert.equal(selected[0].id, "infra");
  assert.equal(selected[0].editorialReview.mode, "ai_editor");
});

test("curateDigest falls back to rule-only mode when editorial AI is disabled", async () => {
  const old = config.editorialAi;
  config.editorialAi = false;
  const articles = Array.from({ length: 3 }, (_, index) => ({
    id: String(index),
    title: `AI data center investment ${index}`,
    topic: "人工智能",
    source: `Source ${index}`,
    score: 90 - index
  }));

  try {
    const selected = await curateDigest(articles, 2);
    assert.equal(selected.length, 2);
    assert.equal(selected[0].editorialReview.mode, "rule_only");
  } finally {
    config.editorialAi = old;
  }
});
