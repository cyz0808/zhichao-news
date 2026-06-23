function escapeMarkdown(text = "") {
  return text.replace(/\r?\n/g, " ").trim();
}

export function buildDigestMarkdown(digest, date = new Date()) {
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);

  const lines = [
    `# 知潮每日简报 · ${dateText}`,
    "",
    `今天为你精选 ${digest.length} 条经济、科学、AI、电力与算力新闻。`,
    ""
  ];

  digest.forEach((article, index) => {
    const title = escapeMarkdown(article.titleZh || article.title);
    const summary = escapeMarkdown(article.summaryZh || article.description);
    const analysis = escapeMarkdown(article.detailedAnalysisZh || "");
    const why = escapeMarkdown(article.whyItMatters || "");
    const points = Array.isArray(article.keyPointsZh) ? article.keyPointsZh : [];
    lines.push(`## ${index + 1}. ${title}`);
    lines.push(`**${article.topic} · ${article.source}**`);
    lines.push("");
    lines.push(summary);
    if (analysis && analysis !== summary) lines.push(analysis.slice(0, 900));
    points.slice(0, 4).forEach(point => lines.push(`- ${escapeMarkdown(point)}`));
    if (why) lines.push(`> 为什么重要：${why}`);
    lines.push("完整中文解读请在知潮网站中查看。");
    if (article.url) lines.push(`[阅读原文](${article.url})`);
    lines.push("");
  });

  return lines.join("\n").slice(0, 28000);
}

async function sendServerChan(title, markdown) {
  const sendKey = process.env.SERVERCHAN_SENDKEY;
  if (!sendKey) return { provider: "serverchan", configured: false, skipped: true };

  const body = new URLSearchParams({ title, desp: markdown });
  const response = await fetch(`https://sctapi.ftqq.com/${encodeURIComponent(sendKey)}.send`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || (result.code !== 0 && result.data?.errno !== 0)) {
    throw new Error(result.message || result.data?.error || `HTTP ${response.status}`);
  }
  return { provider: "serverchan", configured: true, sent: true };
}

async function sendWeCom(title, markdown) {
  const webhook = process.env.WECOM_WEBHOOK_URL;
  if (!webhook) return { provider: "wecom", configured: false, skipped: true };

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: { content: `# ${title}\n${markdown}`.slice(0, 4000) }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.errcode !== 0) {
    throw new Error(result.errmsg || `HTTP ${response.status}`);
  }
  return { provider: "wecom", configured: true, sent: true };
}

export function notificationStatus() {
  return {
    serverChan: Boolean(process.env.SERVERCHAN_SENDKEY),
    weCom: Boolean(process.env.WECOM_WEBHOOK_URL),
    enabled: Boolean(process.env.SERVERCHAN_SENDKEY || process.env.WECOM_WEBHOOK_URL)
  };
}

export async function sendDigestNotifications(digest) {
  if (!digest.length) return { sent: false, results: [] };
  const title = `知潮今日简报：${digest.length} 条值得关注的变化`;
  const markdown = buildDigestMarkdown(digest);
  const providers = [
    ["Server酱", () => sendServerChan(title, markdown)],
    ["企业微信", () => sendWeCom(title, markdown)]
  ];
  const results = [];

  for (const [name, send] of providers) {
    try {
      results.push(await send());
    } catch (error) {
      results.push({ provider: name, configured: true, sent: false, error: error.message });
    }
  }
  return { sent: results.some(result => result.sent), results };
}

export async function testNotificationConnection() {
  if (!notificationStatus().enabled) return { ok: false, configured: false, error: "尚未配置微信推送" };
  try {
    // This is an actual one-line test push because Server酱 has no separate credential-check endpoint.
    const results = [];
    if (process.env.SERVERCHAN_SENDKEY) {
      results.push(await sendServerChan("知潮连接测试", "微信推送连接成功。之后每日简报会通过此通道发送。"));
    }
    if (process.env.WECOM_WEBHOOK_URL) {
      results.push(await sendWeCom("知潮连接测试", "微信推送连接成功。"));
    }
    return { ok: results.some(result => result.sent), configured: true, results };
  } catch (error) {
    const code = error?.cause?.code;
    const message = code === "EACCES" || code === "EPERM"
      ? "当前启动进程被系统禁止访问外网，请使用 start-news.cmd 正常启动"
      : error.message;
    return { ok: false, configured: true, error: message };
  }
}
