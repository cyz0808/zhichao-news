# 部署到 GitHub Pages + Actions

## 1. 创建公开仓库

在 GitHub 创建一个空仓库，例如 `zhichao-news`，不要勾选添加 README。

将本目录中的项目文件上传到仓库根目录。不要上传：

- `.env`
- `data/news.json`
- `runtime/`
- 任何包含 API Key 或 SendKey 的文件

这些路径已写入 `.gitignore`。

## 2. 添加加密密钥

进入仓库：

`Settings → Secrets and variables → Actions → New repository secret`

添加：

| Secret 名称 | 内容 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `SERVERCHAN_SENDKEY` | Server酱 SendKey |

如使用企业微信，可额外添加 `WECOM_WEBHOOK_URL`。

密钥只会进入 GitHub Actions 的临时运行环境，不会出现在 Pages、代码或构建产物中。

## 3. 开启 Pages

进入：

`Settings → Pages → Build and deployment`

将 Source 设置为 **GitHub Actions**。

## 4. 首次发布

进入仓库的 `Actions` 页面，打开：

`Build daily news and deploy Pages`

点击 `Run workflow`。

成功后，部署地址通常是：

`https://你的用户名.github.io/仓库名/`

## 5. 自动执行

工作流会在以下情况执行：

- 每天北京时间 08:00
- 推送代码到 `main`
- 在 Actions 页面手动运行

GitHub 的定时任务可能延迟几分钟。

## 安全说明

- GitHub Pages 只能访问构建后的 `dist` 文件。
- `.env` 不会提交。
- 原始新闻正文不会发布，只发布中文解读。
- 工作流日志不会主动打印密钥。
- 请勿在 Issue、README、截图或聊天中粘贴密钥。

## X 线索层 Secret

如果线上部署也需要抓取 X 线索，请在 GitHub Actions Secrets 中额外添加：

| Secret 名称 | 内容 |
|---|---|
| `X_BEARER_TOKEN` | X API Bearer Token |

不配置 `X_BEARER_TOKEN` 时，网站仍会正常使用 RSS 新闻源，X 线索层会自动跳过。
