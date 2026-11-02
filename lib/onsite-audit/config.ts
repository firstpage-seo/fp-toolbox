// Onsite SEO Audit — configuration. Server-side only.

/** Self-hosted browserless base URL (renders JS-heavy pages). */
export const BROWSERLESS_URL = process.env.BROWSERLESS_URL || "";

/** Browserless token (server-side secret). */
export const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || "";

/** Max pages to crawl per audit (same-origin BFS). Key pages only — 30-50 is enough for an audit. */
export const MAX_PAGES = clampInt(process.env.ONSITE_MAX_PAGES, 50, 10, 1000);

/** Concurrent browserless render requests. */
export const CRAWL_CONCURRENCY = clampInt(process.env.ONSITE_CRAWL_CONCURRENCY, 8, 1, 20);

/** Only pages deeper than this many hops from the seed get treated as "deep". */
export const CRAWL_DEPTH_CAP = clampInt(process.env.ONSITE_CRAWL_DEPTH, 6, 1, 20);

/** 30-day default window for GSC/GA4 reports. */
export const DEFAULT_DAYS = 30;

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}
