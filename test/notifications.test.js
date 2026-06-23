import test from "node:test";
import assert from "node:assert/strict";
import { buildDigestMarkdown, notificationStatus } from "../lib/notifications.js";

test("builds a readable Chinese digest message", () => {
  const markdown = buildDigestMarkdown([{
    titleZh: "测试新闻",
    summaryZh: "这是一条摘要。",
    whyItMatters: "它值得关注。",
    topic: "人工智能",
    source: "Test Source",
    url: "https://example.com"
  }], new Date("2026-06-23T00:00:00+08:00"));

  assert.match(markdown, /测试新闻/);
  assert.match(markdown, /为什么重要/);
  assert.match(markdown, /https:\/\/example.com/);
});

test("reports notification configuration without exposing secrets", () => {
  const status = notificationStatus();
  assert.equal(typeof status.enabled, "boolean");
  assert.deepEqual(Object.keys(status).sort(), ["enabled", "serverChan", "weCom"].sort());
});
