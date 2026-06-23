import { config, translationProvider } from "../config.js";
import { selectDigest } from "./ranking.js";

function editorialInput(articles) {
  return articles.map(article => ({
    id: String(article.id),
    title: article.title,
    description: article.description,
    source: article.source,
    topic: article.topic,
    ruleScore: article.score,
    realitySignal: article.realitySignal,
    relatedSources: article.relatedSources || []
  }));
}

function expectedShape() {
  return {
    decisions: [{
      id: "input id",
      keep: true,
      editorialScore: 0,
      signalType: "policy | capital | infrastructure | industry | science_breakthrough | macro | soft_news",
      whyForUser: "short Chinese reason",
      rejectReason: "short Chinese reason, empty when keep is true"
    }]
  };
}

function systemPrompt() {
  return [
    "你是一名私人投资研究员兼科技新闻主编，为一位关注经济、人工智能、算力芯片、电力能源和新科技产业化的中文读者筛选每日新闻。",
    "你的任务不是翻译正文，而是判断候选新闻是否值得进入当天最重要的 15 条。",
    "优先选择已经影响现实世界的信号：政策监管、央行和财政政策、大公司资本开支、芯片和数据中心供应链、电力和能源基础设施、重大投资、产能、订单、财报、商业化进展。",
    "降低纯观点、营销稿、趣味科学、早期概念、没有数据支撑的未来猜想、离产业化很远的实验室发现。",
    "对来源为 X 的社媒线索要更加谨慎：只有官方账号、可信机构或可被现实信号支持的重大消息才可保留；未经证实的传闻、情绪化表态和单纯热帖应淘汰。",
    "如果前沿科学确实可能改变能源、材料、计算、医疗或产业路线，可以保留；否则不要因为来源权威就盲目入选。",
    "只根据输入内容判断，不得编造输入中没有的事实、数字或结论。",
    "每条候选都必须返回一个 decision，editorialScore 为 0-100，分数越高越应该入选。",
    "只输出 JSON，不要输出 Markdown。"
  ].join("\n");
}

function validateResult(value) {
  if (!value || !Array.isArray(value.decisions)) throw new Error("AI 主编返回格式不正确");
  return value.decisions.map(item => ({
    id: String(item.id),
    keep: item.keep !== false,
    editorialScore: Math.max(0, Math.min(100, Number(item.editorialScore) || 0)),
    signalType: String(item.signalType || "unknown"),
    whyForUser: String(item.whyForUser || ""),
    rejectReason: String(item.rejectReason || "")
  }));
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
          content: `${systemPrompt()}\n格式：${JSON.stringify(expectedShape())}`
        },
        { role: "user", content: JSON.stringify(editorialInput(articles)) }
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: 5000,
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
      max_output_tokens: 5000,
      input: [
        { role: "system", content: `${systemPrompt()}\n格式：${JSON.stringify(expectedShape())}` },
        { role: "user", content: JSON.stringify(editorialInput(articles)) }
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

async function requestEditorialReview(articles, provider) {
  return provider === "deepseek" ? requestDeepSeek(articles) : requestOpenAI(articles);
}

export function applyEditorialDecisions(candidates, decisions, size = config.digestSize) {
  const byId = new Map(decisions.map(decision => [String(decision.id), decision]));
  const reviewed = candidates.map(article => {
    const decision = byId.get(String(article.id)) || {
      keep: true,
      editorialScore: 50,
      signalType: article.realitySignal?.label || "unknown",
      whyForUser: "",
      rejectReason: ""
    };
    const ruleScore = Number(article.score) || 0;
    const finalScore = Number((ruleScore * 0.45 + decision.editorialScore * 0.55).toFixed(1));
    return {
      ...article,
      ruleScore,
      score: finalScore,
      editorialReview: {
        mode: "ai_editor",
        keep: decision.keep,
        editorialScore: decision.editorialScore,
        signalType: decision.signalType,
        whyForUser: decision.whyForUser,
        rejectReason: decision.rejectReason
      }
    };
  });

  const preferred = reviewed
    .filter(article => article.editorialReview.keep || article.editorialReview.editorialScore >= 70)
    .sort((a, b) => b.score - a.score);
  let selected = selectDigest(preferred, size);

  if (selected.length < size) {
    const selectedIds = new Set(selected.map(article => article.id));
    const backup = reviewed
      .filter(article => !selectedIds.has(article.id))
      .sort((a, b) => b.score - a.score)
      .map(article => ({
        ...article,
        editorialReview: {
          ...article.editorialReview,
          usedAsBackup: true
        }
      }));
    selected = selectDigest([...selected, ...backup], size);
  }

  return selected.slice(0, size).sort((a, b) => b.score - a.score);
}

export async function curateDigest(articles, size = config.digestSize) {
  const pool = articles.filter(article => (Number(article.score) || 0) >= config.minDigestScore);
  const ruleSelected = selectDigest(pool, size);
  const provider = translationProvider();
  if (!config.editorialAi || !provider) {
    return ruleSelected.map(article => ({
      ...article,
      editorialReview: { mode: "rule_only", keep: true }
    }));
  }

  const candidateCount = Math.max(size, Math.min(config.editorialCandidateSize, pool.length));
  const candidates = selectDigest(pool, candidateCount);
  try {
    const decisions = await requestEditorialReview(candidates, provider);
    return applyEditorialDecisions(candidates, decisions, size);
  } catch (error) {
    console.warn(`AI 主编复审失败，改用规则筛选：${error.message}`);
    return ruleSelected.map(article => ({
      ...article,
      editorialReview: {
        mode: "rule_fallback",
        keep: true,
        error: error.message
      }
    }));
  }
}
