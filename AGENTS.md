# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

## Child DOX Index

- `app/AGENTS.md` — App Router surface: pages, API routes, routing/auth rules. Owns everything under `app/`.
- `lib/AGENTS.md` — Data layer: tool registry, external API clients (MCP/Ahrefs/HubSpot), Postgres runtime, caching. Owns everything under `lib/`.
- `components/AGENTS.md` — Reusable toolbox UI components. Owns everything under `components/`.
- Root-owned: `db/init.sql` (schema bootstrap; includes the deepseek gateway tables), `docker-compose.yml` (local Postgres), `Dockerfile` (production image), `proxy.ts`, `instrumentation.ts` (boots the 5-min uptime checker + hourly gateway usage poller), config files (`next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`), `public/`, `README.md`, `CLAUDE.md` (Zeabur project/service IDs), `.env` / `.env.local` (secrets, not committed), `reasonix.toml` (agent MCP config — `firstpage` server at `https://mcp.firstpage.com.hk/mcp/` with bearer key; gitignored), `.opencode/`.

---

# AGENTS.md — FirstPage HK AI & Automation Portfolio Dashboard

This file contains project-specific context for AI coding agents. Read this before making any changes.

---

## Project Overview

This is the **FirstPage Hong Kong AI & Automation Portfolio Dashboard** — an internal stakeholder-facing web application that showcases the team's production AI pipelines and automation systems.

It serves two primary audiences:
- **External stakeholders / executives** (the "boss view") — sees high-level ROI metrics, business impact, and architecture overview
- **Internal team** (the "system view") — sees full system inventory, live tool directory, tech stack breakdown, and individual project detail pages

The app is a Next.js server-rendered application that fetches live data from external APIs (firstpage MCP for GA4/GSC/PSI, Ahrefs, HubSpot, Postgres) at request time with caching. It requires a Next.js server to run (not a static export) because it uses a proxy (formerly middleware), API routes, and cookie-based authentication.

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.3.4 |
| UI Library | React | 19.3.0 |
| Charts | recharts | ^3.10 (dashboard `/` only, client components) |
| Language | TypeScript | 6.0.3 |
| Styling | Tailwind CSS | ^4 (v4 with `@import "tailwindcss"`) |
| Build Tool | PostCSS with `@tailwindcss/postcss` | ^4 |
| Package Manager | pnpm | (workspace declared in `pnpm-workspace.yaml`) |
| Linter | ESLint | ^9 with `eslint-config-next` (stay on 9 — `eslint-plugin-react` doesn't support ESLint 10 yet) |

---

## Project Structure

```
.
├── app/                          # Next.js App Router (all pages + API routes)
│   ├── page.tsx                  # Homepage / Division Dashboard (PageHeader + dashboard widgets)
│   ├── layout.tsx                # Root layout with header, footer, NavBar
│   ├── globals.css               # Tailwind import + FirstPage brand color theme
│   ├── login/page.tsx            # Login form (client component, Card/Input/Button)
│   ├── toolbox/page.tsx          # Tool directory (async server component; passes ?q=&cat= as props to ToolboxView)
│   ├── leads/page.tsx           # Leads — title "Leads", spam report + auto-greeting KPIs (PageHeader + StatCard + Card)
│   ├── api/login/route.ts        # POST /api/login — cookie-based auth
│   ├── api/logout/route.ts       # POST /api/logout — clears auth cookie
│   ├── api/tools/<slug>/route.ts # Per-tool API routes (data tools + LLM tools)
│   ├── tools/<slug>/             # 26 tool folders: tool.ts manifest + page.tsx
│   └── components/NavBar.tsx     # Auth-aware navigation (client component)
│
├── components/ui/                # Shared design-language atoms (server-safe, no deps)
│   ├── PageHeader.tsx            # Title + count pill + description + trailing
│   ├── Card.tsx                  # White/slate container, hover + padding options
│   ├── Badge.tsx                 # Category/status pill (static color map)
│   ├── StatCard.tsx              # KPI card (white / fp-* tones, md/lg sizes)
│   ├── SectionTitle.tsx          # Heading + optional count
│   ├── EmptyState.tsx            # Dashed empty block
│   ├── Button.tsx                # primary/secondary/brand, sm/md/lg (client)
│   ├── Input.tsx                 # Labeled input with focus ring (client)
│   ├── Select.tsx                # Labeled select (client)
│   ├── Textarea.tsx              # Labeled textarea (client)
│   └── ErrorBanner.tsx           # Red error banner, role=alert (server-safe)
│
├── components/toolbox/           # Toolbox page components
│   ├── ToolboxView.tsx           # Client container: search + category filter, ?q=&cat= URL sync
│   ├── ToolCard.tsx              # Tool card (SVG icon tile in category colors; externalLink cards link out)
│   ├── ToolSearch.tsx            # Search input with icon
│   └── CategoryFilter.tsx        # All + category chips
│
├── components/tools/             # Tool-page domain components (all client)
│   ├── BriefForm.tsx             # Shared client-brief form (Pitch Deck / Proposal)
│   ├── ResultView.tsx            # Generic JSON result renderer (tables/stat cards/copy/download)
│   ├── OutputHistory.tsx         # Saved-output history rail
│   ├── HubSpotLeads.tsx          # Right-rail lead picker (prefills the brief)
│   ├── useToolApi.ts / usePrefill.ts  # POST hook + cross-tool link prefill
│
├── components/dashboard/         # `/` dashboard widgets (MetricCard, SectionHeader, charts…)
│
├── lib/                          # Data layer and utilities
│   ├── registry.ts               # Static tool registry (code = source of truth; externalLink supported)
│   ├── tool-icons.tsx            # Tool SVG icon map + category color helpers + ToolPageHeader banner
│   ├── dashboard.ts              # Dashboard aggregation (HubSpot/MCP/PSI/Ahrefs/usage)
│   ├── llm.ts, ahrefs.ts, mcp.ts, pdf.ts, screenshot.ts, render-diff.ts  # External API clients + browserless helpers
│   ├── db.ts, usage.ts, outputs.ts, cache.ts, uptime*.ts  # Postgres runtime + caching
│   ├── auth.ts                   # SSO vs firstpage-mcp (FP_MCP_*), AUTH_USERS fallback; email identity
│   └── gateway/                  # team-key gateway (OpenRouter BYOK): db, openrouter client, service, alert scheduler
│
├── db/                           # Database bootstrap
│   └── init.sql                  # Schema for usage_events, tool_outputs, hubspot_leads_cache, uptime_checks (onsite_audit_actions auto-creates on first use)
├── proxy.ts                     # Route-level auth guard (cookie check + redirects); formerly middleware.ts (renamed in Next.js 16)
├── instrumentation.ts           # Server bootstrap: starts the 5-min uptime checker (lib/uptime-scheduler.ts) + hourly gateway usage poller (lib/gateway/alert-scheduler.ts)
├── next.config.ts                # distDir: 'dist', images.unoptimized: true
├── postcss.config.mjs            # @tailwindcss/postcss plugin
├── eslint.config.mjs             # Next.js core-web-vitals + typescript rules
├── docker-compose.yml            # Local dev Postgres 18 (postgres:18-alpine)
└── .env.local                    # Secrets (API keys, AUTH_USERS, DATABASE_URL)
```

### Important Path Alias

`@/*` maps to `./*` in `tsconfig.json`. Use `@/lib/registry`, `@/components/ui/Card`, `@/components/toolbox/ToolCard`, etc.

---

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Start local Postgres (postgres:18-alpine, schema auto-creates on first start)
docker compose up -d

# Start development server
pnpm dev

# Build for production (output goes to dist/)
pnpm build

# Start production server
pnpm start
# OR serve the dist/ folder with a Next.js-compatible host

# Run linter
pnpm lint
```

### Build Output

The project uses a **custom build directory**: `dist/` (not `.next/`). This is configured in `next.config.ts`.

The `dist/` folder contains a Next.js server build (not a static export). Deploy it to a host that supports Next.js server rendering: Vercel, Node.js server, Docker, etc.

`images.unoptimized: true` is set to avoid dependency on the Next.js Image Optimization API.

---

## Data Architecture

### Data Sources (current)

1. **Code = source of truth** — tool registry (`lib/registry.ts`) is a static index of `app/tools/<slug>/tool.ts` manifests. Adding a tool = one folder + one import line. No drift possible.
2. **Postgres** — runtime data: `usage_events` table (user, tool, tokens, cost) via `lib/usage.ts` / `lib/db.ts`. `DATABASE_URL` env. Dev: podman `postgres:18-alpine`.
3. **External APIs** — OpenRouter (`lib/llm.ts`, `OPENROUTER_API`), Ahrefs (`lib/ahrefs.ts`, `AHREFS_API_KEY`), HubSpot contacts (`lib/hubspot.ts`, `HUBSPOT_SERVICE_KEY`; 1h Postgres cache), firstpage MCP (`lib/mcp.ts`, `FP_MCP_API_KEY`) — **all PageSpeed/Lighthouse data comes from MCP `psi_audit` (4 categories + CWV); Google's public PSI REST API is decommissioned (404), do not reintroduce it**. Browserless (`lib/pdf.ts` / `lib/screenshot.ts` / `lib/render-diff.ts`, `BROWSERLESS_URL`/`BROWSERLESS_TOKEN`) powers PDF export, page screenshots and JS-render diffs. OpenRouter Management API (`lib/gateway/openrouter.ts`, `OPENROUTER_MANAGEMENT_KEY`) powers the **team-key gateway** (`/gateway`): one company BYOK credential (Alibaba/Aliyun DeepSeek, ~30% off list) bound via OpenRouter BYOK, per-key monthly USD limits enforced by OpenRouter (`include_byok_in_limit`). Multi-key model: teams (departments) hold an admin-controlled credit pool (`credit_usd`) + key-count limit (`max_keys`); champions issue keys (each with its own limit, sum ≤ team credit) and bind 1–2 members per key; members see only their own key. Key usage shown is **effective usage = Credits + BYOK** (matches the OpenRouter dashboard; the UI shows the split), and monthly limits renew on the 1st (`limit_reset monthly`). Hourly poller (`lib/gateway/alert-scheduler.ts`) snapshots per-key usage + alerts at 80%/100% (Slack webhook + in-app). A global savings-vs-OpenRouter-list-price estimate may appear on `/gateway` — computed from `/api/v1/analytics` tokens × OR list price − BYOK spend. The `/` dashboard aggregates these via `lib/dashboard.ts`.
4. **FirstPage MCP** — `lib/mcp.ts` is a JSON-RPC client for `https://mcp.firstpage.com.hk/mcp/` (`FP_MCP_API_KEY`, same key the agent MCP config uses). Dashboard consumes PSI audits, GA4 (firstpage.hk = `374723776`), GSC (`https://www.firstpage.hk/`) and the full client portfolio (752 GSC sites / 1058 GA4 properties). Targets: `DASHBOARD_TARGET_URL` / `DASHBOARD_TARGET_DOMAIN` (default `firstpage.hk`), `DASHBOARD_GSC_SITE`, `DASHBOARD_GA4_PROPERTY`.
4. **Content** — brand guide + case studies as markdown in `content/` (`lib/content.ts`), fed into the deck/proposal generation. (NocoDB is retired — `lib/nocodb.ts`, `lib/data.ts`, `lib/unified-tools.ts` were deleted; do not reintroduce them.)

---

## Authentication

### How It Works

The app uses **per-user cookie authentication**:

- **Public**: `/toolbox`, `/login`, `/api/*` — no login required
- **Protected**: `/`, `/tools/*` — requires login

### Auth Flow

1. User submits credentials on `/login` → `POST /api/login`
2. Server validates email+password against firstpage-mcp (`POST {FP_MCP_URL}/admin/api/authenticate`, Bearer `FP_MCP_INTERNAL_KEY`) when the key is set; otherwise falls back to `AUTH_USERS` env (comma-separated `name:password` pairs)
3. On success, mcp returns a `session_token`; login sets the shared httpOnly `fp_session` cookie (domain=`FP_SESSION_DOMAIN`) — the user's identity when `FP_MCP_INTERNAL_KEY` is set. The token only lives ≤8h, so it is written **only when the browser holds no live session for that same email**: overwriting a portal session (30 days, renewed on use) with it signed colleagues out mid-day. Signing in as a different email still replaces the cookie. It also sets host-only `fp-auth=<email>` (1-week, `sameSite: strict`), used for usage attribution in `usage_events` and as the identity in legacy mode
4. Identity in SSO mode: the `fp_session` cookie, validated on every request against mcp `GET /admin/api/session` (Bearer `FP_MCP_INTERNAL_KEY`, 60s module cache in `lib/auth.ts`). Legacy mode (key unset): `fp-auth` validated against `AUTH_USERS`
5. `proxy.ts` validates the session on every page request (passing the request cookie to `getSessionUser()` — `next/headers` is unavailable in the proxy); route handlers use `currentUsername()`/`getSessionUser()` from `lib/auth.ts`. A session-validation fetch error degrades to unauthenticated, never throws
6. Unauthenticated users hitting protected routes are redirected to `/toolbox`
7. `GET /api/me` returns `{loggedIn, username, isAdmin}`; `NavBar` fetches it on mount (mounted placeholder prevents hydration mismatch — no client-side cookie parsing)
8. Registration lives on the mcp admin panel (`{FP_MCP_URL}/admin/register`); the toolbox `/login` page links there ("No account? Register at the MCP admin panel →", server-rendered prop)
9. Logout clears both cookies via `POST /api/logout`
10. Gateway champion/member names are mcp user emails (`is_verified`), validated against the cached `GET /admin/api/users` list; admins = mcp `is_admin` OR `ADMIN_USERS`

When `FP_MCP_INTERNAL_KEY` is configured there is **no fallback to AUTH_USERS**: mcp network/HTTP failures surface as 502s in login (rather than silently accepting local credentials), and session-validation failures degrade to unauthenticated (redirect/401).

### Auth Environment Variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `FP_MCP_URL` | `https://mcp.firstpage.com.hk` | firstpage-mcp base URL for auth/users/session validation (SSO mode; optional) |
| `FP_MCP_INTERNAL_KEY` | *(secret)* | Internal key for mcp `/admin/api/*`. Set → SSO mode (identity = `fp_session`); unset → legacy `AUTH_USERS` |
| `FP_SESSION_DOMAIN` | `firstpage.com.hk` | Domain for the shared httpOnly `fp_session` cookie (mcp session; the SSO identity) |
| `AUTH_USERS` | `glass:pass,wing:pass2` | Legacy fallback only — `name:password` pairs used when `FP_MCP_INTERNAL_KEY` is unset |
| `ADMIN_USERS` | `glass@firstpage.com.hk` | Gateway admin emails; OR on top of mcp `is_admin` in both modes |

**Security note**: With the internal key set, credentials validate against firstpage-mcp (PBKDF2 + verified-email check) — the robust path. The `AUTH_USERS` fallback is a simple scheme for an internal team; do not run sensitive tools behind it alone.

---

## Routing & Pages

| Route | Type | Auth Required | Data Source |
|-------|------|---------------|-------------|
| `/` | Server | Yes | `lib/dashboard.ts` (HubSpot leads + spam, PSI, Ahrefs) + `lib/hubspot.ts` `getSpamReport(30)` (Lead Quality zone) |
| `/toolbox` | Server shell + client view | No | `lib/registry.ts` (code); `ToolboxView` filters/search via `?q=&cat=` URL params |
| `/tools/pitch-deck` | Client | Yes | `lib/client-data.ts` (GSC + GA4 + PSI + Ahrefs) → OpenRouter |
| `/tools/proposal` | Client | Yes | `lib/client-data.ts` (GSC + GA4 + PSI + Ahrefs) → OpenRouter |
| `/tools/*` (24 more) | Client | Yes | per-tool API routes; see `app/AGENTS.md` for the full list |
| `/usage` | Server | Yes | `lib/usage.ts` — tool runs, active users, LLM cost, per-tool run counts (hero banner + bignums + tools grid) |
| `/gateway` | Server + client | Yes | `lib/gateway/` — Team API-key management. Admin (`mcp is_admin`/`ADMIN_USERS` emails): all teams + edit credit/max_keys + create teams; Champion (mcp user email in `deepseek_teams.champion`): own team's keys (issue/revoke/assign, plaintext shown once); Member: own key only |
| `/api/gateway` | API | Yes (cookie) | GET role-scoped views · POST create team (admin) · PATCH `/api/gateway/teams/<id>` adjust credit/max_keys (admin) · POST `/api/gateway/teams/<id>/keys` issue (champion/admin) · DELETE `/api/gateway/keys/<id>` revoke · POST/DELETE `/api/gateway/keys/<id>/members` assign/unbind |
| `/login` | Client | No | — |
| `/api/login` | API | No | SSO vs firstpage-mcp (`AUTH_USERS` fallback) |
| `/api/logout` | API | No | — |
| `/api/tools/<slug>` | API | Yes (cookie) | data/LLM tool routes (GET = options or history, POST = run/refine) |

---

## Code Style Guidelines

### TypeScript
- Strict mode is enabled (`"strict": true` in `tsconfig.json`)
- Use explicit return types on exported functions in `lib/`
- React components use `Readonly<Props>` where applicable

### React Conventions
- Server components are the default; mark client components with `"use client"` only when needed (state, effects, browser APIs)
- `NavBar`, `ToolboxView`, `ToolSearch`, `CategoryFilter`, `LoginPage` are client components; `ToolCard` is server-safe (used inside the client view)
- `page.tsx` (home) and `leads/page.tsx` are server components that fetch data directly; `toolbox/page.tsx` is an async server component that reads `?q=&cat=` from `searchParams` and passes them as props to the client `ToolboxView`

### Styling
- Tailwind CSS v4 with inline theme configuration in `globals.css`. Visual identity follows `docs/design-ref/brand-spec.md` (extracted from firstpage.hk).
- Design tokens (`globals.css` `@theme inline`): `bg`/`surface` (white / `#f1f1f1`), `navy` (`#00225d`) display ink, `muted`, `border`, `coral` (`#ff5254`) action color with coral `--grad-cta` and blue `--grad-banner` gradients, brand `blue` (`#427fe0`), category colors (`cat-sales/research/technical/content/ops`), plus the `fp-*` blue scale. Render the gradients with the `bg-grad-banner` / `bg-grad-cta` utilities — `bg-[var(--grad-banner)]` emits `background-color` and will NOT display a gradient.
- Font: **Open Sans** via `next/font/google` (`--font-open-sans`) — the design-ref mockups' proxima-nova fallback. Mono: `ui-monospace`.
- Page headers are **full-width blue-gradient banners** (`PageHeader`, or `ToolPageHeader` for tool pages) with white titles + count pill + trailing slot.
- Common patterns:
  - Cards: `Card` from `@/components/ui/Card` (white/slate tones, `hover` option, `noPadding` + `className` for custom padding)
  - KPI cards: `StatCard` from `@/components/ui/StatCard` (white tone by default, `fp-*` tones + `size="lg"` for hero panels)
  - Status badges: `Badge` from `@/components/ui/Badge` (static color map: fp/slate/emerald/blue/amber/rose/violet)
  - Layout max-width: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

### Component Patterns
- **Build UI from `components/ui/`** — the shared design-language atoms (Card/Badge/StatCard/PageHeader/Button/Input…). Extend the shared layer instead of hand-copying card/badge classes into new pages.
- **Interactive primitives = selective shadcn** (`dialog`/`alert-dialog`/`tabs`/`dropdown-menu`/`tooltip`/`popover` + server-safe `table`; new-york style, `components.json`). Brand atoms stay hand-rolled; never re-theme or replace them. shadcn vars map onto brand tokens in `globals.css`; `bg-muted` is forbidden here (`--muted` = gray text — use `bg-surface`).
- Tailwind dynamic classes must come from static maps (`Record<…, string>`) — never string-concatenate class names.
- Tool icons are **stroke SVGs** from `lib/tool-icons.tsx` (static map keyed by tool name) rendered via `ToolIcon`; category colors via `categoryColorClass`/`categoryBgClass`/`categoryBarClass`. No icon library dependency.

---

## Testing

**There are currently no tests in this project.** No test runner (Jest, Vitest, Playwright, Cypress) is installed or configured.

If you add tests:
- Install a test runner as a dev dependency
- Add test scripts to `package.json`
- Create `__tests__/` directories or `*.test.ts` / `*.spec.ts` files alongside source files

---

## CI/CD & Deployment

**No CI pipeline yet** — no `.github/workflows/`. Deployment is via the `Dockerfile` (Zeabur / any container host) with a separate managed Postgres, or `docker compose` for local dev (see Build & Development Commands).

### Production Deployment

1. Build the image from `Dockerfile` (multi-stage: deps → build → standalone runner)
2. Provision a Postgres service and set `DATABASE_URL`; the three tables auto-create on first use via `CREATE TABLE IF NOT EXISTS` in `lib/` (or seed with `db/init.sql`)
3. Set the remaining env vars below; the container serves on port 3000

### Environment Variables for Production

Make sure these are set in your hosting environment:
- `FP_MCP_URL` — firstpage-mcp base URL (default `https://mcp.firstpage.com.hk`); SSO auth + user list
- `FP_MCP_INTERNAL_KEY` — internal key for mcp `/admin/api/*`. Set → SSO mode (email identity); unset → `AUTH_USERS` fallback
- `FP_SESSION_DOMAIN` — optional shared-cookie domain (e.g. `firstpage.com.hk`) for the httpOnly `fp_session` mcp-session cookie
- `AUTH_USERS` — legacy fallback only: per-user credentials (`name:pass,name2:pass2`) when `FP_MCP_INTERNAL_KEY` is unset
- `DATABASE_URL` — Postgres connection (usage events + tool outputs + leads cache)
- `OPENROUTER_API` — OpenRouter key for deck/proposal generation
- `AHREFS_API_KEY` — competitor data for the deck pipeline
- `HUBSPOT_SERVICE_KEY` — HubSpot private app token for recent-leads import
- `BROWSERLESS_URL` — self-hosted browserless base URL (e.g. `https://browserless.firstpage.com.hk/`); used by the onsite-audit crawler (`/content`), PDF export (`/pdf`), page screenshots (`/screenshot`) and render-diff (`/content`). `/lighthouse` is NOT available on this build.
- `BROWSERLESS_TOKEN` — browserless auth token (server-side only)
- `OPENROUTER_MANAGEMENT_KEY` — OpenRouter management key for the team-key gateway (`/gateway`): issue/revoke team keys, read per-key usage. Prereq: company BYOK credential bound in OpenRouter BYOK settings (BYOK active — BYOK spend counts toward per-key limits via `include_byok_in_limit`)
- `ADMIN_USERS` — comma-separated gateway admin emails; OR on top of mcp `is_admin` (all teams; create teams; adjust team credit/max_keys)
- `SLACK_WEBHOOK_URL` — optional; 80%/100% team-limit alerts (in-app alerts always record)
- `GATEWAY_TEAM_LIMIT_USD` — default per-team monthly USD limit when creating a team (30)
- `GATEWAY_POLL_MINUTES` — gateway usage poll + alert interval in minutes (60)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` — Gmail/Workspace SMTP for the auto-greeting email (`lib/greeting.ts`). Use a Workspace account on the sending domain so SPF/DKIM align. **Dry-run until `SMTP_USER` is set and `GREETING_DRY_RUN` is not `1`**; flip-to-live is itself the cold-start cutover (no backlog blast).
- `GREETING_DRY_RUN` — `1` forces the auto-greeting sender to print-only (default off once SMTP is configured)
- `GREETING_MAX_ATTEMPTS` — max real send attempts per lead before giving up (3)
- `GREETING_HOURS_START` / `GREETING_HOURS_END` — HK-time business-hours window for greeting sends (9 / 18); weekends always skipped
- A Postgres service must be provisioned (Zeabur service; schema auto-creates on first use)

---

## Security Considerations

1. **Credentials never live in this repo**: with `FP_MCP_INTERNAL_KEY` set, login validates against firstpage-mcp (`POST /admin/api/authenticate`, PBKDF2 in the mcp's users module); the `AUTH_USERS` legacy fallback applies when the key is unset. Either way credentials stay in gitignored env/config — never in source or `README.md`.
2. **API keys in client components**: OpenRouter/Ahrefs/HubSpot tokens are server-side only (`lib/`). Never pass them to client components or `components/ui/`.
3. **Cookie is not httpOnly in client-side NavBar**: The auth cookie is read by client-side JavaScript in `NavBar.tsx` to show/hide navigation. The `httpOnly` flag is set to `false` in the login route to allow this.
4. **No HTTPS enforcement**: The auth cookie sets `secure: true` only in production (`NODE_ENV === 'production'`). Ensure production deployments use HTTPS.
5. **Server deployment required**: This app requires a Next.js server. Do not deploy to pure static hosts (GitHub Pages, S3 static hosting) — the proxy, API routes, and auth will not work. Use Vercel, a Node.js server, or Docker.
6. **Gateway keys stay server-side**: `OPENROUTER_MANAGEMENT_KEY` never reaches client code. Issued sub-keys are returned once (plaintext) and only the OpenRouter `hash` is stored in Postgres — a leaked sub-key can be revoked from `/gateway` without touching the master key. Co-workers' sub-keys only authorize chat completion calls on OpenRouter's endpoint; they cannot manage keys or read the management key.

---

## Adding a New Tool

1. Create `app/tools/<slug>/tool.ts` with a `ToolManifest` (slug, name, description, category, owner, status, icon)
2. Add the manifest to the static index in `lib/registry.ts` (one import + array entry). External standalone tools: add an inline manifest with `externalLink` instead (no folder/page needed).
3. Add `app/tools/<slug>/page.tsx` (the UI) and `app/api/tools/<slug>/route.ts` (server work — call `logUsage()` on every run)
4. Rebuild: `pnpm build` — the tool appears in `/toolbox` automatically

Two tool patterns (see `lib/AGENTS.md` + `components/AGENTS.md`):

- **Data tools** (read-only views): the route calls `runQuery({ toolSlug, fetch })` — cookie attribution + `logUsage()` (0 tokens); GET returns picker options. Page = form + `useToolApi` + `ResultView`. Examples: `gsc-explorer`, `psi-auditor`, `lead-scorer`.
- **LLM tools** (generated deliverables): the route gathers its own data (often via `lib/client-data.ts`), then `runLlmTool({ toolSlug, brief, refine, generate })` — logs usage, persists to `tool_outputs`, returns `outputId`. Page has a refine bar + `OutputHistory`. Examples: `meta-generator`, `meeting-prep`, `monthly-report`.
- **Job-based tools** (long-running): the route creates a background job (in-memory registry, e.g. `lib/onsite-audit/jobs.ts`) and returns `jobId`; the client polls `GET ?jobId=` for progress until "done". POST still calls `logUsage()`. Example: `onsite-audit` (full-site crawl + checklist).
- **Cross-tool links**: connect tools with `prefillUrl` (`?url= ?domain= ?keyword= ?site= ?property= ?client=`) — e.g. `lead-scorer` → `meeting-prep` → `proposal`, or `keyword-gap` → `content-brief` → `meta-generator`.

Content (case studies, brand guide) lives in `content/` as markdown — edit those to change deck/proposal material.

---

## Key Dependencies & Compatibility

- **Next.js 16** requires React 19. Do not downgrade React to 18.
- **Next.js 16 build requires TypeScript 6** (`next build` fails with TS 7: "TypeScript 7.x does not provide the compiler API required by Next.js"). Stay on TS 6 until Next.js officially supports TS 7.
- **ESLint must stay on 9**, not 10. `eslint-config-next` pulls `eslint-plugin-react`, whose peer range tops out at ESLint `^9.7`. ESLint 10 crashes the linter (`context.getFilename is not a function`).
- **Tailwind CSS v4** uses a new configuration style (`@import "tailwindcss"`, `@theme inline`) — do not use the old `tailwind.config.js` format.
- The project uses **pnpm**. Using npm or yarn may produce lockfile conflicts.

---

## Common Pitfalls

1. **Build fails with image optimization error**: Make sure `images.unoptimized: true` stays in `next.config.ts`.
2. **Toolbox filters don't survive navigation**: `ToolboxView` reads initial `q`/`cat` from the server-rendered `searchParams` prop, writes updates via `router.replace`, and syncs browser back/forward with a `popstate` listener — keep those three paths in sync when touching the filter logic.
3. **Auth redirect loops**: If the proxy redirects infinitely, check that `/toolbox` and `/login` are listed as public paths in `proxy.ts`.
4. **Hydration mismatch in NavBar**: `NavBar` renders a minimal placeholder on the server (`mounted === false`) and fetches `/api/me` only after mount — keep this pattern; never read `document.cookie` client-side.
5. **Toolbox card opens the wrong target**: `externalLink` tools (e.g. FAQ Schema Generator) intentionally link out in a new tab; everything else links to `/tools/<slug>`. To add another external tool, append an `externalLink` manifest to `lib/registry.ts` — no `app/tools/<slug>/` folder needed.

---

## OpenCode / ECC Integration

This project includes an **Everything Claude Code (ECC)** plugin configuration for OpenCode.

### Configuration

- **Config file**: `.opencode/opencode.json`
- **Plugins**: `.opencode/plugins/` (hook-based automations)
- **Agents**: `.opencode/prompts/agents/` (specialized subagents)
- **Commands**: `.opencode/commands/` (slash command templates)

### Available Commands

| Command | Description | Agent |
|---------|-------------|-------|
| `/plan` | Create implementation plan | planner |
| `/tdd` | TDD workflow (80%+ coverage) | tdd-guide |
| `/code-review` | Review code quality | code-reviewer |
| `/security` | Security audit | security-reviewer |
| `/build-fix` | Fix TypeScript/build errors | build-error-resolver |
| `/e2e` | Generate/run E2E tests | e2e-runner |
| `/refactor-clean` | Remove dead code | refactor-cleaner |
| `/update-docs` | Update documentation | doc-updater |

### Referenced Skills (External)

The following ECC skills are referenced from the external ECC installation:

- **coding-standards** — Naming, immutability, error handling, code quality
- **frontend-patterns** — React 19, Next.js, hooks, state management
- **security-review** — Auth, input validation, secrets management
- **tdd-workflow** — Test-driven development, 80%+ coverage
- **api-design** — REST conventions, response formats, error handling

### Setup

No additional setup required. The `.opencode/` directory is self-contained (324KB). Skills are loaded from the external ECC installation at `/home/glasschan/everything-claude-code/skills/`.


## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues in this repo. Use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels map by name: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
