# app/ — Organic Performance routes

## Purpose

The authenticated FirstPage HK Organic Performance report and its sign-in flow.

## Ownership

- `page.tsx` renders `/` with exact 7, 30, or 90 day presets or an inclusive custom date range.
- `layout.tsx`, `globals.css`, `error.tsx`, and `components/NavBar.tsx` own the application shell.
- `login/` and `api/login`, `api/logout`, `api/me` own sign-in and account state.
- `api/dashboard/panels` serves PageSpeed; `api/dashboard/gsc-summary` generates the optional GSC summary.
- Root `proxy.ts` guards page routes; `lib/AGENTS.md` owns data and auth clients.

## Local Contracts

- `/` requires a valid session; `/login` is public. Unauthenticated page requests redirect to `/login`.
- Dashboard API routes check the session themselves. GSC summary runs only on explicit POST and keeps `OPENROUTER_API_KEY` server-side.
- The report shows one selected GA4, GSC, Ahrefs, or PageSpeed panel at a time. Date presets end on the latest finalized GSC date.
- The NavBar fetches `/api/me` after mount and does not read cookies in client code.

## Work Guidance

- Prefer server components; use client components for filters, controls, charts, and account interactions.
- Use the shared brand tokens in `globals.css` and report widgets in `components/dashboard/`.

## Verification

- `pnpm lint`
- `pnpm build`

## Child DOX Index

- No child AGENTS.md files under `app/`.
