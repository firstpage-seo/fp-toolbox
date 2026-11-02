# components/ — Report UI

## Purpose

Reusable components for the Organic Performance report and sign-in page.

## Ownership

- `dashboard/` owns date selection, source filter, GA4/GSC/Ahrefs/PageSpeed panels, charts, loading skeletons, and GSC summary UI.
- `ui/` owns the shared Card, Button, Input, table, and account Popover primitives.

## Local Contracts

- `WebsiteSection.tsx` exports `OrganicTrafficSection`, the report body used by `/`.
- `SourceFilter.tsx` displays one analytics source panel at a time; GSC is the default.
- `PsiPanel.tsx` loads PageSpeed through `/api/dashboard/panels` after hydration so slow audits do not hold the report shell.
- `GscSummary.tsx` calls `/api/dashboard/gsc-summary` only when the user requests a summary.

## Work Guidance

- Keep brand styling in the shared UI and dashboard components. Tailwind classes must be statically discoverable.

## Verification

- `pnpm lint`
- `pnpm build`

## Child DOX Index

- No child AGENTS.md files under `components/`.
