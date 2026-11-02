import { cached } from "./cache";
import { getCompetitorKeywords, getAiVisibility } from "./ahrefs";
import type { CompetitorResult, AiVisibilityResult } from "./ahrefs";
import { getMcpPsi, getMcpGsc, getMcpGscDailyRows, getMcpGscPages, getMcpGa4 } from "./mcp";
import type { McpPsiResult, GscRow, McpGscDailyPoint, Ga4Report } from "./mcp";

// ponytail: dashboard targets are env-configurable, defaulting to FirstPage HK.
const TARGET_URL = process.env.DASHBOARD_TARGET_URL || "https://firstpage.hk";
const TARGET_DOMAIN = process.env.DASHBOARD_TARGET_DOMAIN || "firstpage.hk";
const GSC_SITE = process.env.DASHBOARD_GSC_SITE || "https://www.firstpage.hk/";
const GA4_PROPERTY = process.env.DASHBOARD_GA4_PROPERTY || "374723776"; // firstpage.hk

// GSC only accepts YYYY-MM-DD; the sandbox clock runs ~1y ahead of Google's
// data window, so allow an explicit end date override (production: unset).
export function dataEndDate(): string {
  return (
    process.env.DASHBOARD_DATA_END_DATE ||
    new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10)
  );
}
export async function latestFinalizedGscDate(): Promise<string> {
  const end = dataEndDate();
  const start = new Date(Date.parse(`${end}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  try {
    const rows = await cached(`mcp-gsc-latest:${GSC_SITE}:${end}`, () => getMcpGscDailyRows(GSC_SITE, start, end));
    return rows.map((row) => row.keys?.[0] ?? "").filter(Boolean).sort().at(-1) ?? end;
  } catch {
    return end;
  }
}
export interface DashboardDateRange { startDate: string; endDate: string; days: number }

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function dashboardDateRange(days: number, start?: string, end?: string): DashboardDateRange {
  const latest = dataEndDate();
  const valid = (date: string | undefined) => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date);
  if (valid(start) && valid(end) && start! <= end! && end! <= latest) {
    const length = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
    return { startDate: start!, endDate: end!, days: length };
  }
  return { startDate: shiftDate(latest, -(days - 1)), endDate: latest, days };
}

export function previousDashboardDateRange(range: DashboardDateRange): DashboardDateRange {
  return {
    startDate: shiftDate(range.startDate, -range.days),
    endDate: shiftDate(range.startDate, -1),
    days: range.days,
  };
}
export interface GscTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscLandingPageRow {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** One day of GSC clicks — feeds the Organic clicks KPI sparkline. */
export type GscDailyPoint = McpGscDailyPoint;

export interface Ga4TrendPoint {
  date: string;
  activeUsers: number;
  sessions: number;
}

export interface WebsiteDeltas {
  ga4Users: number | null;
  ga4Sessions: number | null;
  gscClicks: number | null;
  gscImpressions: number | null;
  gscCtr: number | null;
  gscPosition: number | null;
}

/**
 * Website-performance half of the dashboard. Fetching is split per zone so the
 * `/` page can stream each section independently: WebsiteSection reads exactly
 * these fields (plus targets + rangeDays).
 */
export interface WebsiteData {
  psi: {
    result: McpPsiResult | null;
    error: string | null;
  };
  ahrefs: {
    configured: boolean;
    result: CompetitorResult | null;
    error: string | null;
  };
  aiVisibility: {
    result: AiVisibilityResult | null;
    error: string | null;
  };
  gsc: {
    siteUrl: string;
    totals: GscTotals | null;
    queries: GscQueryRow[];
    landingPages: GscLandingPageRow[];
    pagesError: string | null;
    availableRange: DashboardDateRange | null;
    daily: GscDailyPoint[];
    error: string | null;
  };
  ga4: {
    propertyId: string;
    totals: { activeUsers: number; sessions: number } | null;
    trend: Ga4TrendPoint[];
    error: string | null;
  };
  targets: { url: string; domain: string };
  rangeDays: number;
  dateRange: DashboardDateRange;
  comparisonRange: DashboardDateRange;
  deltas: WebsiteDeltas;
}

/** Percent change, null when the previous baseline is zero. */
function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function sumGsc(rows: GscRow[]): GscTotals {
  const clicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const avgPos = impressions
    ? rows.reduce((s, r) => s + (r.position ?? 0) * (r.impressions ?? 0), 0) / impressions
    : 0;
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: avgPos,
  };
}

function parseGa4(report: Ga4Report): {
  totals: { activeUsers: number; sessions: number } | null;
  trend: Ga4TrendPoint[];
} {
  const uIdx = report.metricHeaders.findIndex((h) => h.name === "activeUsers");
  const sIdx = report.metricHeaders.findIndex((h) => h.name === "sessions");
  const trend: Ga4TrendPoint[] = [];
  let users = 0;
  let sessions = 0;
  for (const row of report.rows) {
    const u = Number(row.metricValues[uIdx]?.value ?? 0);
    const s = Number(row.metricValues[sIdx]?.value ?? 0);
    users += u;
    sessions += s;
    if (row.dimensionValues?.[0]?.value) {
      trend.push({ date: row.dimensionValues[0].value, activeUsers: u, sessions: s });
    }
  }
  trend.sort((a, b) => a.date.localeCompare(b.date));
  return {
    totals: report.rows.length ? { activeUsers: users, sessions } : null,
    trend,
  };
}

// PSI runs a live Lighthouse audit and can be slow, sometimes hung entirely
// (observed >30s no-response). Memoize both the result AND the failure for 6h
// (via cached()'s per-key failure TTL) so a stuck psi_audit degrades to the
// inline error card once instead of pinning the website zone every render.
const PSI_TTL_MS = 6 * 60 * 60 * 1000;
let psiFailureAt = 0;
let psiFailureMsg: string | null = null;

/** PageSpeed outcome — result plus a tolerant error string. */
export interface WebsitePsi {
  result: McpPsiResult | null;
  error: string | null;
}

/** PageSpeed audit, resolved INDEPENDENTLY of the website zone. psi_audit runs a
 * live Lighthouse check and routinely takes >30s (sometimes hangs) — so it
 * streams through its own Suspense in WebsiteSection and never blocks the
 * GSC/GA4/Ahrefs cards. Result AND failure are memoized PSI_TTL_MS so an
 * expired key re-runs it at most every 6h. */
export async function getWebsitePsi(): Promise<WebsitePsi> {
  if (psiFailureAt && Date.now() - psiFailureAt < PSI_TTL_MS) {
    return { result: null, error: psiFailureMsg };
  }
  try {
    const result = await cached("mcp-psi", () => getMcpPsi(TARGET_URL), PSI_TTL_MS, PSI_TTL_MS);
    psiFailureAt = 0;
    psiFailureMsg = null;
    return { result, error: null };
  } catch (err) {
    psiFailureAt = Date.now();
    psiFailureMsg = err instanceof Error ? err.message : String(err);
    return { result: null, error: psiFailureMsg };
  }
}

async function fetchGscRows<T>(
  key: string,
  fn: () => Promise<T[]>
): Promise<{ rows: T[]; error: string | null }> {
  try {
    return { rows: await cached(key, fn), error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export interface GscBundle {
  totals: GscTotals | null;
  prevTotals: GscTotals | null;
  queries: GscQueryRow[];
  landingPages: GscLandingPageRow[];
  pagesError: string | null;
  availableRange: DashboardDateRange | null;
  daily: GscDailyPoint[];
  error: string | null;
}

/**
 * GSC search performance for the selected inclusive date range. The previous
 * window is the immediately preceding window of the same length.
 * Current + daily + previous windows are fetched in parallel; daily and
 * previous are best-effort (deltas/sparkline just go null/empty on failure).
 */
export async function getDashboardGsc(range: DashboardDateRange): Promise<GscBundle> {
  const currentStart = range.startDate;
  const daily = await fetchGscRows(
    `mcp-gsc-daily-rows:${GSC_SITE}:${currentStart}:${range.endDate}`,
    () => getMcpGscDailyRows(GSC_SITE, currentStart, range.endDate)
  );
  const availableEnd = daily.rows.at(-1)?.keys?.[0];
  const availableRange = availableEnd ? dashboardDateRange(range.days, currentStart, availableEnd) : null;
  const effective = availableRange ?? range;
  const { startDate: prevStart, endDate: prevEnd } = previousDashboardDateRange(effective);

  const [current, pages, prevDaily] = await Promise.all([
    fetchGscRows(`mcp-gsc:${GSC_SITE}:${currentStart}:${effective.endDate}`, () => getMcpGsc(GSC_SITE, currentStart, effective.endDate)),
    fetchGscRows(`mcp-gsc-pages:${GSC_SITE}:${currentStart}:${effective.endDate}`, () => getMcpGscPages(GSC_SITE, currentStart, effective.endDate)),
    fetchGscRows(`mcp-gsc-daily-rows:${GSC_SITE}:${prevStart}:${prevEnd}`, () => getMcpGscDailyRows(GSC_SITE, prevStart, prevEnd)),
  ]);

  const totals = daily.rows.length ? sumGsc(daily.rows) : null;
  const queries: GscQueryRow[] = current.rows
    .map((r) => ({
      query: (r.keys ?? []).join(" "),
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }))
    .slice(0, 8);
  const prevTotals = prevDaily.rows.length ? sumGsc(prevDaily.rows) : null;
  const landingPages = pages.rows
    .map((row) => ({
      url: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }))
    .filter((row) => row.url)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return { totals, prevTotals, queries, landingPages, pagesError: pages.error, availableRange, daily: daily.rows.map((row) => ({ date: row.keys[0], clicks: row.clicks ?? 0 })), error: daily.error ?? current.error };
}

interface Ga4Bundle {
  totals: { activeUsers: number; sessions: number } | null;
  prevTotals: { activeUsers: number; sessions: number } | null;
  trend: Ga4TrendPoint[];
  error: string | null;
}

/**
 * GA4 traffic for the website zone. The previous window is fetched as its OWN
 * explicit window (not 2d−d subtraction): activeUsers is a unique-user count,
 * and unique counts don't add across windows, so 2d−d would understate the
 * prior window and inflate the delta. Current + previous run in parallel.
 */
async function fetchGa4(range: DashboardDateRange): Promise<Ga4Bundle> {
  const { startDate: prevStart, endDate: prevEnd } = previousDashboardDateRange(range);
  const [current, prev] = await Promise.all([
    fetchGa4Report(`mcp-ga4:${GA4_PROPERTY}:${range.startDate}:${range.endDate}`, () =>
      getMcpGa4(GA4_PROPERTY, ["activeUsers", "sessions"], ["date"], range.startDate, range.endDate)
    ),
    fetchGa4Report(`mcp-ga4:${GA4_PROPERTY}:${prevStart}:${prevEnd}`, () =>
      getMcpGa4(GA4_PROPERTY, ["activeUsers", "sessions"], ["date"], prevStart, prevEnd)
    ),
  ]);

  return {
    totals: current.parsed.totals,
    prevTotals: prev.parsed.totals,
    trend: current.parsed.trend,
    error: current.error,
  };
}

async function fetchGa4Report(
  key: string,
  fn: () => Promise<Ga4Report>
): Promise<{
  parsed: { totals: { activeUsers: number; sessions: number } | null; trend: Ga4TrendPoint[] };
  error: string | null;
}> {
  try {
    return { parsed: parseGa4(await cached(key, fn)), error: null };
  } catch (err) {
    return { parsed: { totals: null, trend: [] }, error: err instanceof Error ? err.message : String(err) };
  }
}

interface AhrefsBundle {
  configured: boolean;
  result: CompetitorResult | null;
  aiVisibility: AiVisibilityResult | null;
  aiVisibilityError: string | null;
  error: string | null;
}

/** Ahrefs keywords + AI visibility (6h cache for the slow-moving citations), in parallel. */
async function fetchAhrefs(): Promise<AhrefsBundle> {
  const configured = Boolean(process.env.AHREFS_API_KEY);
  if (!configured) {
    return { configured: false, result: null, aiVisibility: null, aiVisibilityError: null, error: null };
  }
  const [kw, ai] = await Promise.all([
    (async (): Promise<{ result: CompetitorResult | null; error: string | null }> => {
      try {
        return { result: await cached("ahrefs", () => getCompetitorKeywords(TARGET_DOMAIN, { country: "hk", limit: 10 })), error: null };
      } catch (err) {
        return { result: null, error: err instanceof Error ? err.message : String(err) };
      }
    })(),
    (async (): Promise<{ result: AiVisibilityResult | null; error: string | null }> => {
      try {
        return { result: await cached("ahrefs-ai", () => getAiVisibility(TARGET_DOMAIN), 6 * 60 * 60 * 1000), error: null };
      } catch (err) {
        return { result: null, error: err instanceof Error ? err.message : String(err) };
      }
    })(),
  ]);
  return {
    configured: true,
    result: kw.result,
    aiVisibility: ai.result,
    aiVisibilityError: ai.error,
    error: kw.error,
  };
}

/**
 * Website-zone dashboard data (PSI + GSC + GA4 + Ahrefs). Every sub-source
 * degrades to `null`/`error` instead of throwing, so the zone always renders.
 * All independent fetches run in parallel (`Promise.all`).
 */
export async function getWebsiteData(days = 30, range = dashboardDateRange(days)): Promise<WebsiteData> {
  const targets = { url: TARGET_URL, domain: TARGET_DOMAIN };
  // PSI is intentionally excluded here — psi_audit is slow and occasionally
  // hangs 45s+, so getWebsitePsi streams it via its own Suspense and this zone
  // (and the AI-plans chain) never waits on it.
  const [gsc, ga4, ahrefs] = await Promise.all([
    getDashboardGsc(range),
    fetchGa4(range),
    fetchAhrefs(),
  ]);

  const deltas: WebsiteDeltas = {
    ga4Users: ga4.totals && ga4.prevTotals ? pctChange(ga4.totals.activeUsers, ga4.prevTotals.activeUsers) : null,
    ga4Sessions: ga4.totals && ga4.prevTotals ? pctChange(ga4.totals.sessions, ga4.prevTotals.sessions) : null,
    gscClicks: gsc.totals && gsc.prevTotals ? pctChange(gsc.totals.clicks, gsc.prevTotals.clicks) : null,
    gscImpressions: gsc.totals && gsc.prevTotals ? pctChange(gsc.totals.impressions, gsc.prevTotals.impressions) : null,
    gscCtr: gsc.totals && gsc.prevTotals ? (gsc.totals.ctr - gsc.prevTotals.ctr) * 100 : null,
    gscPosition: gsc.totals && gsc.prevTotals ? gsc.totals.position - gsc.prevTotals.position : null,
  };

  return {
    // psi is a placeholder here — real value streams via getWebsitePsi (see WebsiteSection).
    psi: { result: null, error: null },
    ahrefs: { configured: ahrefs.configured, result: ahrefs.result, error: ahrefs.error },
    aiVisibility: { result: ahrefs.aiVisibility, error: ahrefs.aiVisibilityError },
    gsc: { siteUrl: GSC_SITE, totals: gsc.totals, queries: gsc.queries, landingPages: gsc.landingPages, pagesError: gsc.pagesError, availableRange: gsc.availableRange, daily: gsc.daily, error: gsc.error },
    ga4: { propertyId: GA4_PROPERTY, totals: ga4.totals, trend: ga4.trend, error: ga4.error },
    targets,
    rangeDays: range.days,
    dateRange: range,
    comparisonRange: previousDashboardDateRange(range),
    deltas,
  };
}
