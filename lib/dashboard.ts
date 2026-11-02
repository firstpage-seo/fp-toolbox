import { cached } from "./cache";
import { getRecentLeads, getSpamReport, fetchRecentLeads } from "./hubspot";
import type { HubSpotLead, SpamReport } from "./hubspot";
import { getCompetitorKeywords, getAiVisibility } from "./ahrefs";
import type { CompetitorResult, AiVisibilityResult } from "./ahrefs";
import { getMcpPsi, getMcpGsc, getMcpGscDaily, getMcpGa4, getMcpInventory } from "./mcp";
import type { McpPsiResult, GscRow, McpGscDailyPoint, Ga4Report, McpInventory } from "./mcp";
import { getDealsReport, aggregateDeals } from "./hubspot-deals";
import type { DealsAggregate } from "./hubspot-deals";
import { getEngagementReport } from "./hubspot-engagement";
import type { EngagementReport } from "./hubspot-engagement";
import { getUsageStats } from "./usage";
import type { UsageStats } from "./usage";

// ponytail: dashboard targets are env-configurable, defaulting to FirstPage HK.
const TARGET_URL = process.env.DASHBOARD_TARGET_URL || "https://firstpage.hk";
const TARGET_DOMAIN = process.env.DASHBOARD_TARGET_DOMAIN || "firstpage.hk";
const GSC_SITE = process.env.DASHBOARD_GSC_SITE || "https://www.firstpage.hk/";
const GA4_PROPERTY = process.env.DASHBOARD_GA4_PROPERTY || "374723776"; // firstpage.hk

// GSC only accepts YYYY-MM-DD; the sandbox clock runs ~1y ahead of Google's
// data window, so allow an explicit end date override (production: unset).
function dataEndDate(): string {
  return (
    process.env.DASHBOARD_DATA_END_DATE ||
    new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10)
  );
}
function dataStartDate(days = 29): string {
  const end = new Date(`${dataEndDate()}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - days);
  return end.toISOString().slice(0, 10);
}

export interface LeadTrendPoint {
  /** YYYY-MM-DD (UTC) */
  date: string;
  leads: number;
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

/** One day of GSC clicks — feeds the Organic clicks KPI sparkline. */
export type GscDailyPoint = McpGscDailyPoint;

export interface Ga4TrendPoint {
  date: string;
  activeUsers: number;
  sessions: number;
}

/**
 * Percentage deltas vs the previous window of the same length.
 * Ratio metrics use percentage points (spamRate); position is omitted (not a
 * sum — can't derive the previous window by subtraction).
 */
export interface Deltas {
  leads: number | null;
  spamRate: number | null;
  ga4Users: number | null;
  ga4Sessions: number | null;
  gscClicks: number | null;
  gscImpressions: number | null;
  closedWonRevenue: number | null;
  pipelineValue: number | null;
  usageRuns: number | null;
  usageCost: number | null;
}

/** Website-zone deltas only — the fields WebsiteSection consumes. */
export type WebsiteDeltas = Pick<Deltas, "ga4Users" | "ga4Sessions" | "gscClicks" | "gscImpressions">;
/** Sales-zone deltas only — the fields SalesSection consumes. */
export type SalesDeltas = Pick<Deltas, "leads" | "spamRate" | "closedWonRevenue" | "pipelineValue" | "usageRuns" | "usageCost">;

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
  deltas: WebsiteDeltas;
}

/**
 * Sales-performance half of the dashboard — the fields SalesSection consumes.
 */
export interface SalesData {
  hubspot: {
    configured: boolean;
    leads: HubSpotLead[];
    trend: LeadTrendPoint[];
    spam: SpamReport | null;
    error: string | null;
  };
  deals: {
    aggregate: DealsAggregate | null;
    error: string | null;
  };
  engagement: {
    report: EngagementReport | null;
    error: string | null;
  };
  usage: UsageStats;
  rangeDays: number;
  deltas: SalesDeltas;
}

/** Client portfolio size for the dashboard pagehead (independent, never blocks). */
export interface ClientsInfo {
  configured: boolean;
  inventory: McpInventory | null;
  error: string | null;
}

/** Percent change, null when the previous baseline is zero. */
function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** Bucket leads into a zero-filled daily timeline (UTC) so the chart is continuous. */
function buildTrend(leads: HubSpotLead[], days = 30): LeadTrendPoint[] {
  const byDay = new Map<string, number>();
  for (const l of leads) {
    if (l.createdAt) {
      const day = l.createdAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
  }
  const points: LeadTrendPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setUTCDate(now.getUTCDate() - i);
    const key = day.toISOString().slice(0, 10);
    points.push({ date: key, leads: byDay.get(key) ?? 0 });
  }
  return points;
}

function sumGsc(rows: GscRow[]): GscTotals {
  const clicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const avgPos = rows.length
    ? rows.reduce((s, r) => s + (r.position ?? 0), 0) / rows.length
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

// ---- zone-level tolerant fetchers (each degrades instead of throwing) -------

async function fetchLeads(days: number): Promise<{ leads: HubSpotLead[]; error: string | null }> {
  try {
    return { leads: await getRecentLeads(days), error: null };
  } catch (err) {
    return { leads: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchSpam(days: number): Promise<{ spam: SpamReport | null; error: string | null }> {
  try {
    return { spam: await cached(`spam-report:${days}`, () => getSpamReport(days)), error: null };
  } catch (err) {
    return { spam: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchDeals(days: number): Promise<{ aggregate: DealsAggregate | null; error: string | null }> {
  try {
    const report = await cached(`deals-report:${days}`, () => getDealsReport(days));
    return { aggregate: aggregateDeals(report), error: null };
  } catch (err) {
    return { aggregate: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchEngagement(days: number): Promise<{ report: EngagementReport | null; error: string | null }> {
  try {
    return { report: await cached(`engagement:${days}`, () => getEngagementReport(days)), error: null };
  } catch (err) {
    return { report: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Previous-window lead count (explicit window — leads are deduped by email). Best-effort. */
async function fetchLeadsPrev(days: number): Promise<number> {
  try {
    return (await cached(`leads-prev:${days}`, () => fetchRecentLeads(2 * days, days))).length;
  } catch {
    return 0;
  }
}

// Tolerant no-op fallbacks for the HubSpot-backed fetchers when the key is
// unset — same shape as their results, no API call.
const noLeads = (): Promise<{ leads: HubSpotLead[]; error: string | null }> =>
  Promise.resolve({ leads: [], error: null });
const noSpam = (): Promise<{ spam: SpamReport | null; error: string | null }> =>
  Promise.resolve({ spam: null, error: null });
const noDeals = (): Promise<{ aggregate: DealsAggregate | null; error: string | null }> =>
  Promise.resolve({ aggregate: null, error: null });
const noEngagement = (): Promise<{ report: EngagementReport | null; error: string | null }> =>
  Promise.resolve({ report: null, error: null });
const zero = (): Promise<number> => Promise.resolve(0);

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

interface GscBundle {
  totals: GscTotals | null;
  prevTotals: GscTotals | null;
  queries: GscQueryRow[];
  daily: GscDailyPoint[];
  error: string | null;
}

/**
 * GSC search performance for the website zone. Windows are exactly `days`
 * calendar days each and non-overlapping: current = [E−days+1, E], previous =
 * [E−2d+1, E−days], where E = yesterday. (dataStartDate(n) is E−n, so current
 * starts at dataStartDate(days−1) and previous ends at dataStartDate(days).)
 * Current + daily + previous windows are fetched in parallel; daily and
 * previous are best-effort (deltas/sparkline just go null/empty on failure).
 */
async function fetchGsc(days: number): Promise<GscBundle> {
  const currentStart = dataStartDate(days - 1);
  const end = dataEndDate();
  const prevStart = dataStartDate(2 * days - 1);
  const prevEnd = dataStartDate(days);

  const [current, daily, prev] = await Promise.all([
    fetchGscRows(`mcp-gsc:${GSC_SITE}:${currentStart}:${end}`, () => getMcpGsc(GSC_SITE, currentStart, end)),
    fetchGscRows(
      `mcp-gsc-daily:${GSC_SITE}:${currentStart}:${end}`,
      () => getMcpGscDaily(GSC_SITE, currentStart, end)
    ),
    fetchGscRows(`mcp-gsc:${GSC_SITE}:${prevStart}:${prevEnd}`, () => getMcpGsc(GSC_SITE, prevStart, prevEnd)),
  ]);

  const totals = current.rows.length ? sumGsc(current.rows) : null;
  const queries: GscQueryRow[] = current.rows
    .map((r) => ({
      query: (r.keys ?? []).join(" "),
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }))
    .slice(0, 8);
  const prevTotals = prev.rows.length ? sumGsc(prev.rows) : null;

  return { totals, prevTotals, queries, daily: daily.rows, error: current.error };
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
async function fetchGa4(days: number): Promise<Ga4Bundle> {
  const [current, prev] = await Promise.all([
    fetchGa4Report(`mcp-ga4:${GA4_PROPERTY}:${days}`, () =>
      getMcpGa4(GA4_PROPERTY, ["activeUsers", "sessions"], ["date"], `${days}daysAgo`, "today")
    ),
    fetchGa4Report(`mcp-ga4:${GA4_PROPERTY}:prev:${days}`, () =>
      getMcpGa4(GA4_PROPERTY, ["activeUsers", "sessions"], ["date"], `${2 * days}daysAgo`, `${days}daysAgo`)
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
export async function getWebsiteData(days = 30): Promise<WebsiteData> {
  const targets = { url: TARGET_URL, domain: TARGET_DOMAIN };
  // PSI is intentionally excluded here — psi_audit is slow and occasionally
  // hangs 45s+, so getWebsitePsi streams it via its own Suspense and this zone
  // (and the AI-plans chain) never waits on it.
  const [gsc, ga4, ahrefs] = await Promise.all([
    fetchGsc(days),
    fetchGa4(days),
    fetchAhrefs(),
  ]);

  const deltas: WebsiteDeltas = {
    ga4Users: ga4.totals && ga4.prevTotals ? pctChange(ga4.totals.activeUsers, ga4.prevTotals.activeUsers) : null,
    ga4Sessions: ga4.totals && ga4.prevTotals ? pctChange(ga4.totals.sessions, ga4.prevTotals.sessions) : null,
    gscClicks: gsc.totals && gsc.prevTotals ? pctChange(gsc.totals.clicks, gsc.prevTotals.clicks) : null,
    gscImpressions: gsc.totals && gsc.prevTotals ? pctChange(gsc.totals.impressions, gsc.prevTotals.impressions) : null,
  };

  return {
    // psi is a placeholder here — real value streams via getWebsitePsi (see WebsiteSection).
    psi: { result: null, error: null },
    ahrefs: { configured: ahrefs.configured, result: ahrefs.result, error: ahrefs.error },
    aiVisibility: { result: ahrefs.aiVisibility, error: ahrefs.aiVisibilityError },
    gsc: { siteUrl: GSC_SITE, totals: gsc.totals, queries: gsc.queries, daily: gsc.daily, error: gsc.error },
    ga4: { propertyId: GA4_PROPERTY, totals: ga4.totals, trend: ga4.trend, error: ga4.error },
    targets,
    rangeDays: days,
    deltas,
  };
}

/**
 * Sales-zone dashboard data (HubSpot leads/spam + deals + engagement + usage).
 * Every sub-source degrades to `null`/`error` instead of throwing. Independent
 * fetches run in parallel; the previous-window baselines feed the deltas.
 */
export async function getSalesData(days = 30): Promise<SalesData> {
  const hubspotConfigured = Boolean(process.env.HUBSPOT_SERVICE_KEY);

  // HubSpot calls share ONE API quota — run them in small batches (≤3 in
  // flight) so a cold cache can't trip the 429 rate limit. Postgres-backed
  // usage stats run alongside; they don't consume the HubSpot quota.
  const [leadsRes, spamRes] = await Promise.all([
    hubspotConfigured ? fetchLeads(days) : noLeads(),
    hubspotConfigured ? fetchSpam(days) : noSpam(),
  ]);
  const [usageRes, usage2xRes, dealsRes, engagementRes] = await Promise.all([
    getUsageStats(days),
    getUsageStats(2 * days),
    hubspotConfigured ? fetchDeals(days) : noDeals(),
    hubspotConfigured ? fetchEngagement(days) : noEngagement(),
  ]);
  // Previous-window baselines (sums/deduped counts, never 2d−d subtractions).
  // Always fetch the double window when configured — spamPrev only applies
  // when both windows succeeded (same behaviour as the old conditional).
  const [spam2xRes, deals2xRes, leadsPrevCount] = await Promise.all([
    hubspotConfigured ? fetchSpam(2 * days) : noSpam(),
    hubspotConfigured ? fetchDeals(2 * days) : noDeals(),
    hubspotConfigured ? fetchLeadsPrev(days) : zero(),
  ]);

  const hubspotError = leadsRes.error ?? spamRes.error;

  // Spam-rate delta: exact rates on both sides — spamRatePct is rounded to an
  // integer, mixing it with the exact previous rate could flip the ±2pp threshold.
  let spamPrev: { total: number; spam: number } | null = null;
  if (spamRes.spam && spam2xRes.spam) {
    spamPrev = {
      total: Math.max(0, spam2xRes.spam.total - spamRes.spam.total),
      spam: Math.max(0, spam2xRes.spam.spam - spamRes.spam.spam),
    };
  }

  const prevClosedWon = deals2xRes.aggregate
    ? {
        count: deals2xRes.aggregate.closedWon.count - (dealsRes.aggregate?.closedWon.count ?? 0),
        revenue: deals2xRes.aggregate.closedWon.revenue - (dealsRes.aggregate?.closedWon.revenue ?? 0),
      }
    : null;
  const prevPipeline = deals2xRes.aggregate
    ? deals2xRes.aggregate.pipelineValue - (dealsRes.aggregate?.pipelineValue ?? 0)
    : null;

  const deltas: SalesDeltas = {
    leads: pctChange(leadsRes.leads.length, leadsPrevCount),
    spamRate:
      spamRes.spam && spamPrev && spamRes.spam.total > 0 && spamPrev.total > 0
        ? (spamRes.spam.spam / spamRes.spam.total) * 100 - (spamPrev.spam / spamPrev.total) * 100
        : null,
    closedWonRevenue: dealsRes.aggregate && prevClosedWon ? pctChange(dealsRes.aggregate.closedWon.revenue, prevClosedWon.revenue) : null,
    pipelineValue: dealsRes.aggregate ? pctChange(dealsRes.aggregate.pipelineValue, prevPipeline ?? 0) : null,
    usageRuns: pctChange(usageRes.totalRuns, usage2xRes.totalRuns - usageRes.totalRuns),
    usageCost: pctChange(usageRes.totalCostUsd, usage2xRes.totalCostUsd - usageRes.totalCostUsd),
  };

  return {
    hubspot: {
      configured: hubspotConfigured,
      leads: leadsRes.leads,
      trend: buildTrend(leadsRes.leads, days),
      spam: spamRes.spam,
      error: hubspotError,
    },
    deals: { aggregate: dealsRes.aggregate, error: dealsRes.error },
    engagement: { report: engagementRes.report, error: engagementRes.error },
    usage: usageRes,
    rangeDays: days,
    deltas,
  };
}

/** Client portfolio size for the pagehead — memoized 1h, never blocks the page. */
export async function getClientsInventory(): Promise<ClientsInfo> {
  const mcpConfigured = Boolean(process.env.FP_MCP_API_KEY);
  if (!mcpConfigured) return { configured: false, inventory: null, error: null };
  try {
    const inventory = await cached("mcp-inventory", () => getMcpInventory());
    return { configured: true, inventory, error: null };
  } catch (err) {
    return { configured: true, inventory: null, error: err instanceof Error ? err.message : String(err) };
  }
}
