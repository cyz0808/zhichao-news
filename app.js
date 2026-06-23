const topics = [
  { name: "全球经济", color: "#d9a559" },
  { name: "人工智能", color: "#7bb597" },
  { name: "电力能源", color: "#d87551" },
  { name: "算力芯片", color: "#7d9bc4" },
  { name: "前沿科学", color: "#a387bd" }
];

const staticMode = !["127.0.0.1", "localhost", ""].includes(window.location.hostname);
const apiUrl = name => staticMode ? `./api/${name}.json` : `/api/${name}`;

let stories = [
  { id: 1, section: "lead", topic: "人工智能", source: "MIT Technology Review", time: "2 小时前", title: "下一代 AI 基础设施，正在从“堆芯片”转向系统级优化", summary: "算力竞赛进入新的阶段，芯片、网络、存储与电力的协同效率成为决定成本的关键。", why: "这意味着 AI 的竞争壁垒正从单一模型，转向完整的基础设施能力。", featured: true },
  { id: 2, section: "lead", topic: "全球经济", source: "Reuters · FT", time: "3 小时前", title: "全球制造业投资出现新的区域分化", summary: "多个经济体的制造业资本开支方向开始改变，供应链重组进入更实际的落地期。", why: "资本流向变化，往往领先于产业格局变化。"},
  { id: 3, section: "lead", topic: "电力能源", source: "IEA · Bloomberg", time: "4 小时前", title: "数据中心负荷，正改变电网规划方式", summary: "大型数据中心带来的集中式高负荷，使电力公司的规划周期和投资模型面临调整。", why: "电力可能成为未来算力扩张最现实的约束。"},
  { id: 4, section: "regular", topic: "算力芯片", source: "IEEE Spectrum", time: "5 小时前", title: "先进封装成为芯片性能增长的新主战场", summary: "当制程推进成本持续上升，封装技术正承担更多系统性能提升任务。" },
  { id: 5, section: "regular", topic: "前沿科学", source: "Nature", time: "6 小时前", title: "新型材料让工业余热回收效率进一步提高", summary: "实验结果展示了在更宽温度区间内稳定工作的热电材料。" },
  { id: 6, section: "regular", topic: "人工智能", source: "Stanford HAI", time: "7 小时前", title: "小模型在专业任务上缩小与通用大模型的差距", summary: "更高质量的数据与针对性训练，让轻量模型在部分垂直任务中表现突出。" },
  { id: 7, section: "regular", topic: "全球经济", source: "The Economist", time: "8 小时前", title: "企业开始重新计算自动化投资的回报周期", summary: "劳动力成本、融资成本和 AI 能力共同改变了自动化项目的经济账。" },
  { id: 8, section: "regular", topic: "电力能源", source: "U.S. DOE", time: "9 小时前", title: "长时储能项目从示范逐渐进入规模验证期", summary: "多条技术路线正从实验室走向真实电网环境，成本和寿命是主要观察指标。" },
  { id: 9, section: "regular", topic: "算力芯片", source: "SemiAnalysis", time: "10 小时前", title: "高速互联正在成为 AI 集群效率的隐形分水岭", summary: "在超大集群中，网络拥塞和通信延迟会显著侵蚀理论算力。" },
  { id: 10, section: "regular", topic: "前沿科学", source: "Science", time: "11 小时前", title: "自动化实验室开始改变材料发现流程", summary: "机器人实验与机器学习闭环，让候选材料的筛选速度明显提升。" },
  { id: 11, section: "regular", topic: "人工智能", source: "arXiv · 多源验证", time: "12 小时前", title: "新的推理方法尝试降低长链思考的计算成本", summary: "研究者正在寻找性能、延迟与推理成本之间更好的平衡点。" },
  { id: 12, section: "extra", topic: "全球经济", source: "World Bank", time: "13 小时前", title: "数字基础设施投资成为新兴市场政策重点", summary: "多个地区将连接能力、云服务和人才培养纳入长期发展计划。" },
  { id: 13, section: "extra", topic: "电力能源", source: "Ember", time: "14 小时前", title: "电网灵活性市场开始催生新的商业模式", summary: "可调负荷、虚拟电厂和储能正在形成更清晰的收益结构。" },
  { id: 14, section: "extra", topic: "算力芯片", source: "Nikkei Asia", time: "15 小时前", title: "存储器扩产计划反映 AI 服务器需求结构变化", summary: "高带宽内存仍然是供应链中最受关注的环节之一。" },
  { id: 15, section: "extra", topic: "前沿科学", source: "ESA", time: "16 小时前", title: "新一代观测任务将改善极端天气预测数据", summary: "更高频率的遥感数据有望缩短关键气象信号的识别时间。" }
];

let activeFilter = "全部";
let showExtras = false;
let saved = new Set(JSON.parse(localStorage.getItem("zhichao-saved") || "[]").map(String));
let liveMode = false;

const topicList = document.querySelector("#topicList");
const filterChips = document.querySelector("#filterChips");
const leadGrid = document.querySelector("#leadGrid");
const newsList = document.querySelector("#newsList");
const toast = document.querySelector("#toast");

function renderTopics() {
  topicList.innerHTML = topics.map(t => `
    <button class="topic-button" data-topic="${t.name}">
      <span class="topic-dot" style="background:${t.color}"></span>${t.name}
    </button>`).join("");
  filterChips.innerHTML = ["全部", ...topics.map(t => t.name)].map(name =>
    `<button class="${name === activeFilter ? "active" : ""}" data-filter="${name}">${name}</button>`
  ).join("");
}

function saveButton(story) {
  const id = String(story.id);
  return `<button class="save-button ${saved.has(id) ? "saved" : ""}" data-save="${id}" aria-label="收藏">${saved.has(id) ? "◆" : "◇"}</button>`;
}

function linkedTitle(story) {
  const title = `<h3>${story.title}</h3>`;
  return story.url
    ? `<a class="story-link" href="${story.url}" target="_blank" rel="noopener noreferrer">${title}</a>`
    : title;
}

function readButton(story) {
  return `<button class="read-chinese" data-read="${story.id}">阅读中文深度解读 →</button>`;
}

function renderStories() {
  const lead = stories.filter(s => s.section === "lead" && (activeFilter === "全部" || s.topic === activeFilter));
  leadGrid.innerHTML = lead.length ? lead.map(s => `
    <article class="lead-card ${s.featured ? "featured" : ""}">
      <div class="card-top"><span class="tag">${s.topic}</span>${saveButton(s)}</div>
      ${linkedTitle(s)}<p>${s.summary}</p>${readButton(s)}
      <div class="why"><strong>为什么重要</strong><span>${s.why}</span></div>
      <div class="card-meta"><span>${s.source}</span><span>${s.time}</span></div>
    </article>`).join("") : `<div class="empty-state">今日必读中暂无这一主题</div>`;

  const visible = stories.filter(s =>
    s.section !== "lead" && (showExtras || s.section !== "extra") &&
    (activeFilter === "全部" || s.topic === activeFilter)
  );
  newsList.innerHTML = visible.length ? visible.map((s, index) => `
    <article class="news-item">
      <span class="news-number">${String(index + 4).padStart(2, "0")}</span>
      <div class="news-title"><span class="tag">${s.topic}</span>${linkedTitle(s)}${readButton(s)}</div>
      <p class="news-summary">${s.summary}</p>
      <div class="news-source"><strong>${s.source}</strong><span>${s.time}</span></div>
      ${saveButton(s)}
    </article>`).join("") : `<div class="empty-state">没有符合条件的新闻</div>`;
  document.querySelector("#savedCount").textContent = saved.size;
  bindSaveButtons();
  bindReadButtons();
}

function bindReadButtons() {
  document.querySelectorAll("[data-read]").forEach(button => button.onclick = () => {
    const story = stories.find(item => String(item.id) === button.dataset.read);
    if (story) openArticle(story);
  });
}

function openArticle(story) {
  document.querySelector("#articleKicker").textContent = `${story.topic} · ${story.source} · ${story.time}`;
  document.querySelector("#articleTitle").textContent = story.title;
  document.querySelector("#articleSummary").textContent = story.summary;
  document.querySelector("#contentBasis").textContent = story.contentBasis === "article"
    ? `基于公开正文生成 · 已读取约 ${story.sourceTextLength || 0} 字符`
    : "仅基于公开摘要生成（来源正文不可访问）";
  document.querySelector("#articleAnalysis").textContent = story.analysis || story.summary;
  const list = document.querySelector("#articleKeyPoints");
  list.innerHTML = (story.keyPoints || []).map(point => `<li>${point}</li>`).join("");
  document.querySelector("#keyPointsSection").style.display = story.keyPoints?.length ? "" : "none";
  document.querySelector("#articleBackground").textContent = story.background || "来源材料未提供足够背景信息。";
  document.querySelector("#articleImpact").textContent = story.impact || story.why;
  const original = document.querySelector("#articleOriginal");
  original.href = story.url;
  original.style.display = story.url ? "inline-block" : "none";
  document.querySelector("#articleDialog").showModal();
}

function bindSaveButtons() {
  document.querySelectorAll("[data-save]").forEach(button => button.onclick = () => {
    const id = button.dataset.save;
    saved.has(id) ? saved.delete(id) : saved.add(id);
    localStorage.setItem("zhichao-saved", JSON.stringify([...saved]));
    if (liveMode && !staticMode) {
      fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, saved: saved.has(id) })
      }).catch(() => {});
    }
    renderStories();
    showToast(saved.has(id) ? "已加入收藏追踪" : "已取消收藏");
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function relativeTime(date) {
  const hours = Math.max(0, Math.round((Date.now() - new Date(date).valueOf()) / 36e5));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

function mapDigest(items) {
  return items.map((item, index) => ({
    id: String(item.id),
    section: index < 3 ? "lead" : index < 11 ? "regular" : "extra",
    topic: item.topic,
    source: [item.source, ...(item.relatedSources || [])].join(" · "),
    time: relativeTime(item.publishedAt),
    title: item.titleZh || item.title,
    summary: item.summaryZh || item.description || "",
    why: item.whyItMatters || `这条信息与${item.topic}相关，值得持续观察。`,
    analysis: item.detailedAnalysisZh || item.summaryZh || item.description || "",
    keyPoints: item.keyPointsZh || [],
    background: item.backgroundZh || "",
    impact: item.impactZh || "",
    contentBasis: item.contentBasis || "summary",
    sourceTextLength: item.sourceTextLength || 0,
    featured: index === 0,
    url: item.url,
    score: item.score
  }));
}

async function loadLiveDigest() {
  try {
    const response = await fetch(apiUrl("digest"));
    if (!response.ok) return;
    const payload = await response.json();
    if (!payload.digest?.length) {
      document.querySelector(".hero p").textContent = "尚未生成真实简报。点击右上角开始采集。";
      return;
    }
    stories = mapDigest(payload.digest);
    liveMode = true;
    saved = new Set((payload.saved || []).map(String));
    document.querySelector(".hero .eyebrow").textContent = "DAILY BRIEFING · LIVE";
    document.querySelector(".hero p").textContent =
      `从全球信息源中筛选，更新于 ${new Date(payload.meta.lastDigestAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}。`;
    renderStories();
  } catch {
    document.querySelector(".hero p").textContent = "后端未连接，当前显示演示数据。";
  }
}

async function loadServiceStatus() {
  try {
    const status = await (await fetch(apiUrl("status"))).json();
    const translationBadge = document.querySelector("#translationBadge");
    const wechatBadge = document.querySelector("#wechatBadge");
    translationBadge.textContent = status.translationEnabled ? "已开启" : "待配置";
    translationBadge.className = `config-badge ${status.translationEnabled ? "ready" : "missing"}`;
    document.querySelector("#translationStatus").textContent = status.translationEnabled
      ? `使用 ${status.translationProvider === "deepseek" ? "DeepSeek" : "OpenAI"} 生成中文标题与摘要`
      : "配置 DeepSeek 或 OpenAI API Key 后自动翻译";

    wechatBadge.textContent = status.notifications?.enabled ? "云端已配置" : "待配置";
    wechatBadge.className = `config-badge ${status.notifications?.enabled ? "ready" : "missing"}`;
    const providers = [
      status.notifications?.serverChan ? "个人微信" : "",
      status.notifications?.weCom ? "企业微信" : ""
    ].filter(Boolean);
    document.querySelector("#wechatStatus").textContent = providers.length
      ? `已连接：${providers.join("、")}`
      : "配置 Server酱 SendKey 或企业微信 Webhook";
  } catch {
    document.querySelector("#translationStatus").textContent = "无法读取后端状态";
    document.querySelector("#wechatStatus").textContent = "无法读取后端状态";
  }
}

function updateDate() {
  const now = new Date();
  document.querySelector("#fullDate").textContent = now.toLocaleDateString("zh-CN", {
    year: "numeric", month: "long", day: "numeric"
  });
  const weekday = now.toLocaleDateString("zh-CN", { weekday: "long" });
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now - start) / 86400000);
  document.querySelector(".date-block small").textContent = `${weekday} · 第 ${day} 天`;
}

renderTopics();
renderStories();
updateDate();
loadLiveDigest();
loadServiceStatus();

if (staticMode) {
  const digestButton = document.querySelector("#digestButton");
  digestButton.disabled = true;
  digestButton.textContent = "每日 08:00 自动更新";
  document.querySelector("#testPushButton").style.display = "none";
  document.querySelector("#testConnectionsButton").style.display = "none";
  document.querySelector(".dialog-note").textContent =
    "线上版由 GitHub Actions 自动采集、翻译和推送；API 密钥保存在 GitHub Secrets 中，不会传到浏览器。";
}

filterChips.addEventListener("click", e => {
  if (!e.target.dataset.filter) return;
  activeFilter = e.target.dataset.filter;
  renderTopics(); renderStories();
});
topicList.addEventListener("click", e => {
  const button = e.target.closest("[data-topic]");
  if (!button) return;
  activeFilter = button.dataset.topic;
  renderTopics(); renderStories();
  document.querySelector(".secondary-heading").scrollIntoView();
  document.querySelector(".sidebar").classList.remove("open");
});

document.querySelector("#loadMore").onclick = e => {
  showExtras = !showExtras;
  e.currentTarget.innerHTML = showExtras ? "收起余下新闻 <span>↑</span>" : "展开今日余下 4 条 <span>↓</span>";
  renderStories();
};

document.querySelectorAll("[data-layout]").forEach(button => button.onclick = () => {
  document.querySelectorAll("[data-layout]").forEach(b => b.classList.remove("active"));
  button.classList.add("active");
  leadGrid.style.gridTemplateColumns = button.dataset.layout === "list" ? "1fr" : "";
});

document.querySelector("#themeButton").onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("zhichao-theme", document.body.classList.contains("dark") ? "dark" : "light");
};
if (localStorage.getItem("zhichao-theme") === "dark") document.body.classList.add("dark");

const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
document.querySelector("#searchButton").onclick = () => {
  searchPanel.classList.add("open"); searchPanel.setAttribute("aria-hidden", "false"); searchInput.focus();
};
document.querySelector("#closeSearch").onclick = closeSearch;
searchPanel.onclick = e => { if (e.target === searchPanel) closeSearch(); };
function closeSearch() { searchPanel.classList.remove("open"); searchPanel.setAttribute("aria-hidden", "true"); }
searchInput.oninput = () => {
  const q = searchInput.value.trim().toLowerCase();
  const matches = q ? stories.filter(s => `${s.title}${s.summary}${s.topic}${s.source}`.toLowerCase().includes(q)) : [];
  document.querySelector("#searchResults").innerHTML = q
    ? (matches.length ? matches.map(s => `<div class="search-result"><small>${s.topic} · ${s.source}</small>${linkedTitle(s)}</div>`).join("") : `<div class="empty-state">没有找到相关内容</div>`)
    : "";
};

document.querySelector("#settingsButton").onclick = () => document.querySelector("#settingsDialog").showModal();
document.querySelector("#closeArticleButton").onclick = () => document.querySelector("#articleDialog").close();
document.querySelector("#settingsDialog").addEventListener("close", e => {
  if (e.target.returnValue === "default") showToast("偏好设置已保存");
});
document.querySelector("#mobileMenu").onclick = () => document.querySelector(".sidebar").classList.toggle("open");
document.querySelector("#testPushButton").onclick = async event => {
  if (staticMode) return;
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "正在发送…";
  try {
    const response = await fetch("/api/push", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "推送失败");
    showToast(result.sent ? "测试简报已发送到微信" : "没有可用的推送渠道");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "发送一条测试简报到微信";
  }
};
document.querySelector("#testConnectionsButton").onclick = async event => {
  if (staticMode) return;
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "正在检查真实连接…";
  try {
    const response = await fetch("/api/integrations/test", { method: "POST" });
    const result = await response.json();
    const translationBadge = document.querySelector("#translationBadge");
    const wechatBadge = document.querySelector("#wechatBadge");
    translationBadge.textContent = result.translation.ok ? "连接正常" : "连接失败";
    translationBadge.className = `config-badge ${result.translation.ok ? "ready" : "missing"}`;
    document.querySelector("#translationStatus").textContent = result.translation.ok
      ? `已验证 ${result.translation.provider === "deepseek" ? "DeepSeek" : "OpenAI"} 可用`
      : result.translation.error;
    wechatBadge.textContent = result.wechat.ok ? "连接正常" : "连接失败";
    wechatBadge.className = `config-badge ${result.wechat.ok ? "ready" : "missing"}`;
    document.querySelector("#wechatStatus").textContent = result.wechat.ok
      ? "已向微信发送连接测试消息"
      : result.wechat.error;
    showToast(result.translation.ok && result.wechat.ok ? "两项连接均正常" : "发现连接问题，请查看状态说明");
  } catch (error) {
    showToast(`检查失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "检查翻译与微信连接";
  }
};
document.querySelector("#digestButton").onclick = async event => {
  if (staticMode) return;
  const button = event.currentTarget;
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = "正在采集与筛选…";
  showToast("正在连接全球新闻源，可能需要几十秒");
  try {
    const response = await fetch("/api/refresh", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "刷新失败");
    await loadLiveDigest();
    if (result.digest.translatedCount === result.digest.count) {
      showToast(`已生成并翻译 ${result.digest.count} 条新闻`);
    } else {
      const reason = result.digest.translationErrors?.[0] || "翻译服务未返回中文";
      showToast(`生成 ${result.digest.count} 条，翻译成功 ${result.digest.translatedCount} 条：${reason}`);
    }
  } catch (error) {
    showToast(`生成失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
};
document.querySelector("#signalButton").onclick = () => {
  activeFilter = "电力能源"; renderTopics(); renderStories();
  document.querySelector(".secondary-heading").scrollIntoView();
};

document.querySelectorAll(".nav-item").forEach(button => button.onclick = () => {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  button.classList.add("active");
  const view = button.dataset.view;
  if (view === "today") { activeFilter = "全部"; renderTopics(); renderStories(); window.scrollTo({top: 0, behavior: "smooth"}); }
  if (view === "topics") document.querySelector(".secondary-heading").scrollIntoView();
  if (view === "saved") {
    const savedStories = stories.filter(s => saved.has(s.id));
    leadGrid.innerHTML = "";
    newsList.innerHTML = savedStories.length ? savedStories.map((s, i) => `
      <article class="news-item"><span class="news-number">${String(i + 1).padStart(2, "0")}</span>
      <div class="news-title"><span class="tag">${s.topic}</span>${linkedTitle(s)}${readButton(s)}</div>
      <p class="news-summary">${s.summary}</p><div class="news-source"><strong>${s.source}</strong><span>${s.time}</span></div>${saveButton(s)}</article>`).join("")
      : `<div class="empty-state">还没有收藏。遇到值得持续关注的新闻，点一下菱形标记。</div>`;
    bindSaveButtons();
    bindReadButtons();
    document.querySelector(".secondary-heading").scrollIntoView();
  }
  document.querySelector(".sidebar").classList.remove("open");
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeSearch();
  if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); document.querySelector("#searchButton").click(); }
});
