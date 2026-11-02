# app/ — App Router surface

## Purpose

Next.js App Router surface of the toolbox platform: pages, API routes, tool UIs, root layout, global styles, and the per-tool folders.

## Ownership

- Owns: `app/page.tsx` (metrics dashboard), `app/layout.tsx` (top strip shows Hong Kong only), `app/globals.css`, route folders (`login/`, `toolbox/`, `leads/`, `gateway/`, `api/login/`, `api/logout/`, `api/gateway/`, `api/tools/`), `app/tools/<slug>/` (tool folders: `tool.ts` manifest + `page.tsx`), `app/components/NavBar.tsx`, `app/favicon.ico`.
- Root owns: `proxy.ts` (auth guard; formerly `middleware.ts`, renamed in Next.js 16).
- Data fetching lives here, but data sources live in `lib/` (see `lib/AGENTS.md`).

## Local Contracts

Routing map:

| Route | Type | Auth | Data source |
|-------|------|------|-------------|
| `/` | Server | Yes | `lib/dashboard.ts` `getWebsiteData(days, range)` supplies Organic Traffic Performance (GA4, GSC, PSI, Ahrefs). The organic section streams under `<Suspense>`; the pagehead shows no portfolio inventory count. `?days=7|30|90` controls exact-length preset ranges ending on the latest finalized GSC date (default 30); `?start=YYYY-MM-DD&end=YYYY-MM-DD` selects an inclusive custom range up to the configured latest data date. The report displays the inclusive selected dates and comparison dates; it always shows the latest finalized GSC date in an orange notice and, when data ends early, the effective GSC period and equal-length comparison; `SourceFilter` switches GA4, GSC, Ahrefs, and PageSpeed panels in place, showing one source at a time. Website Performance, Sales Performance, and Lead Quality are not rendered on the homepage. |
| `/api/dashboard/gsc-summary` | API | Yes (cookie) | On-demand POST with validated start/end dates. Fetches GSC only for the selected period, then calls OpenRouter `deepseek/deepseek-v4.1-flash` using server-only `OPENROUTER_API_KEY`; returns a structured traffic summary, key successes, and content roadmap or a specific error. No automatic generation. |
| `/toolbox` | Server shell + client view | No | `lib/registry.ts` (code); client `ToolboxView` (components/toolbox/) handles search + category via `?q=&cat=` |
| `/tools/<slug>` | Client | Yes | per-tool API route; 26 tools across SEO Research / SEO Technical / Sales / SEO Content / Content / Operations (see Child DOX below) |
| `/tools/onsite-audit` | Client | Yes | full-site audit: POST starts a background job → `jobId`, GET `?jobId=` polls progress → result, GET `?outputId=` loads a past saved run (+ its manual-action states), bare GET lists run history. Crawl via self-hosted browserless (`lib/onsite-audit/`) + GSC/GA4/PSI/Ahrefs + LLM summary; every run persists to `tool_outputs`. Manual actions are interactive (status select + notes) via `/api/tools/onsite-audit/actions` (POST upsert / GET by domain), keyed per client domain. Page follows its dedicated mockup `docs/design-ref/onsite-audit.html` (hero + run-card + progress + result stats/summary + manual checklist + verdict filters + collapsible sections + history) — not the generic tool-page header |
| `/leads` | Server | Yes (cookie) | `lib/hubspot.ts` `getSpamReport(30)` (spam report, memoized 10 min) + `lib/greeting.ts` `getGreetingStats(30)` (auto-greeting KPIs: sent total / 30d / queued / retrying + live-or-dry-run badge) + `listRecentGreetings(15)` (recently sent / retrying table). Banner + headline + KPI rows + spam-reason bars + worst-source domains |
| `/login` | Server wrapper + client form | No | Server computes the MCP register URL (`{FP_MCP_URL}/admin/register`) and passes it to client `LoginForm`; posts to `/api/login` |
| `/api/login`, `/api/logout` | API | No | SSO vs firstpage-mcp (`AUTH_USERS` fallback); login sets shared `fp_session` (domain, SSO identity) + `fp-auth` (host, legacy/attribution); logout clears both |
| `/api/me` | API | No (reads session) | `{loggedIn, username, isAdmin}` from `getSessionUser()` — powers `NavBar` auth state |
| `/api/gateway` | API | Yes (cookie) | Team-key gateway — OpenRouter BYOK (`lib/gateway/`): GET = role-scoped views (admin: all; champion: own team; member: own key); POST = create team (admin); PATCH `/teams/<id>` = adjust credit/max_keys (admin); POST `/teams/<id>/keys` = issue key w/ limit + members (champion/admin); DELETE `/keys/<id>` = revoke; POST/DELETE `/keys/<id>/members` = assign/unbind user |
| `/api/tools/<slug>` | API | Yes (cookie) | GET = picker options (data tools) or history list (LLM tools); POST = run / refine |
| `/api/hubspot/recent-leads` | API | Yes (cookie) | HubSpot contacts, spam-filtered + 1h cache |
| `/gateway` | Server + client | Yes | Team-key management (OpenRouter BYOK): `GatewayClient` (`components/gateway/`) — admin view (all teams, edit credit/max_keys, create-team form, alerts), champion view (own team: issue/revoke/assign keys, plaintext shown once, per-key usage), member view (own key card only). Usage shown is **effective (Credits + BYOK)**; monthly limits renew on the 1st |

- Server components are the default; mark `"use client"` only when state, effects, or browser APIs are required.
- **Never put API keys in client components** — OpenRouter/Ahrefs keys are server-side only (`lib/`).
- `NavBar` shows Overview as the only navigation link (plus account/login controls) and renders a minimal placeholder until mount (`mounted === false`) to avoid hydration mismatch, then fetches `/api/me` for auth state. Preserve this pattern — no client-side cookie reads. Logged-in state shows a `Popover` account menu (avatar initials trigger → full username, "Signed in", Logout).
- Auth flow: `/login` → `POST /api/login` → shared httpOnly `fp_session` (domain=`FP_SESSION_DOMAIN`) — the identity when `FP_MCP_INTERNAL_KEY` is set — plus host-only `fp-auth` (legacy mode / usage attribution). The mcp token only lives ≤8h, so the route keeps an existing live session for the same email instead of overwriting it (overwriting a 30-day portal session signed colleagues out mid-day); a different email still replaces it. Identity is validated on every request (proxy + routes) via `getSessionUser()`/`currentUsername()` in `lib/auth.ts` against mcp `GET /admin/api/session` (SSO) or `AUTH_USERS` (legacy); fetch errors degrade to unauthenticated. `proxy.ts` redirects unauthenticated users to `/toolbox`; logout clears both cookies. `/toolbox`, `/login`, `/api/*` stay public.
- Tool pages are thin: form + `useToolApi` + `ResultView` (data tools) or custom render + refine bar + `OutputHistory` (LLM tools). Cross-tool links use `prefillUrl` (`?url= ?domain= ?keyword= ?site= ?property= ?client=`) — see `components/AGENTS.md`.
- Adding a new tool: create `app/tools/<slug>/` (manifest + page), API route `app/api/tools/<slug>/route.ts`, and register the manifest in `lib/registry.ts`. Data tools call `runQuery`; LLM tools call `runLlmTool`. Job-based tools (long-running, e.g. `onsite-audit`) use a background job registry + client polling instead. See root AGENTS.md "Adding a New Tool".

## Work Guidance

- Layout max-width: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
- Build from `components/ui/` atoms: `Card` (white/slate), `StatCard` (KPI, fp tones for emphasis), `PageHeader` (full-width blue-gradient banner; `ToolPageHeader` in `lib/tool-icons.tsx` for tool pages — SVG tile + meta chips), `Badge` (static color map), `Button`/`Input` (client forms). Extend `components/ui/` rather than hand-copying card classes.
- Tool icons are stroke SVGs from `lib/tool-icons.tsx` (`ToolIcon`); category colors via `categoryColorClass`/`categoryBgClass`/`categoryBarClass`. Brand tokens in `globals.css` (`@theme inline`): `navy`/`coral`/`blue`/`surface`/`muted`/`border` + `--grad-cta`/`--grad-banner`, plus the `fp-*` blue scale. Font is Open Sans (`--font-open-sans`). Tailwind v4 — do not create a `tailwind.config.js`.
- `globals.css` also carries shadcn/ui token vars (`--card`/`--primary`/`--ring`/…) mapped onto brand tokens in `:root` + `@theme inline`. `--accent` stays coral (via `--color-coral`); shadcn's hover accent is the `--color-accent` literal (fp-50). `--muted`/`text-muted` = gray text — never use `bg-muted` for backgrounds (use `bg-surface`). `components.json` configures the shadcn CLI; keep new primitives on the same tokens.
- `images.unoptimized: true` must stay in `next.config.ts`; build output goes to `dist/`, not `.next/`.

## Verification

- `pnpm build` — must pass (TypeScript strict + lint).
- `pnpm lint` — ESLint 9, `eslint-config-next`.
- No test framework exists.

## Child DOX Index

- No child AGENTS.md files under `app/`.
