# FirstPage HK Organic Performance

A focused internal report for FirstPage Hong Kong organic performance. The authenticated home page combines Google Search Console, GA4, Ahrefs, and PageSpeed data. Users can choose a 7, 30, or 90 day range, set custom dates, switch data sources, and generate an on-demand GSC traffic summary.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The report requires sign-in at `/login`.

## Environment

Set server-side values in `.env.local`:

- `FP_MCP_URL`, `FP_MCP_INTERNAL_KEY`, and optionally `FP_SESSION_DOMAIN` for firstpage-mcp sign-in; `AUTH_USERS` is the fallback when the internal key is absent.
- `FP_MCP_API_KEY` for GA4, GSC, and PageSpeed.
- `AHREFS_API_KEY` for search presence data.
- `OPENROUTER_API_KEY` for the on-demand GSC summary.
- Optional report target overrides: `DASHBOARD_TARGET_URL`, `DASHBOARD_TARGET_DOMAIN`, `DASHBOARD_GSC_SITE`, `DASHBOARD_GA4_PROPERTY`, `DASHBOARD_DATA_END_DATE`.

External API responses are cached in process for one hour. The app does not require a database.

## Verify and deploy

```bash
pnpm lint
pnpm build
pnpm start
```

The app needs a Next.js-compatible server. `dist/` contains the server build; it is not a static export.
