# Spec: Sales-Oriented Toolbox Platform

## Problem Statement

The current toolbox is a showcase shell: it presents a frozen inventory of 26 NocoDB records, most of which are stale or unused. Nearly every tool is unmaintained, several marked "Active" are actually retired (n8n flows), and none produce real value for the team. The tool data lives in NocoDB while the tools themselves live elsewhere, so the two drift apart with no forced sync. The metrics shown are human-claimed numbers (`hours_saved_per_month`) with no basis in real usage, so the "boss view" has no credibility.

The team's real need is a **sales weapon**: tools that help the sales/AM team win clients (pitch decks, proposals, audits), not an internal showcase. Internal tools are secondary and only insofar as they support sales.

## Solution

Turn the toolbox into a **sales-oriented tool platform** where tools are built **inside** the application itself, so the registry can never drift from reality.

- **Code is the source of truth.** Each tool is a self-contained folder (`app/tools/<slug>/`) containing a `tool.ts` manifest (name, description, category, owner, status), a page, and an API route. At build time the app scans these folders and auto-generates the live tool directory. A tool existing in code = it appears in the directory; delete it = it disappears. No possibility of drift.
- **Pitch Deck and Proposal are one pipeline.** The same client brief + case-study asset library feeds a template that produces either a pitch deck or a proposal. Output is HTML first, with one-click PDF export.
- **Real metrics.** Every tool invocation is logged (user, tool, timestamp, tokens, cost) to Postgres. The dashboard aggregates from actual usage records — no hand-claimed numbers.
- **Per-user identity.** A `AUTH_USERS` env map (`name:password` list) so metrics can be attributed to a person.
- **Sales data sources.** PageSpeed Insights API (free) and Ahrefs API for competitor analysis feed the pitch deck.
- **LLM via OpenRouter** using `deepseek/deepseek-v4-flash-0731` for both tiers.
- **Deployment:** localhost dev → git push → Zeabur (always-on). Postgres via podman `postgres:18-alpine` for dev, and a managed Postgres service on Zeabur.

## User Stories

1. As a salesperson, I want to open a pitch-deck tool and enter a client brief, so that I can generate a polished pitch deck without starting from a blank slide.
2. As a salesperson, I want the pitch deck to include a competitor-vs-client comparison from Ahrefs, so that I can present a compelling "you're losing to X" case.
3. As a salesperson, I want the pitch deck to include a live PageSpeed Insights score of the client's site, so that I can prove the technical opportunity with real data.
4. As a salesperson, I want to export the generated pitch deck as a PDF, so that I can send a polished document to the client.
5. As a salesperson, I want to regenerate the deck after tweaking the inputs (client name, pain point, case-study choice), so that I can adjust the pitch without hand-editing.
6. As a salesperson, I want to generate a full proposal draft from the same client brief, so that I can produce a proposal without writing from scratch.
7. As a team lead, I want every tool use to be logged with the user, so that I can see which tools are actually used and by whom.
8. As a team lead, I want the dashboard to show real usage metrics (count, active users, cost) aggregated from logs, so that I can report credible numbers to management.
9. As a team lead, I want per-user login, so that tool usage is attributed to the right person.
10. As a developer, I want to add a new tool by creating a folder with a manifest, so that the directory auto-updates without manual registry edits.
11. As a developer, I want tool metadata to live in code, so that the directory can never drift from the deployed tools.
12. As a salesperson, I want to see the toolbox as a directory of usable tools, so that I can find and launch the right tool for the task.
13. As a manager, I want a processed presentation view driven by real metrics, so that I can show stakeholders without hand-claimed numbers.
14. As a user, I want to revisit the FAQ tool which is standalone, so that I keep it discoverable via a link rather than re-hosting it.
15. As a salesperson, I want the Proposal tool to reuse the case-study library, so that proposals are consistent with the pitch decks.

## Implementation Decisions

### Tool registry as code (inversion of source of truth)
- Replace the NocoDB-driven registry with a code-driven registry. Each tool lives in `app/tools/<slug>/` with a `tool.ts` manifest exporting `{ slug, name, description, category, owner, status, model?, ... }`.
- A build-time scan (Node filesystem read at module load / build) collects all manifests into a `ToolRegistry`. The directory page and any listing render from this registry.
- NocoDB is retired as the registry. It may still be referenced for legacy data migration but is no longer the source of truth.

### Tool contract
Each tool folder contains:
- `tool.ts` — manifest (metadata) + optional server-side logic export.
- `page.tsx` — the tool's UI (client or server component).
- `route.ts` — API route(s) for the tool's server-side work (LLM calls, data fetches).
- Optional `assets/` for images/docs.

### Pitch Deck / Proposal pipeline (shared core)
- A shared `client brief` schema: client name, industry, objective, target market, budget, website, notes.
- A shared case-study library stored as markdown in code (`content/case-studies/`), plus a brand guide (`content/brand/`).
- A `generateDeck()` / `generateProposal()` core that:
  1. Builds a system prompt from brand guide + case studies + the selected template.
  2. Calls OpenRouter (`deepseek/deepseek-v4-flash-0731`) with the client brief.
  3. Returns structured slide/section content.
- **HTML-first output**: each slide/section is rendered as HTML governed by CSS (the template). Rendering is deterministic — no AI layout judgment.
- **PDF export**: server-side HTML→PDF (e.g. `puppeteer` or `playwright`).
- Google Slides API export is explicitly out of scope (user's testing showed AI-generated slide layouts garble).

### Data sources
- `lib/psi.ts` — PageSpeed Insights API wrapper (free, no key needed for the public API; returns Core Web Vitals + performance score).
- `lib/ahrefs.ts` — Ahrefs API v3 wrapper for competitor/keyword data (server-side, key in env).
- These are injected into the deck generation as structured context.

### Metrics (Postgres)
- `lib/usage.ts` — `logUsage()` helper: inserts a row (user, tool_slug, action, duration_ms, prompt_tokens, completion_tokens, cost_usd, created_at) into Postgres.
- Usage table `usage_events`. Aggregation via SQL for the dashboard.
- A minimal Postgres client (e.g. `pg` package) configured via `DATABASE_URL`.

### Auth (per-user)
- Replace single shared credential with `AUTH_USERS` env: comma-separated `name:password` pairs. Login route validates against this map and sets `fp-auth=<username>` cookie (httpOnly: false so the NavBar can read it).
- Middleware reads the cookie username for attribution.

### Env vars
- `AUTH_USERS` (replaces AUTH_USER/AUTH_PASS usage)
- `DATABASE_URL` (Postgres)
- `OPENROUTER_API_KEY`
- `AHREFS_API_KEY`
- Existing `NEXT_PUBLIC_*` NocoDB vars become unused and can be removed.

### Pages
- `/` — repurposed: internal metrics dashboard (authenticated) OR personal tool home.
- `/toolbox` — live tool directory, auto-generated from the registry.
- `/tools/[slug]` — a tool's page.
- `/tools/pitch-deck`, `/tools/proposal` — the two pilot tools.
- Remove: `/ai-projects`, `/automation-projects`, `/systems`, `/architecture`. Migrate case-study content into `content/case-studies/`.
- `/presentation` — rebuild to render from real metrics.

## Testing Decisions

- **External behavior only.** Tests assert on the observable contract (given a manifest, the registry lists it; given a brief, the generator returns expected section structure; PSI wrapper returns a score; PDF export produces a file).
- Mock the network: OpenRouter, Ahrefs, PSI, and Postgres are all mocked in tests. No real API calls in CI.
- Modules to test:
  - `lib/registry` — manifest scanning + directory listing.
  - `lib/generator` — prompt building + section structure from a mock LLM response.
  - `lib/psi` / `lib/ahrefs` — wrappers with mocked fetch.
  - `lib/usage` — logUsage insert + aggregation with mocked DB.
  - login route — per-user auth with mocked env.
- Prior art: the repo has no test framework installed. The Proposal Advisory prototype used Vitest, which is a good precedent for this Next.js codebase. Install Vitest.

## Out of Scope

- Google Slides API export (deferred indefinitely; user's testing showed AI layout garbling).
- Per-tool role-based access control.
- Screaming Frog crawl integration (v1.1; needs a server-side crawl worker).
- Google Search Console API integration (second phase; needs per-client grant).
- New tools beyond Pitch Deck and Proposal for the MVP.
- Migrating all 26 legacy NocoDB tools into the code registry (only the two pilot tools are built; the rest are marked deprecated/retired in the migration).
- Consumer-facing (client-usable) tools (phase B of the sales taxonomy).

## Further Notes

- The two pilot tools are Pitch Deck and Proposal (one pipeline, two templates).
- Proposal Advisory System (GitHub `FirstPage-Glass/Proposal-Advisory-System`) is NOT migrated as-is — it's a chat-advisory tool, not a deliverable generator. Its patterns (OpenRouter proxy, Jina scraping, model allowlist, export) are reused in the new pipeline.
- FAQ tool remains standalone — surfaced in the toolbox as an external link.
- Deployment target: Zeabur (managed, always-on). Postgres: podman `postgres:18-alpine` for dev; a managed Postgres service on Zeabur for prod.
- `AUTH_USERS` content is supplied by the user at build time; MVP can start with a placeholder user.