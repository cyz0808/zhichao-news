import { config, translationProvider } from "../config.js";

function fallbackSummary(article) {
  const raw = article.description || article.title;
  const summary = raw.length > 220 ? `${raw.slice(0, 217)}…` : raw;
  return {
    ...article,
    titleZh: article.title,
    summaryZh: summary,
    detailedAnalysisZh: summary,
    keyPointsZh: [],
    backgroundZh: "",
    impactZh: "",
    whyItMatters: `这条信息与${article.topic}相关，来源为 ${article.source}，值得结合后续报道持续观察。`,
    translated: false,
    aiEnriched: false,
    translationError: article.translationError || null
  };
}

function translationInput(articles) {
  return articles.map(article => ({
    id: String(article.id),
    title: article.title,
    source: article.source,
    topic: article.topic,
    contentBasis: article.contentBasis,
    sourceText: (article.sourceText || article.description || "").slice(0, 18000)
  }));
}

function systemPrompt() {
  return [
    "你是严谨的中文科技新闻编辑，为不阅读英文的读者制作中文深度解读。",
    "基于输入的英文正文或公开摘要，输出自然准确的简体中文。",
    "不要逐字复刻或大段翻译原文；应忠实地重新组织为完整中文解读。",
    "不得增加输入中没有的数字、引语、判断或事实。",
    "如果 contentBasis 是 summary，必须在 detailedAnalysisZh 开头说明“以下解读基于公开摘要”。",
    "detailedAnalysisZh 为 500 至 900 个汉字，覆盖事件经过、关键事实和上下文。",
    "keyPointsZh 返回 3 至 5 条关键要点；backgroundZh 解释背景；impactZh 解释可能影响。",
    "必须保留输入 id，并按输入顺序返回全部条目。"
  ].join("");
}

function expectedShape() {
  return {
    articles: [{
      id: "输入id",
      titleZh: "中文标题",
      summaryZh: "100字内中文摘要",
      detailedAnalysisZh: "500至900字中文深度解读",
      keyPointsZh: ["要点一", "要点二", "要点三"],
      backgroundZh: "背景说明",
      impactZh: "影响分析",
      whyItMatters: "为什么重要"
    }]
  };
}

function validateResult(value) {
  if (!value || !Array.isArray(value.articles)) throw new Error("AI 返回格式不正确");
  return value.articles;
}

async function requestDeepSeek(articles) {
  const response = await fetch(`${process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.deepseekModel,
      messages: [
        {
          role: "system",
          content: `${systemPrompt()}只输出 JSON，不要输出 Markdown。格式：${JSON.stringify(expectedShape())}`
        },
        { role: "user", content: JSON.stringify(translationInput(articles)) }
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: 8000,
      stream: false
    })
  });
  if (!response.ok) throw new Error(`DeepSeek API ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  return validateResult(JSON.parse(payload.choices?.[0]?.message?.content || "{}"));
}

async function requestOpenAI(articles) {
  const response = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel,
      store: false,
      max_output_tokens: 8000,
      input: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: JSON.stringify(translationInput(articles)) }
      ],
      text: { format: { type: "json_object" } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const text = payload.output_text || payload.output?.flatMap(item => item.content || [])
    .find(content => content.type === "output_text")?.text;
  return validateResult(JSON.parse(text || "{}"));
}

async function translateChunk(articles, provider) {
  return provider === "deepseek" ? requestDeepSeek(articles) : requestOpenAI(articles);
}

export async function enrichDigest(articles, { fallback = true } = {}) {
  const provider = translationProvider();
  if (!provider) return articles.map(fallbackSummary);
  const output = [];

  try {
    for (let index = 0; index < articles.length; index += 3) {
      const chunk = articles.slice(index, index + 3);
      const translated = await translateChunk(chunk, provider);
      const byId = new Map(translated.map(item => [String(item.id), item]));
      output.push(...chunk.map(article => {
        const result = byId.get(String(article.id));
        return result
          ? { ...article, ...result, translated: true, aiEnriched: true, translationProvider: provider }
          : fallbackSummary(article);
      }));
    }
    return output;
  } catch (error) {
    if (!fallback) throw error;
    console.warn(`中文深度解读失败，保留原文摘要：${error.message}`);
    return articles.map(article => fallbackSummary({ ...article, translationError: error.message }));
  }
}

export async function testTranslationConnection() {
  const provider = translationProvider();
  if (!provider) return { ok: false, configured: false, error: "尚未配置翻译密钥" };
  try {
    const result = await enrichDigest([{
      id: "health_check",
      title: "AI data centers are changing electricity demand",
      description: "Data centers are increasing electricity demand and changing grid planning.",
      sourceText: "Data centers are increasing electricity demand. Utilities are changing grid planning to account for concentrated loads and new infrastructure requirements.",
      contentBasis: "summary",
      source: "Health Check",
      topic: "电力能源"
    }], { fallback: false });
    if (!result[0]?.translated) throw new Error("翻译服务回退到了原文");
    return { ok: true, configured: true, provider, model: provider === "deepseek" ? config.deepseekModel : config.openaiModel };
  } catch (error) {
    const code = error?.cause?.code;
    const message = code === "EACCES" || code === "EPERM"
      ? "当前启动进程被系统禁止访问外网，请使用 start-news.cmd 正常启动"
      : error.message;
    return { ok: false, configured: true, provider, error: message };
  }
}
