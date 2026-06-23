# Security

## Secrets

Never commit any of these values:

- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `SERVERCHAN_SENDKEY`
- `WECOM_WEBHOOK_URL`

For local use, keep them in `.env`. For GitHub Actions, store them in:

`Settings → Secrets and variables → Actions`

The `.env` file, local news database, portable runtime, ZIP files, and generated
`dist` directory are excluded by `.gitignore`.

## Public output

GitHub Pages publishes only the generated `dist` artifact. The build removes:

- API keys and push credentials
- fetched source article text
- internal translation errors

The public site contains Chinese editorial summaries, source attribution, and
links to the original publications.
