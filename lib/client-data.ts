// lib/client-data.ts — shared client data aggregator for the client-facing tools
// (meeting-prep, monthly-report, upgraded pitch-deck/proposal).
//
// One call collects GSC + GA4 + PSI + Ahrefs for a client website. The URL is
// hostname-matched against the portfolio (752 GSC sites / 1000+ GA4 properties);
// unmatched sites degrade gracefully to PSI + Ahrefs only. Every section is
// individually tolerant, memoized 1h via lib/cache.ts, and never throws.

import { cached } from "./cache";
import { getMcpPsi, getMcpGsc, getMcpGa4 } from "./mcp";
import type { McpPsiResult, GscRow, Ga4Report } from "./mcp";
import { getCompetitorKeywords, getAiVisibility } from "./ahrefs";
import type { CompetitorResult, AiVisibilityResult } from "./ahrefs";
import { getGscSites, getGa4Properties } from "./tool-api";

export interface ClientGscTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface ClientGscRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface ClientGa4Point {
  date: string;
  activeUsers: number;
  sessions: number;
}

export interface ClientDataResult {
  url: string;
  domain: string;
  matched: { gscSite: string | null; ga4Property: string | null };
  psi: McpPsiResult | null;
  gsc: { totals: ClientGscTotals | null; topQueries: ClientGscRow[] } | null;
  ga4: { totals: { activeUsers: number; sessions: number } | null; trend: ClientGa4Point[] } | null;
  ahrefs: CompetitorResult | null;
  aiVisibility: AiVisibilityResult | null;
  errors: string[];
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hostOf(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return input.replace(/^sc-domain:/, "").replace(/^www\./, "").toLowerCase();
  }
}

/** "Foo Bar - GA4" / "www.abcleanik.com" → a comparable domain, or null when it's not one. */
function domainOfDisplayName(displayName: string): string | null {
  let s = displayName.trim().toLowerCase();
  s = s.replace(/\s*[-–—]?\s*ga4.*$/i, "").trim();
  s = s.replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  s = s.replace(/^www\./, "");
  s = s.trim();
  if (!s || s.includes(" ") || s.includes(".") === false) return null;
  return s;
}

function sumGsc(rows: GscRow[]): ClientGscTotals {
  const clicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const avgPos = rows.length
    ? rows.reduce((s, r) => s + (r.position ?? 0), 0) / rows.length
    : 0;
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: avgPos };
}

function parseGa4(report: Ga4Report): {
  totals: { activeUsers: number; sessions: number } | null;
  trend: ClientGa4Point[];
} {
  const uIdx = report.metricHeaders.findIndex((h) => h.name === "activeUsers");
  const sIdx = report.metricHeaders.findIndex((h) => h.name === "sessions");
  const trend: ClientGa4Point[] = [];
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
  return { totals: report.rows.length ? { activeUsers: users, sessions } : null, trend };
}

async function collect(raw: string): Promise<ClientDataResult> {
  const url = raw.trim();
  const domain = hostOf(url);
  const errors: string[] = [];

  const [sites, properties] = await Promise.all([getGscSites(), getGa4Properties()]);

  const gscSite = sites.find((s) => hostOf(s.siteUrl) === domain)?.siteUrl ?? null;
  const ga4Property =
    properties.find((p) => domainOfDisplayName(p.displayName) === domain)?.propertyId ?? null;

  // GSC — last 30 calendar days (site-wide totals, not top-25).
  let gsc: ClientDataResult["gsc"] = null;
  if (gscSite) {
    try {
      const end = new Date();
      end.setUTCDate(end.getUTCDate() - 1);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 29);
      const rows = await cached(`client-data:gsc:${gscSite}`, () =>
        getMcpGsc(gscSite, iso(start), iso(end), 1000)
      );
      const topQueries: ClientGscRow[] = rows
        .map((r) => ({
          query: (r.keys ?? []).join(" "),
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? 0,
          position: r.position ?? 0,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 8);
      gsc = { totals: rows.length ? sumGsc(rows) : null, topQueries };
    } catch (err) {
      errors.push(`gsc: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // GA4 — 30-day traffic trend.
  let ga4: ClientDataResult["ga4"] = null;
  if (ga4Property) {
    try {
      const report = await cached(`client-data:ga4:${ga4Property}`, () =>
        getMcpGa4(ga4Property, ["activeUsers", "sessions"], ["date"], "30daysAgo", "today")
      );
      ga4 = parseGa4(report);
    } catch (err) {
      errors.push(`ga4: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // PSI — mobile audit.
  let psi: McpPsiResult | null = null;
  try {
    psi = await cached(`client-data:psi:${url}`, () => getMcpPsi(url));
  } catch (err) {
    errors.push(`psi: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Ahrefs — competitor keywords + AI visibility.
  let ahrefs: CompetitorResult | null = null;
  try {
    ahrefs = await cached(`client-data:ahrefs:${domain}`, () =>
      getCompetitorKeywords(domain, { country: "hk", limit: 5 })
    );
  } catch (err) {
    errors.push(`ahrefs: ${err instanceof Error ? err.message : String(err)}`);
  }
  let aiVisibility: AiVisibilityResult | null = null;
  try {
    aiVisibility = await cached(`client-data:ai:${domain}`, () => getAiVisibility(domain));
  } catch (err) {
    errors.push(`ai: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    url,
    domain,
    matched: { gscSite, ga4Property },
    psi,
    gsc,
    ga4,
    ahrefs,
    aiVisibility,
    errors,
  };
}

/**
 * All client data in one tolerant, memoized call. Never throws — partial
 * failures surface as null sections + errors[] entries.
 */
export async function getClientData(url: string): Promise<ClientDataResult> {
  try {
    return await cached(`client-data:${url.trim()}`, () => collect(url));
  } catch (err) {
    console.error("getClientData failed:", err);
    return {
      url: url.trim(),
      domain: hostOf(url),
      matched: { gscSite: null, ga4Property: null },
      psi: null,
      gsc: null,
      ga4: null,
      ahrefs: null,
      aiVisibility: null,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}
