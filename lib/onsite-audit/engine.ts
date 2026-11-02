// Onsite SEO Audit — engine. Orchestrates crawl + collectors, maps the raw
// signals onto every checklist row (pass/fail/warn/manual/n-a) with evidence,
// runs the LLM content review + executive summary, and produces an AuditResult.

import { crawlSite } from "./crawler";
import {
  aggregateOnpage,
  collectGsc,
  collectGa4,
  collectPsi,
  collectAhrefs,
} from "./collectors";
import { CHECKLIST } from "./checklist";
import { complete } from "@/lib/llm";
import type {
  AuditProgress,
  AuditResult,
  AuditSection,
  CheckItem,
  CrawlResult,
  Verdict,
} from "./types";

export interface AuditCallbacks {
  onProgress?: (p: AuditProgress) => void;
}

const SEMI_AUTO_IDS = new Set([
  "4.1", "21.1", "22.1", "22.3", "22.4", "22.6", "22.8", "24.9",
]);

function setVerdict(item: CheckItem, verdict: Verdict, evidence: string): void {
  item.verdict = verdict;
  item.evidence = evidence;
}

function boolVerdict(ok: boolean): Verdict {
  return ok ? "pass" : "fail";
}

function n(list: unknown[]): number {
  return list.length;
}

function buildVerdicts(c: {
  crawl: CrawlResult;
  onpage: ReturnType<typeof aggregateOnpage>;
  gsc: Awaited<ReturnType<typeof collectGsc>>;
  ga4: Awaited<ReturnType<typeof collectGa4>>;
  psi: Awaited<ReturnType<typeof collectPsi>>;
  ahrefs: Awaited<ReturnType<typeof collectAhrefs>>;
}): AuditSection[] {
  const { crawl, onpage: o, gsc, ga4, ahrefs } = c;
  const sections: AuditSection[] = [];

  const byId = new Map<string, CheckItem>();
  for (const sec of CHECKLIST) {
    for (const it of sec.items) byId.set(it.id, { ...it });
  }
  const V = (id: string, verdict: Verdict, evidence: string) => {
    const it = byId.get(id);
    if (it) setVerdict(it, verdict, evidence);
  };

  // ---- Pre-Check / metrics ---------------------------------------------
  V("1.4", ahrefs ? boolVerdict(ahrefs.domainRating > 0) : "n-a",
    ahrefs ? `Domain Rating ${ahrefs.domainRating}` : "Ahrefs not configured");
  V("1.5", ahrefs ? boolVerdict(ahrefs.refdomains > 0) : "n-a",
    ahrefs ? `${ahrefs.refdomains} referring domains` : "Ahrefs not configured");
  V("1.6", "n-a", "Use site: search in Google (indexed-page count).");
  V("2.5", gsc.gscLinked || ga4.ga4Linked ? "warn" : "n-a",
    gsc.gscLinked || ga4.ga4Linked ? "GSC/GA4 linked — confirm geo targeting" : "No Google data linked — skipped.");
  V("5.8", "n-a", "Manual: inspect GTM placement in source.");
  V("6.2", "warn", "Safe Browsing lookup needs an API key; verify at transparencyreport.google.com/safe-browsing/search.");
  V("6.3", "warn", "Run Sucuri sitecheck manually: https://sitecheck.sucuri.net/");

  // ---- Crawling: GSC ---------------------------------------------
  if (gsc.gscLinked && gsc.gsc) {
    V("7.2", boolVerdict(gsc.gsc.lowHangingFruit > 0),
      `${gsc.gsc.lowHangingFruit} queries ranking 4-20 (low-hanging fruit)`);
    V("7.3", boolVerdict(gsc.gsc.highImpressionLowCtr > 0),
      `${gsc.gsc.highImpressionLowCtr} high-impression (>1000) low-CTR (<1%) queries`);
    V("7.1", "warn", "Query-level GSC fetched — review per-URL cannibalization in GSC.");
    V("7.4", "warn", "Check GSC > pages for unwanted indexed URLs (tags/params).");
    V("7.5", "warn", "Check GSC > not-indexed pages for should-be-indexed URLs.");
    V("7.6", "n-a", "Manual: GSC date filter 28 days, query filter '2022'.");
    V("8.7", "warn", "Check GSC > enhancements for mobile usability issues.");
  } else {
    const skip = "GSC not linked in MCP — skipped.";
    V("7.1", "n-a", skip);
    V("7.2", "n-a", skip);
    V("7.3", "n-a", skip);
    V("7.4", "n-a", skip);
    V("7.5", "n-a", skip);
    V("7.6", "n-a", skip);
    V("8.7", "n-a", skip);
  }

  // ---- Crawling: mobile / https / robots / sitemap / canonical ----
  const all200 = o.pages200;
  const responsive = all200.length > 0 && all200.every((p) => p.hasViewport);
  V("8.1", "warn", "Confirm with Google mobile-friendly test.");
  V("8.4", boolVerdict(responsive), responsive ? "All crawled pages have a viewport" : "Some pages lack a viewport meta");
  V("8.2", "warn", "Manual: compare desktop vs mobile content visibility.");
  V("8.3", "warn", "Manual: review mobile UX.");
  V("8.5", "warn", "Manual: check for mobile interstitials/popups.");

  const httpsOk = all200.length > 0 && !crawl.pages.some((p) => p.url.startsWith("http://"));
  V("9.1", boolVerdict(httpsOk), httpsOk ? "All pages served over https" : `${n(o.httpOnly)} http-only URLs found`);
  V("9.2", boolVerdict(o.mixedContent.length === 0),
    o.mixedContent.length === 0 ? "No mixed content" : `${o.mixedContent.length} http:// images/resources`);
  const hasWww = crawl.pages.some((p) => new URL(p.url).hostname.startsWith("www"));
  V("9.3", boolVerdict(hasWww), hasWww ? "www canonical host detected" : "Non-www host; verify redirect consistency");

  V("10.1", boolVerdict(!!crawl.robotsTxt), crawl.robotsTxt ? "robots.txt exists" : "robots.txt missing");
  V("10.7", boolVerdict(o.robotsSitemapLink), o.robotsSitemapLink ? "Sitemap link present in robots.txt" : "No Sitemap: directive found");
  V("10.3", boolVerdict(o.robotsHasDisallow), o.robotsHasDisallow ? "Disallow rules present" : "No Disallow rules found");
  V("10.4", boolVerdict(o.robotsCssJsAllowed), o.robotsCssJsAllowed ? "CSS/JS not disallowed" : "CSS/JS disallowed");
  V("10.2", "warn", "Review robots.txt for over-disallow of indexable content.");
  V("10.5", "warn", "Verify carts/checkout/account/admin are disallowed in robots.txt.");
  V("10.6", boolVerdict(!!crawl.robotsTxt), crawl.robotsTxt ? "robots.txt naming OK" : "robots.txt missing");

  V("11.1", boolVerdict(o.sitemapExists), o.sitemapExists ? "XML sitemap found" : "No sitemap found");
  V("11.3", boolVerdict(o.sitemapHasLoc), o.sitemapHasLoc ? "<loc> tags present" : "No <loc> tags found");
  V("11.4", boolVerdict(o.sitemapHasLastmod), o.sitemapHasLastmod ? "lastmod present" : "No lastmod tags");
  V("11.8", o.sitemapHasImages ? "warn" : "n-a", o.sitemapHasImages ? "Image sitemap entries found" : "No image entries (check if e-commerce)");
  V("11.5", boolVerdict(o.sitemapBlockedUrls === 0), `${o.sitemapBlockedUrls} blocked URLs in sitemap`);
  V("11.6", boolVerdict(o.sitemapPaginatedUrls === 0), `${o.sitemapPaginatedUrls} paginated URLs in sitemap`);
  V("11.2", "warn", "Verify sitemap is dynamically generated.");
  V("11.7", "warn", "Remove non-indexable URLs (non-canonical / non-200) from sitemap.");
  V("11.9", "manual", "Confirm sitemap submitted to GSC and error-free.");

  V("12.2", o.noindexed.length > 0 ? "pass" : "warn",
    o.noindexed.length > 0 ? `${o.noindexed.length} noindexed pages (verify search/archive/thanks)` : "No noindex detected — verify search/thanks/archive pages don't need it");
  V("12.1", "warn", "Manual: check faceted nav/filters + canonicalisation.");
  V("12.3", "warn", "Manual: ensure no sections accidentally noindexed.");

  V("13.1", boolVerdict(o.missingCanonical.length === 0),
    o.missingCanonical.length === 0 ? "All pages have a canonical" : `${o.missingCanonical.length} pages missing canonical`);
  V("13.2", boolVerdict(o.canonicalMismatch.length === 0),
    o.canonicalMismatch.length === 0 ? "Canonicals reference themselves" : `${o.canonicalMismatch.length} canonical mismatches`);
  V("13.3", "warn", "Manual: verify query-string pages canonical to base.");
  V("13.4", "warn", "E-commerce: verify variant canonicals point to base product URL.");
  V("13.5", "warn", "Manual: confirm search URLs aren't indexed.");
  V("13.6", "warn", "Manual: noindex tags/archives (Yoast).");
  V("13.7", "warn", "Check GSC for 'Duplicate, Google chose different canonical'.");

  V("14.1", "warn", "Manual: check for on-page links to page 2+.");
  V("14.2", "warn", "Manual: check View All vs paginated canonical conflict.");
  V("14.3", o.paginationRel ? "pass" : "warn", o.paginationRel ? "rel prev/next found" : "No rel prev/next detected (may be fine)");
  V("14.4", boolVerdict(!o.page1Dup), o.page1Dup ? "page=1 duplicates root" : "No page=1 duplication detected");
  V("14.5", "warn", "Manual: confirm paginated content duplication.");
  V("14.6", "warn", "Manual: verify canonical self-reference on paginated pages.");

  V("15.1", "warn", "Manual: multi-language/country?");
  V("15.2", "warn", "Manual: parameter / ccTLD / subdirectory i18n?");
  V("15.3", "n-a", "hreflang audit requires target locale config.");

  // ---- Content ---------------------------------------------
  const total = all200.length || 1;
  const missTitlePct = (n(o.missingTitle) / total) * 100;
  const missDescPct = (n(o.missingDesc) / total) * 100;
  const missH1Pct = (n(o.missingH1) / total) * 100;
  V("17.1", boolVerdict(missTitlePct < 10), `${n(o.missingTitle)}/${total} pages missing title (${missTitlePct.toFixed(0)}%)`);
  V("17.2", boolVerdict(o.dupTitles.length === 0), o.dupTitles.length === 0 ? "No duplicate titles" : `${o.dupTitles.length} duplicate titles`);
  V("17.3", boolVerdict(o.tooLongTitles.length === 0), `${o.tooLongTitles.length} titles over 580px`);
  V("18.1", boolVerdict(missDescPct < 10), `${n(o.missingDesc)}/${total} pages missing description`);
  V("18.2", boolVerdict(o.dupDescs.length === 0), o.dupDescs.length === 0 ? "No duplicate descriptions" : `${o.dupDescs.length} duplicate descriptions`);
  V("18.3", boolVerdict(o.tooLongDescs.length === 0), `${o.tooLongDescs.length} descriptions over 155 chars`);
  V("19.1", boolVerdict(missH1Pct < 10), `${n(o.missingH1)}/${total} pages missing H1`);
  V("19.2", boolVerdict(o.dupH1.length === 0), o.dupH1.length === 0 ? "No duplicate H1s" : `${o.dupH1.length} duplicate H1s`);
  V("19.3", boolVerdict(o.multiH1.length === 0), o.multiH1.length === 0 ? "No multi-H1 pages" : `${o.multiH1.length} pages with multiple H1s`);
  V("20.1", boolVerdict(o.noAltCount === 0), o.noAltCount === 0 ? "All images have alt text" : `${o.noAltCount} images missing alt`);
  V("20.2", "n-a", "Oversize image check requires asset size fetch.");
  V("21.2", o.dupTitles.length > 0 || o.dupDescs.length > 0 ? "warn" : "pass", "Internal duplication heuristic via duplicate titles/descriptions.");
  V("22.2", boolVerdict(o.thinPages.length === 0), `${o.thinPages.length} thin-content pages detected`);
  V("22.7", boolVerdict(o.pages200.some((p) => p.h1s.length > 0)), "Headings present for passage indexing");
  V("22.9", o.tocPresent ? "pass" : "warn", o.tocPresent ? "TOC found" : "No table of contents detected (optional)");

  V("23.1", o.hasOrganizationLd ? "pass" : "warn", o.hasOrganizationLd ? "Organization JSON-LD present" : "No Organization schema");
  V("23.3", o.hasBreadcrumbLd ? "pass" : "warn", o.hasBreadcrumbLd ? "Breadcrumb schema present" : "No Breadcrumb schema");
  V("23.2", o.hasProductLd ? "pass" : "n-a", o.hasProductLd ? "Product schema present" : "No Product schema (check if e-commerce)");
  V("23.5", o.hasArticleLd ? "pass" : "warn", o.hasArticleLd ? "Article/HowTo/Person schema present" : "No article schema");
  V("23.4", o.hasSitelinksLd ? "pass" : "warn", o.hasSitelinksLd ? "Sitelinks SearchBox schema present" : "No Sitelinks/SearchAction schema");
  V("23.7", o.hasFaqLd ? "pass" : "warn", o.hasFaqLd ? "FAQ schema present" : "No FAQ schema (optional)");
  V("23.8", "warn", "Verify schema read in GSC > Enhancements.");

  V("24.1", "warn", "Manual: contextual links in homepage body copy.");
  V("24.3", o.hasBreadcrumbLd ? "pass" : "warn", o.hasBreadcrumbLd ? "Breadcrumbs used" : "No breadcrumb structure detected");
  V("24.2", "warn", "E-commerce: verify product-page contextual links.");
  V("24.4", "warn", "Manual: category-to-subcategory automated links.");
  V("24.5", boolVerdict(o.pages200.some((p) => p.depth === 0)), "Footer link check is manual (crawl-level heuristic)");
  V("24.6", boolVerdict(o.redirectChains.length === 0), o.redirectChains.length === 0 ? "No redirect chains >2 hops" : `${o.redirectChains.length} redirect chains`);
  V("24.7", boolVerdict(o.orphanUrls.length === 0), o.orphanUrls.length === 0 ? "No orphan pages detected" : `${o.orphanUrls.length} orphan pages`);
  V("24.8", boolVerdict(o.brokenLinks.length === 0), o.brokenLinks.length === 0 ? "No broken internal links" : `${o.brokenLinks.length} broken internal links`);
  V("24.9", "warn", "Manual: use GSC high-link pages as internal-linking bases.");

  V("25.1", "warn", "Manual: confirm nav is clear + links to important pages.");
  V("25.2", "warn", "Manual: GSC > Settings > Crawl Stats > By Response > 200.");
  V("25.3", "n-a", "Manual: GSC Crawl Stats > total crawl requests per day.");
  V("25.4", "n-a", "Manual: flag non-200/301 URLs wasting crawl budget.");

  // ---- Technical ---------------------------------------------
  const underscoreOk = o.underscoreUrls.length === 0;
  const upperOk = o.uppercaseUrls.length === 0;
  const multiSlashOk = o.multiSlashUrls.length === 0;
  const paramOk = o.paramUrls.length === 0;
  V("26.1", "warn", "Manual: confirm hierarchical keyword URLs.");
  V("26.2", boolVerdict(paramOk), paramOk ? "No excessive query parameters in URLs" : `${o.paramUrls.length} URLs with parameters`);
  V("26.3", boolVerdict(underscoreOk), underscoreOk ? "No underscores in URLs" : `${o.underscoreUrls.length} underscore URLs`);
  V("26.4", boolVerdict(upperOk), upperOk ? "Lowercase enforced" : `${o.uppercaseUrls.length} uppercase URLs`);
  V("26.5", boolVerdict(multiSlashOk), multiSlashOk ? "No multiple slashes" : `${o.multiSlashUrls.length} multi-slash URLs`);
  V("26.6", "warn", "Manual: verify trailing-slash handling / 301 redirect.");

  V("27.1", boolVerdict(o.soft404.length === 0), o.soft404.length === 0 ? "No soft-404s detected" : `${o.soft404.length} possible soft-404s`);
  V("27.2", boolVerdict(o.status5xx.length === 0), o.status5xx.length === 0 ? "No 5xx server errors" : `${o.status5xx.length} 5xx responses`);
  V("27.3", boolVerdict(o.redirects302.length === 0), o.redirects302.length === 0 ? "No 302 redirects" : `${o.redirects302.length} 302 redirects`);
  V("27.4", "n-a", "307 vs 302 only applies to temporary product redirects (manual).");
  V("27.5", "warn", "Custom 404 page not verified (check 404 page has CTA + category links).");

  const ps = c.psi;
  V("28.1", ps ? (ps.mobileScore !== null ? boolVerdict(ps.mobileScore >= 50) : "n-a") : "n-a",
    ps && ps.mobileScore !== null ? `PSI mobile ${ps.mobileScore}` : "PSI unavailable");
  V("28.2", "n-a", "GTMetrix / Pingdom score is manual.");
  V("28.3", "n-a", "Site speed via Screaming Frog PSI API (manual).");
  V("28.4", ps && ps.mobileLcpMs !== null ? boolVerdict(ps.mobileLcpMs < 2500) : "n-a",
    ps && ps.mobileLcpMs !== null ? `LCP ${ps.mobileLcpMs}ms, CLS ${ps.mobileCls}` : "CWV data unavailable");

  // ---- Local ---------------------------------------------
  V("29.1", "n-a", "Manual: store pages for brick-and-mortar.");
  V("29.2", "manual", "Manual: verify business-directory listings.");
  V("29.3", "manual", "Manual: check NAP consistency.");
  V("29.4", "manual", "AM please create separate task (GMB setup).");

  // ---- Tracking ---------------------------------------------
  V("30.1", ga4.ga4Linked ? "warn" : "n-a", ga4.ga4Linked ? "GA4 linked — verify conversions/goals" : "GA4 not linked in MCP — skipped.");
  V("30.3", ga4.ga4Linked ? "warn" : "n-a", ga4.ga4Linked ? "GA4 linked — verify ecommerce tracking" : "GA4 not linked in MCP — skipped.");
  V("30.4", "manual", "Does the client need a separate CRO audit?");

  // ---- Off-Page ---------------------------------------------
  V("31.1", ahrefs ? "warn" : "n-a", ahrefs ? `${ahrefs.backlinks} backlinks, ${ahrefs.refdomains} referring domains` : "Ahrefs not configured");
  V("31.2", "n-a", "Backlink budget assessment is manual (Ahrefs plan).");
  V("31.3", "n-a", "Disavow need assessment is manual (SME N/A).");

  // ---- Standard Procedures (all manual) ----------------------------------
  // Leave as-is (kind manual, verdict manual from checklist).

  // Assemble sections preserving checklist order.
  for (const sec of CHECKLIST) {
    const items = sec.items.map((it) => {
      const updated = byId.get(it.id) ?? it;
      if (updated.kind === "manual" && updated.verdict === "manual") {
        updated.evidence = updated.instruction ?? "Manual step — complete in Sentr/ticket.";
      }
      return updated;
    });
    sections.push({ name: sec.name, items });
  }
  return sections;
}

// ---- semi-auto LLM review -----------------------------------------------

async function llmReview(
  sections: AuditSection[],
  crawl: CrawlResult,
  domain: string
): Promise<void> {
  const semiIds = SEMI_AUTO_IDS;
  const targets = new Map<string, CheckItem>();
  for (const sec of sections) {
    for (const it of sec.items) if (semiIds.has(it.id)) targets.set(it.id, it);
  }
  if (targets.size === 0) return;

  const sample = crawl.pages.slice(0, 10).map((p) => ({
    url: p.url,
    title: p.title,
    desc: p.metaDescription,
    h1: p.h1s[0],
  }));

  const list = [...targets.values()].map((it) => `${it.id}: ${it.item}`).join("\n");
  const system =
    "You are an SEO auditor. Review the sampled site pages and return a strict JSON object " +
    "mapping each check id to {verdict, evidence}. Verdict is one of pass|fail|warn|n-a. " +
    "Evidence is 1 sentence. Only include the listed ids. No markdown, just JSON.";
  const user =
    `Domain: ${domain}\n\nChecks to score:\n${list}\n\n` +
    `Sampled pages (first 10 crawled):\n${JSON.stringify(sample, null, 2)}\n`;

  try {
    const res = await complete({ system, user });
    const raw = res.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw) as Record<string, { verdict: Verdict; evidence?: string }>;
    for (const [id, v] of Object.entries(parsed)) {
      const it = targets.get(id);
      if (it && v && ["pass", "fail", "warn", "n-a"].includes(v.verdict)) {
        it.verdict = v.verdict;
        it.evidence = v.evidence ?? it.evidence;
        it.kind = "semi-auto";
      }
    }
  } catch (err) {
    console.error("llmReview failed:", err);
    for (const it of targets.values()) {
      if (it.verdict === "manual") it.verdict = "warn";
      it.evidence = "AI review unavailable — verify manually.";
    }
  }
}

async function llmSummary(sections: AuditSection[], domain: string): Promise<string> {
  const fail = sections.flatMap((s) => s.items.filter((i) => i.verdict === "fail"));
  const warn = sections.flatMap((s) => s.items.filter((i) => i.verdict === "warn"));
  const brief = {
    domain,
    failed: fail.slice(0, 12).map((i) => `${i.id} ${i.item} — ${i.evidence ?? ""}`),
    warned: warn.slice(0, 12).map((i) => `${i.id} ${i.item}`),
  };
  try {
    const res = await complete({
      system:
        "You write concise executive summaries for SEO audits. 4-6 bullet points: top findings, " +
        "what's working, what needs attention. Plain text, no markdown headers.",
      user: `Summarize this onsite audit for ${domain}:\n${JSON.stringify(brief, null, 2)}`,
    });
    return res.text.trim();
  } catch {
    return `Audit complete for ${domain}. ${fail.length} items need attention, ${warn.length} need review. Open the full checklist for details.`;
  }
}

// ---- orchestration ------------------------------------------------------

/**
 * Run the full audit for a target URL: crawl (progress: crawling) -> collect
 * external signals (collecting) -> map verdicts (building) -> summarize.
 */
export async function runAudit(
  target: string,
  jobId: string,
  cbs?: AuditCallbacks
): Promise<AuditResult> {
  const seedUrl = new URL(target).href;
  const domain = seedUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];

  cbs?.onProgress?.({
    jobId, status: "crawling", phase: "Crawling site",
    pagesCrawled: 0, pagesTotal: 0, message: "Starting crawl…",
    startedAt: Date.now(), updatedAt: Date.now(),
  });

  const crawl = await crawlSite(seedUrl, {
    onProgress: (done, total) =>
      cbs?.onProgress?.({
        jobId, status: "crawling", phase: "Crawling site",
        pagesCrawled: done, pagesTotal: total,
        message: `Crawled ${done} page${done === 1 ? "" : "s"}…`,
        startedAt: Date.now(), updatedAt: Date.now(),
      }),
  });

  // Site unreachable / blocking the crawler — fail fast instead of emitting a
  // meaningless audit. A page counts as rendered when status is 2xx OR the
  // browserless render produced real content (title + H1).
  const reachable = crawl.pages.some(
    (p) =>
      (p.status >= 200 && p.status < 300) ||
      (p.title !== null && p.title.length > 0 && p.h1s.length > 0)
  );
  if (!reachable) {
    const statuses = Object.entries(crawl.byStatus)
      .map(([k, v]) => `${k}×${v}`)
      .join(", ") || "no response";
    throw new Error(
      `Could not crawl ${target} — no page content received (${statuses}). ` +
        `The site may be blocking automated requests (403) or is unreachable.`
    );
  }

  cbs?.onProgress?.({
    jobId, status: "collecting", phase: "Collecting external signals",
    pagesCrawled: crawl.pages.length, pagesTotal: crawl.pages.length,
    message: "Fetching GSC / GA4 / PSI / Ahrefs…",
    startedAt: Date.now(), updatedAt: Date.now(),
  });

  const onpage = aggregateOnpage(crawl);
  const [gsc, ga4, psi, ahrefs] = await Promise.all([
    collectGsc(domain),
    collectGa4(domain),
    collectPsi(seedUrl),
    collectAhrefs(domain),
  ]);

  const sections = buildVerdicts({ crawl, onpage, gsc, ga4, psi, ahrefs });
  await llmReview(sections, crawl, domain);

  cbs?.onProgress?.({
    jobId, status: "summarizing", phase: "Generating summary",
    pagesCrawled: crawl.pages.length, pagesTotal: crawl.pages.length,
    message: "Writing executive summary…",
    startedAt: Date.now(), updatedAt: Date.now(),
  });

  const llmText = await llmSummary(sections, domain);
  const all = sections.flatMap((s) => s.items);
  const manualActions = all
    .filter((i) => i.verdict === "manual")
    .map((i) => ({ id: i.id, item: i.item, section: i.section, instruction: i.instruction ?? "" }));

  return {
    jobId,
    target: seedUrl,
    domain,
    crawl,
    sections,
    summary: {
      passed: all.filter((i) => i.verdict === "pass").length,
      failed: all.filter((i) => i.verdict === "fail").length,
      warned: all.filter((i) => i.verdict === "warn").length,
      manual: all.filter((i) => i.verdict === "manual").length,
      total: all.length,
    },
    manualActions,
    llmSummary: llmText,
    generatedAt: new Date().toISOString(),
  };
}
