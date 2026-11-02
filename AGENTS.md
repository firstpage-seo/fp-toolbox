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

- `app/AGENTS.md` — Organic Performance routes, authentication UI, and styling.
- `components/AGENTS.md` — Report widgets and shared UI primitives.
- `lib/AGENTS.md` — Analytics clients, aggregation, authentication, and caching.
- Root-owned: `proxy.ts`, `Dockerfile`, configuration files, `public/`, and `README.md`.

---

# FirstPage HK Organic Performance

This is a single-report Next.js application for FirstPage Hong Kong organic performance. The only page besides sign-in is `/`, showing GA4, Google Search Console, Ahrefs, and PageSpeed data for firstpage.hk. The report requires authentication. There is no toolbox, gateway, lead management, or tool inventory.

## Runtime

- Next.js 16, React 19, TypeScript 6, Tailwind CSS 4, pnpm.
- `pnpm dev` starts the local server; `pnpm lint` and `pnpm build` verify changes.
- `dist/` is the Next.js server build; deployment requires a Node-compatible host.
- External analytics calls are cached in process for one hour; the cache resets on restart. No database is required.
- Keep API keys in server-side environment variables and never commit `.env*` files.

## Configuration

- `FP_MCP_URL`, `FP_MCP_INTERNAL_KEY`, `FP_SESSION_DOMAIN`: shared firstpage-mcp sign-in. Without the internal key, `AUTH_USERS` supplies legacy local credentials. `ADMIN_USERS` is not needed.
- `FP_MCP_API_KEY`: GA4, GSC, and PageSpeed data through firstpage MCP.
- `AHREFS_API_KEY`: keyword and AI visibility data.
- `OPENROUTER_API_KEY`: on-demand GSC traffic summary; no generation occurs until requested.
- Optional target overrides: `DASHBOARD_TARGET_URL`, `DASHBOARD_TARGET_DOMAIN`, `DASHBOARD_GSC_SITE`, `DASHBOARD_GA4_PROPERTY`, `DASHBOARD_DATA_END_DATE`.

## Routing and security

- `/` is the authenticated report. `/login` is public. `/api/login`, `/api/logout`, and `/api/me` support authentication. `/api/dashboard/panels` supplies PageSpeed; `/api/dashboard/gsc-summary` generates the optional GSC summary.
- `proxy.ts` sends unauthenticated page requests to `/login`. API routes perform their own session checks. Auth uses the shared httpOnly `fp_session` cookie in SSO mode or `fp-auth` in legacy mode.
- Secrets remain server-side in `lib/`; client components receive only rendered metrics and API results.
