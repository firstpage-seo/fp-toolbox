# lib/ — Report data and authentication

## Purpose

Server-side analytics access, report aggregation, authentication, and caching.

## Ownership

- `dashboard.ts` resolves dates and aggregates GA4, GSC, Ahrefs, and PageSpeed data for `/`.
- `mcp.ts` calls firstpage MCP for GA4, GSC, and PageSpeed. Do not reintroduce the retired Google PSI REST API.
- `ahrefs.ts` supplies keyword and AI visibility data.
- `auth.ts` validates credentials and sessions through firstpage-mcp, with `AUTH_USERS` legacy mode when `FP_MCP_INTERNAL_KEY` is unset.
- `cache.ts` caches external API results and failures in process. Entries reset on restart; no database is required.
- `utils.ts` supplies class-name merging to shared UI primitives.

## Local Contracts

- Secrets remain in server-side environment variables. No API key goes to client components.
- Analytics failures degrade to a visible source error without failing the whole report.
- GSC summary uses `getDashboardGsc()` for its selected range and never runs automatically.

## Work Guidance

- Use explicit return types on exported functions and preserve date-range comparison semantics.

## Verification

- `pnpm lint`
- `pnpm build`

## Child DOX Index

- No child AGENTS.md files under `lib/`.
