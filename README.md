# FirstPage Hong Kong — AI & Automation Portfolio Dashboard

An internal stakeholder-facing dashboard that showcases the HK team's production AI pipelines and automation systems. Built with Next.js 16 + TypeScript + Tailwind CSS v4, backed by NocoDB as the single source of truth.

## Two Views

| View | Access | Pages | Nav |
|------|--------|-------|-----|
| **Toolbox View** (default, no login) | `/toolbox`, `/login` | Live tool directory only | Toolbox · **Login** |
| **System View** (logged in) | All pages | Overview, Systems, Toolbox, Stack, Detail pages | Overview · Toolbox · Our Systems · Stack · **Logout** |

**Credentials:** Login credentials are NOT stored in this README. They live only in the gitignored `.env` file (`AUTH_USERS`). Reset login by editing `AUTH_USERS` in `.env` and redeploying; never commit real credentials to README.

## Quick Start

```bash
# Install dependencies (requires pnpm)
pnpm install

# Development server
pnpm dev
# → http://localhost:3000

# Production build
pnpm build

# Start production server
pnpm start
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.4 (App Router) |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Data | NocoDB (live API) |
| Auth | Cookie-based middleware + API routes |
| Package Manager | pnpm |

## Project Structure

```
├── app/
│   ├── page.tsx                  # Division Dashboard (MCP/GA4/GSC/PSI, Ahrefs, HubSpot, usage)
│   ├── layout.tsx                # Root layout with auth-aware NavBar
│   ├── login/page.tsx            # Login form
│   ├── toolbox/page.tsx          # Tool directory (async server page + client ToolboxView)
│   ├── leads/page.tsx            # Leads (Lead Quality report + auto-greeting KPIs)
│   ├── api/login/route.ts        # Auth endpoint
│   ├── api/logout/route.ts       # Logout endpoint
│   ├── api/tools/<slug>/route.ts # Per-tool API routes
│   ├── tools/<slug>/             # 22 tool folders (tool.ts manifest + page.tsx)
│   └── components/NavBar.tsx     # Auth-aware navigation
├── components/
│   ├── ui/                       # Shared design-language atoms (Card, Badge, StatCard, PageHeader…)
│   ├── toolbox/                  # Toolbox page components (ToolboxView, ToolCard, ToolSearch…)
│   ├── tools/                    # Tool-page domain components (BriefForm, ResultView…)
│   └── dashboard/                # Dashboard widgets
├── lib/
│   ├── registry.ts               # Static tool registry — CODE IS THE SOURCE OF TRUTH
│   ├── dashboard.ts              # Dashboard aggregation
│   ├── llm.ts, mcp.ts, ahrefs.ts, psi.ts, hubspot*.ts  # External API clients
│   ├── db.ts, usage.ts, outputs.ts, cache.ts, uptime*.ts  # Postgres runtime + caching
│   └── nocodb.ts, data.ts, unified-tools.ts  # Legacy, retired — reference only
├── proxy.ts                      # Route-level auth guard
├── next.config.ts                # distDir: 'dist'
└── .env.local                    # Secrets (API keys, AUTH_USERS, DATABASE_URL)
```

## Data Architecture

### Code + Postgres + external APIs

- **`lib/registry.ts` is the source of truth for tools** — a static index of `app/tools/<slug>/tool.ts` manifests (plus inline `externalLink` entries for standalone tools). No external DB for tool metadata, so it can never drift.
- **Postgres** is the runtime store: `usage_events`, `tool_outputs`, `hubspot_leads_cache`, `uptime_checks`, `cache_store` (TTL cache backing).
- **External APIs** feed the dashboard and tools: firstpage MCP (GA4/GSC/PSI), Ahrefs, HubSpot, OpenRouter. All calls are tolerant (degrade to `configured:false`/error) and memoized (1h default, Postgres-backed TTL cache).

### Adding a new tool

1. Create a new record in the NocoDB Tools table
2. Set a unique URL-friendly `slug`
3. Fill in all fields (tagline, before/after/flow/impact, metrics, serve, type, etc.)
4. Rebuild: `pnpm build`

No code changes needed — the detail page auto-generates from the slug via `generateStaticParams()`.

## Current Systems (16 total)

### Active / Production

| System | Category | Impact |
|--------|----------|--------|
| Overdue Invoice Reports | Reporting | 3h/mo saved |
| FP FAQ Schema Generator | Utility | 10h/mo, 125 entries in 2 months |
| Lovable Landing Page Pipeline | Automation | 2h/mo |
| Content Brief Generate | Automation | 40h/mo, HK$12,000/mo |
| TD Generator MVP | Automation | 4h/mo |
| PBN Content Automation | System | 8h/mo, 900 links/mo |
| CX FAQ n8n Workflows | Content | 33h/mo, HK$9,900/mo |
| Invoice Review System | System | 1h/mo |
| Proposal Advisory System | Utility | 4h/mo |
| CX OD URLs Generator | Automation | 2h/mo, GSC URL generation |

### Building / Prototype / Refactoring

| System | Status | Notes |
|--------|--------|-------|
| Blog Upload Automation | Building | 180+ WP sites, NocoDB page builder detection |
| Toolbox Dashboard | Building | This app — meta-tool portal |
| Invoice List for AM Review | Prototype | Monthly dedup + AM distribution |
| Invoice List Twice Monthly | Prototype | AM status review |
| CX FAQ Paraphrase Pipeline | Refactoring | Hermes Agent successor to 9 n8n workflows |

## Environment Variables

Copy `.env.example` to `.env` and fill in the real secrets (`.env` is gitignored — see `.env.example` for the full list of keys):

```bash
# Auth (NocoDB is retired — no NocoDB vars needed)
AUTH_USERS=name:pass,name2:pass2
DATABASE_URL=postgres://...
```

## Deployment

This app requires a **Next.js server** — do not deploy to pure static hosts (GitHub Pages, S3 static hosting). Middleware, API routes, and auth will not work.

**Supported hosts:**
- Vercel (recommended)
- Node.js server + Docker
- Any platform with Next.js serverless function support

```bash
pnpm build
# Deploy the dist/ folder
```

## Key Features

- **NocoDB-driven**: All data lives in NocoDB — no code changes needed to add/update systems
- **ISR on detail pages**: `revalidate: 300` — new slugs picked up within 5 minutes
- **Auth middleware**: Cookie-based, two-view access control
- **Tech Stack aggregation**: Automatically parses `tech_stack` from all systems
- **Team coverage**: Dynamic from `serve` MultiSelect field
- **HKD currency**: All monetary values displayed in HK$

## Team API Gateway (OpenRouter BYOK)

Internal team API-key management: one company Alibaba DeepSeek BYOK credential,
issued as limited monthly-budget sub-keys. Each key carries its own monthly USD
limit (enforced by OpenRouter's per-key limit — hard-blocked at the limit);
teams (departments) have an admin-controlled monthly credit pool and key-count
cap. Usage shown is **effective usage = Credits + BYOK** (matches the OpenRouter
dashboard; the UI shows the split), and monthly limits renew on the 1st
(`limit_reset monthly`).

- **Management UI**: `/gateway` — three role views:
  - **Admin** (`ADMIN_USERS`): all teams; create teams; adjust each team's
    credit pool (`credit_usd`) and key-count cap (`max_keys`); alerts
  - **Champion** (team lead): issue keys for their team (each key's limit,
    sum ≤ team credit; 1–2 members per key), revoke/assign, per-key usage
  - **Member**: sees only the key assigned to them (usage bar + config hint)
- **Co-worker setup**: any OpenAI-compatible client → base URL
  `https://openrouter.ai/api/v1`, model `deepseek/deepseek-v4-flash-0731`, key issued
  by the team champion (plaintext shown once)
- **Env**: `OPENROUTER_MANAGEMENT_KEY` (required), `ADMIN_USERS`,
  `SLACK_WEBHOOK_URL` (optional 80%/100% alerts), `GATEWAY_TEAM_LIMIT_USD` (30),
  `GATEWAY_POLL_MINUTES` (60). See `.env.example`.
- **Savings estimate**: `/gateway` may show a global savings-vs-OpenRouter-list-
  price figure — an estimate computed from `/api/v1/analytics` tokens × OR list
  price minus BYOK spend.
- **Prerequisite**: bind the company DeepSeek BYOK credential in OpenRouter
  BYOK settings
  (`openrouter.ai/workspaces/default/byok`) before issuing keys. Known issue:
  BYOK routing is currently not active (`is_byok: false`) — spend runs through
  OpenRouter credits; limits still enforce exactly.
- **Lock a key to a single model (no code)**: OpenRouter API keys can't be
  model-locked directly, but a **guardrail** with `allowed_models` can. Create
  `POST /api/v1/guardrails` with `{ name, allowed_models: ["deepseek/deepseek-v4-flash-0731"] }`,
  then `POST /api/v1/guardrails/{id}/assignments/keys` with
  `{ key_hashes }`. Non-allowlisted models are blocked (403) per key. Currently
  applied to the 8 `fp-*` team keys (guardrail `fp-deepseek-v4-flash-0731-only`).
  **Exceptions**: `fp-Content` uses its own guardrail
  (`fp-content-0731-plus-sonar`, allowlist `0731 + perplexity/sonar`) so the
  content team can also use Perplexity Sonar. Note: sonar rejects a
  `max_tokens` body param (400) — send the plain chat body for it.
