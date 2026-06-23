# 知潮 · 私人新闻站

这是个人每日新闻站的可运行 MVP：网页、采集服务、正文提取、去重评分、中文深度解读、微信推送和每日定时任务均已接通。

## 打开方式

需要 Node.js 20 或更高版本。在本目录运行：

```powershell
node server.js
```

然后访问 `http://127.0.0.1:8765`。点击右上角“生成今日摘要”即可采集真实新闻。

Windows 也可以直接双击 `start-news.cmd`。

> 重要：正常使用翻译和微信推送时，请双击 `start-news.cmd` 启动。由某些受限开发工具启动的进程可能只能访问本机、无法连接 DeepSeek 和 Server酱。

## 开启中文翻译

复制 `.env.example` 为 `.env`。推荐使用 DeepSeek：

```env
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

系统会一次批量翻译当日 15 条新闻，并生成中文标题、中文摘要和“为什么重要”。没有密钥时，采集、分类、去重和排名仍会运行，页面保留来源原文。

系统还会尝试读取新闻网页的公开正文，并生成 500～900 字中文深度解读、关键要点、背景和影响。由于版权限制，网站不会逐字转载媒体全文；付费墙或禁止抓取的内容会明确标记为“仅基于公开摘要”。

## 接入个人微信

推荐使用 Server酱：

1. 打开 <https://sct.ftqq.com/sendkey>，使用微信扫码登录。
2. 按页面提示完成微信消息通道绑定。
3. 复制你的 SendKey。
4. 在 `.env` 中填写：

```env
SERVERCHAN_SENDKEY=你的SendKey
```

重启服务后，设置页会显示“微信推送已连接”，并可发送测试简报。

设置页中的“检查翻译与微信连接”会发起真实 DeepSeek 请求，并向微信发送一条连接测试消息。只有显示“连接正常”才代表功能真正可用。

如果使用企业微信，在群聊中添加“群机器人”，把 Webhook 填入：

```env
WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key
```

SendKey 和 Webhook 都是私密凭据，不要发给其他人或提交到代码仓库。

## 每天自动执行

在 PowerShell 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\install-daily-task.ps1
```

它会安装一个 Windows 每日任务：北京时间 08:00 自动采集、翻译并推送。电脑当时关机时，会在下次开机后补跑。若希望电脑关机也能推送，需要把本项目部署到云服务器。

## 已包含

- 12 个全球 RSS 信息源
- 新闻标准化、主题分类与相似新闻去重
- 来源权威性、时效、重要性和兴趣综合评分
- 带主题配额的每日 15 条简报
- OpenAI 批量中文翻译与结构化摘要
- Server酱个人微信、企业微信群机器人推送
- Windows 每日定时任务安装脚本
- 每天北京时间 08:00 自动运行
- 响应式网页、搜索、收藏、筛选与明暗模式
- `/api/status`、`/api/digest`、`/api/articles` 等本地 API

## 当前边界

当前使用 RSS 摘要而非全文抓取；翻译质量受 RSS 原始摘要完整度影响。本机定时任务要求电脑至少在当天某个时间开机。
