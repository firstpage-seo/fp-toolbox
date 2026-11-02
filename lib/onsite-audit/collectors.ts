// Onsite SEO Audit — collectors. Gathers raw signals from the crawl plus the
// external APIs (GSC/GA4/PSI/Ahrefs) into a single `Collected` object that the
// engine turns into per-row verdicts. All external calls are tolerant — a
// missing key or failed call degrades to `null` so the audit still completes.

import { getMcpGsc, getMcpPsi, getMcpGa4 } from "@/lib/mcp";
import { getGscSites, getGa4Properties } from "@/lib/tool-api";
import { getAhrefsOverview } from "@/lib/ahrefs";
import { DEFAULT_DAYS } from "./config";
import type { CrawlPage, CrawlResult } from "./types";

export interface GscSignal {
  siteUrl: string;
  queryRows: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  lowHangingFruit: number;
  highImpressionLowCtr: number;
}

export interface Ga4Signal {
  propertyId: string;
  activeUsers: number;
  sessions: number;
}

export interface PsiSignal {
  url: string;
  mobileScore: number | null;
  mobileLcpMs: number | null;
  mobileCls: number | null;
  desktopScore: number | null;
}

export interface AhrefsSignal {
  backlinks: number;
  refdomains: number;
  domainRating: number;
}

export interface OnpageSignal {
  pages200: CrawlPage[];
  missingTitle: CrawlPage[];
  dupTitles: string[];
  tooLongTitles: CrawlPage[];
  missingDesc: CrawlPage[];
  dupDescs: string[];
  tooLongDescs: CrawlPage[];
  missingH1: CrawlPage[];
  dupH1: string[];
  multiH1: CrawlPage[];
  missingAlt: CrawlPage[];
  noAltCount: number;
  missingCanonical: CrawlPage[];
  canonicalMismatch: CrawlPage[];
  noindexed: CrawlPage[];
  mixedContent: string[];
  httpOnly: CrawlPage[];
  underscoreUrls: string[];
  uppercaseUrls: string[];
  multiSlashUrls: string[];
  paramUrls: string[];
  redirectChains: string[];
  brokenLinks: { from: string; to: string }[];
  orphanUrls: string[];
  redirects302: string[];
  status5xx: CrawlPage[];
  soft404: CrawlPage[];
  paginationRel: boolean;
  hreflangSelfRef: boolean;
  hasHreflang: boolean;
  jsonLdTypes: string[];
  hasOrganizationLd: boolean;
  hasBreadcrumbLd: boolean;
  hasProductLd: boolean;
  hasArticleLd: boolean;
  hasFaqLd: boolean;
  hasSitelinksLd: boolean;
  thinPages: CrawlPage[];
  tocPresent: boolean;
  navHasLinks: boolean;
  hasFooterLinks: boolean;
  robotsSitemapLink: boolean;
  robotsCssJsAllowed: boolean;
  robotsHasDisallow: boolean;
  sitemapExists: boolean;
  sitemapHasLoc: boolean;
  sitemapHasLastmod: boolean;
  sitemapHasImages: boolean;
  sitemapBlockedUrls: number;
  sitemapPaginatedUrls: number;
  hasCustom404: boolean;
  page1Dup: boolean;
  viewAllConflict: boolean;
}

export interface Collected {
  target: string;
  domain: string;
  crawl: CrawlResult;
  onpage: OnpageSignal;
  gsc: GscSignal | null;
  ga4: Ga4Signal | null;
  psi: PsiSignal | null;
  ahrefs: AhrefsSignal | null;
  gscLinked: boolean;
  ga4Linked: boolean;
}

/** Extract a comparable bare hostname ("www." stripped, sc-domain: prefix handled). */
function hostnameOf(u: string): string {
  let s = String(u ?? "").trim().replace(/^sc-domain:/i, "");
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    return new URL(s).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function aggregateOnpage(crawl: CrawlResult): OnpageSignal {
  const pages200 = crawl.pages.filter((p) => p.status >= 200 && p.status < 300);
  const s: OnpageSignal = {
    pages200,
    missingTitle: [], dupTitles: [], tooLongTitles: [],
    missingDesc: [], dupDescs: [], tooLongDescs: [],
    missingH1: [], dupH1: [], multiH1: [],
    missingAlt: [], noAltCount: 0,
    missingCanonical: [], canonicalMismatch: [], noindexed: [],
    mixedContent: [], httpOnly: [],
    underscoreUrls: [], uppercaseUrls: [], multiSlashUrls: [], paramUrls: [],
    redirectChains: [], brokenLinks: [], orphanUrls: [], redirects302: [], status5xx: [], soft404: [],
    paginationRel: false, hreflangSelfRef: false, hasHreflang: false,
    jsonLdTypes: [], hasOrganizationLd: false, hasBreadcrumbLd: false,
    hasProductLd: false, hasArticleLd: false, hasFaqLd: false, hasSitelinksLd: false,
    thinPages: [], tocPresent: false, navHasLinks: false, hasFooterLinks: false,
    robotsSitemapLink: false, robotsCssJsAllowed: false, robotsHasDisallow: false,
    sitemapExists: !!crawl.sitemap, sitemapHasLoc: false, sitemapHasLastmod: false,
    sitemapHasImages: false, sitemapBlockedUrls: 0, sitemapPaginatedUrls: 0,
    hasCustom404: false, page1Dup: false, viewAllConflict: false,
  };

  const titleCount = new Map<string, number>();
  const descCount = new Map<string, number>();
  const h1Count = new Map<string, number>();

  for (const p of pages200) {
    if (!p.title) s.missingTitle.push(p);
    else {
      titleCount.set(p.title, (titleCount.get(p.title) ?? 0) + 1);
      if (new Blob([p.title]).size > 580) s.tooLongTitles.push(p);
    }
    if (!p.metaDescription) s.missingDesc.push(p);
    else {
      descCount.set(p.metaDescription, (descCount.get(p.metaDescription) ?? 0) + 1);
      if (p.metaDescription.length > 155) s.tooLongDescs.push(p);
    }
    if (p.h1s.length === 0) s.missingH1.push(p);
    if (p.h1s.length > 1) s.multiH1.push(p);
    if (p.h1s.length === 1) h1Count.set(p.h1s[0], (h1Count.get(p.h1s[0]) ?? 0) + 1);
    if (!p.canonical) s.missingCanonical.push(p);
    else {
      const canon = p.canonical.split("?")[0].replace(/\/$/, "");
      const cur = p.url.split("?")[0].replace(/\/$/, "");
      if (canon !== cur) s.canonicalMismatch.push(p);
    }
    if (p.robotsMeta && /noindex/i.test(p.robotsMeta)) s.noindexed.push(p);

    for (const img of p.images) {
      if (!img.alt) { s.noAltCount++; s.missingAlt.push(p); }
      if (/^http:\/\//i.test(img.src)) s.mixedContent.push(img.src);
    }

    const path = new URL(p.url).pathname;
    if (/[a-z0-9]_[a-z0-9]/i.test(path)) s.underscoreUrls.push(p.url);
    if (/\/([A-Z])/.test(path)) s.uppercaseUrls.push(p.url);
    if (/\/{2,}/.test(p.url.replace(/^https?:\/\//, ""))) s.multiSlashUrls.push(p.url);
    if ([...new URL(p.url).searchParams.keys()].length > 0) s.paramUrls.push(p.url);

    if (p.status >= 500) s.status5xx.push(p);
    if (p.status === 302) s.redirects302.push(p.url);
    if (p.status === 200 && !p.title && !p.metaDescription && p.links.length < 3) s.soft404.push(p);
    if (p.redirectChain.length > 2) s.redirectChains.push(p.url);
    if (p.url.startsWith("http://")) s.httpOnly.push(p);

    if (p.h1s.length === 0 && (p.title?.length ?? 0) > 0 && pages200.length > 5) s.thinPages.push(p);

    for (const ld of p.jsonLd) {
      try {
        const parsed = JSON.parse(ld);
        const t = parsed?.["@type"];
        const types = Array.isArray(t) ? t : [t];
        for (const ty of types ?? []) {
          const ts = String(ty ?? "");
          s.jsonLdTypes.push(ts);
          if (/Organization/i.test(ts)) s.hasOrganizationLd = true;
          if (/Breadcrumb/i.test(ts)) s.hasBreadcrumbLd = true;
          if (/Product/i.test(ts)) s.hasProductLd = true;
          if (/Article|BlogPosting|HowTo|Person/i.test(ts)) s.hasArticleLd = true;
          if (/FAQ/i.test(ts)) s.hasFaqLd = true;
          if (/Sitelinks|SearchAction/i.test(ts)) s.hasSitelinksLd = true;
        }
      } catch { /* skip invalid JSON-LD */ }
    }
  }

  for (const [t, n] of titleCount) if (n > 1) s.dupTitles.push(t);
  for (const [d, n] of descCount) if (n > 1) s.dupDescs.push(d);
  for (const [h, n] of h1Count) if (n > 1) s.dupH1.push(h);

  const incoming = new Map<string, number>();
  for (const p of pages200) {
    for (const l of p.internalLinks) incoming.set(l, (incoming.get(l) ?? 0) + 1);
    for (const l of p.internalLinks) {
      const status = crawl.pages.find((q) => q.url === l)?.status;
      if (status && status >= 400) s.brokenLinks.push({ from: p.url, to: l });
    }
  }
  for (const p of pages200) {
    if (p.url !== crawl.seedUrl && (incoming.get(p.url) ?? 0) === 0) s.orphanUrls.push(p.url);
  }

  const rt = crawl.robotsTxt ?? "";
  s.robotsSitemapLink = /^sitemap:/im.test(rt);
  s.robotsHasDisallow = /disallow:/i.test(rt);
  s.robotsCssJsAllowed = !/disallow:.*\.css|disallow:.*\.js/i.test(rt);

  if (crawl.sitemap) {
    s.sitemapHasLoc = /<loc>/i.test(crawl.sitemap);
    s.sitemapHasLastmod = /<lastmod>/i.test(crawl.sitemap);
    s.sitemapHasImages = /<image:image>|<image:loc>/i.test(crawl.sitemap);
    const locs = [...crawl.sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    s.sitemapBlockedUrls = locs.filter((u) => {
      try {
        return /\/cart\/|\/checkout\/|\/account\/|\/thank-|\/wp-admin/i.test(new URL(u).pathname);
      } catch { return false; }
    }).length;
    s.sitemapPaginatedUrls = locs.filter((u) => /\/page\/\d|\?page=|\/p\/\d/i.test(u)).length;
  }

  return s;
}

// ---- external collectors -------------------------------------------------

export async function resolveGscSite(domain: string): Promise<string | null> {
  const h = domain.toLowerCase().replace(/^www\./, "");
  const sites = await getGscSites();
  for (const site of sites) {
    const sh = hostnameOf(site.siteUrl);
    if (sh && (sh === h || sh.endsWith(`.${h}`))) return site.siteUrl;
  }
  return null;
}

export async function resolveGa4Property(domain: string): Promise<string | null> {
  const h = domain.toLowerCase().replace(/^www\./, "");
  const firstLabel = h.split(".")[0];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const props = await getGa4Properties();
  for (const p of props) {
    const dn = hostnameOf(p.displayName);
    if (dn && (dn === h || dn.endsWith(`.${h}`))) return p.propertyId;
    // Fallback: displayName is a bare brand name matching the domain's first label
    // (e.g. "Seafoodfriday" -> seafoodfriday.hk). Generic names won't match.
    if (norm(p.displayName) === norm(firstLabel)) return p.propertyId;
  }
  return null;
}

function dateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 3600 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function collectGsc(domain: string): Promise<{ gsc: GscSignal | null; gscLinked: boolean }> {
  try {
    const siteUrl = await resolveGscSite(domain);
    if (!siteUrl) return { gsc: null, gscLinked: false };
    const { start, end } = dateRange(DEFAULT_DAYS);
    const rows = await getMcpGsc(siteUrl, start, end, 1000);
    const queryRows = rows
      .filter((r) => r.keys && r.keys.length)
      .map((r) => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }));
    const lowHangingFruit = queryRows.filter((q) => q.position >= 4 && q.position <= 20 && q.impressions > 0).length;
    const highImpressionLowCtr = queryRows.filter((q) => q.impressions >= 1000 && q.ctr < 0.01).length;
    return {
      gscLinked: true,
      gsc: { siteUrl, queryRows, lowHangingFruit, highImpressionLowCtr },
    };
  } catch (err) {
    console.error("collectGsc failed:", err);
    return { gsc: null, gscLinked: false };
  }
}

export async function collectGa4(domain: string): Promise<{ ga4: Ga4Signal | null; ga4Linked: boolean }> {
  try {
    const propertyId = await resolveGa4Property(domain);
    if (!propertyId) return { ga4: null, ga4Linked: false };
    const { start, end } = dateRange(DEFAULT_DAYS);
    const report = await getMcpGa4(propertyId, ["activeUsers", "sessions"], ["date"], start, end);
    let activeUsers = 0;
    let sessions = 0;
    for (const row of report.rows ?? []) {
      activeUsers += Number(row.metricValues?.[0]?.value ?? 0);
      sessions += Number(row.metricValues?.[1]?.value ?? 0);
    }
    return { ga4Linked: true, ga4: { propertyId, activeUsers, sessions } };
  } catch (err) {
    console.error("collectGa4 failed:", err);
    return { ga4: null, ga4Linked: false };
  }
}

export async function collectPsi(url: string): Promise<PsiSignal | null> {
  try {
    const [mobile, desktop] = await Promise.all([
      getMcpPsi(url, "mobile").catch(() => null),
      getMcpPsi(url, "desktop").catch(() => null),
    ]);
    return {
      url,
      mobileScore: mobile?.performanceScore ?? null,
      mobileLcpMs: mobile?.lcpMs ?? null,
      mobileCls: mobile?.cls ?? null,
      desktopScore: desktop?.performanceScore ?? null,
    };
  } catch (err) {
    console.error("collectPsi failed:", err);
    return null;
  }
}

export async function collectAhrefs(domain: string): Promise<AhrefsSignal | null> {
  try {
    const o = await getAhrefsOverview(domain);
    return { backlinks: o.backlinks, refdomains: o.refdomains, domainRating: o.domainRating };
  } catch (err) {
    console.error("collectAhrefs failed:", err);
    return null;
  }
}

/**
 * Collect everything for a target URL into one `Collected` object. Tolerant —
 * external API failures degrade to null so the audit always completes.
 */
export async function collectAll(target: string): Promise<Collected> {
  const seedUrl = new URL(target).href;
  const domain = hostnameOf(seedUrl);
  const crawl = (await import("./crawler")).crawlSite;
  const crawlResult = await crawl(seedUrl, { onProgress: () => undefined });
  const onpage = aggregateOnpage(crawlResult);

  const [gscRes, ga4Res, psi, ahrefs] = await Promise.all([
    collectGsc(domain),
    collectGa4(domain),
    collectPsi(seedUrl),
    collectAhrefs(domain),
  ]);

  return {
    target: seedUrl,
    domain,
    crawl: crawlResult,
    onpage,
    gsc: gscRes.gsc,
    ga4: ga4Res.ga4,
    psi,
    ahrefs,
    gscLinked: gscRes.gscLinked,
    ga4Linked: ga4Res.ga4Linked,
  };
}

export { aggregateOnpage, hostnameOf, dateRange };
