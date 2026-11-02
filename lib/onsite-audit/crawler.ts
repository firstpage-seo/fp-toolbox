// Onsite SEO Audit — crawler.
//
// BFS crawl of a site using the self-hosted browserless HTTP content API for
// JS-rendered HTML, plus a lightweight Node fetch layer for exact status codes
// and redirect chains (which browserless's HTML endpoint doesn't surface).
// If BROWSERLESS_URL is not set, falls back to raw fetch HTML.

import { load } from "cheerio";
import {
  BROWSERLESS_URL,
  BROWSERLESS_TOKEN,
  MAX_PAGES,
  CRAWL_CONCURRENCY,
  CRAWL_DEPTH_CAP,
} from "./config";
import type { CrawlPage, CrawlResult } from "./types";

const TIMEOUT_MS = 25_000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** Follow redirects manually to capture the exact chain + final status. */
async function fetchWithRedirects(url: string, maxHops = 8): Promise<{
  status: number;
  finalUrl: string;
  chain: string[];
  contentType: string | null;
  html: string;
  sizeKb: number | null;
}> {
  let current = url;
  const chain: string[] = [];
  let status = 0;
  let contentType: string | null = null;
  let html = "";
  let sizeKb: number | null = null;
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": UA },
    });
    status = res.status;
    contentType = res.headers.get("content-type") ?? null;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      chain.push(current);
      const next = loc ? new URL(loc, current).href : current;
      if (next === current) break;
      current = next;
      continue;
    }
    chain.push(current);
    const text = await res.text();
    html = text;
    sizeKb = Math.round(new Blob([text]).size / 1024);
    break;
  }
  return { status, finalUrl: current, chain, contentType, html, sizeKb };
}

/** Render a page via self-hosted browserless /content; fallback to raw fetch. */
async function renderHtml(url: string): Promise<string | null> {
  if (!BROWSERLESS_URL) return null;
  try {
    const endpoint = new URL("/content", BROWSERLESS_URL);
    if (BROWSERLESS_TOKEN) endpoint.searchParams.set("token", BROWSERLESS_TOKEN);
    const res = await fetch(endpoint.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function crawlOne(seed: string, targetUrl: string, depth: number): Promise<CrawlPage> {
  const net = await fetchWithRedirects(targetUrl).catch((err) => ({
    status: 0,
    finalUrl: targetUrl,
    chain: [targetUrl],
    contentType: null,
    html: "",
    sizeKb: null,
    error: err instanceof Error ? err.message : String(err),
  }));

  const netError = "error" in net ? (net as unknown as CrawlPage).error : null;
  let html = net.html;
  // Prefer browserless-rendered HTML when available (JS-heavy sites).
  if (BROWSERLESS_URL) {
    const rendered = await renderHtml(targetUrl).catch(() => null);
    if (rendered && rendered.length > html.length) html = rendered;
  }

  let title: string | null = null;
  let metaDescription: string | null = null;
  let robotsMeta: string | null = null;
  let canonical: string | null = null;
  const h1s: string[] = [];
  const images: { src: string; alt: string | null; sizeKb: number | null }[] = [];
  const links: { href: string; anchor: string }[] = [];
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  const jsonLd: string[] = [];
  let hasViewport = false;

  if (html) {
    const $ = load(html);
    title = $("title").first().text().trim() || null;
    metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
    const robots = $('meta[name="robots"]').attr("content") ?? $('meta[name="googlebot"]').attr("content");
    robotsMeta = robots?.trim() || null;
    canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
    $("h1").each((_, el) => {
      const t = $(el).text().trim();
      if (t) h1s.push(t);
    });
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (!src) return;
      images.push({ src, alt: $(el).attr("alt")?.trim() || null, sizeKb: null });
    });
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const anchor = $(el).text().trim();
      links.push({ href, anchor });
    });
    $('script[type="application/ld+json"]').each((_, el) => {
      const t = $(el).text().trim();
      if (t) jsonLd.push(t);
    });
    hasViewport = $('meta[name="viewport"]').length > 0;
  }

  for (const l of links) {
    const abs = normalizeUrl(new URL(l.href, targetUrl).href);
    if (!abs) continue;
    if (sameOrigin(abs, seed)) internalLinks.push(abs);
    else externalLinks.push(abs);
  }

  const page: CrawlPage = {
    url: targetUrl,
    status: net.status,
    finalUrl: net.finalUrl,
    redirectChain: net.chain,
    contentType: net.contentType,
    title,
    metaDescription,
    robotsMeta,
    canonical,
    h1s,
    images,
    links,
    internalLinks,
    externalLinks,
    jsonLd,
    hasViewport,
    sizeKb: net.sizeKb,
    depth,
    error: netError,
  };
  return page;
}

export interface CrawlOptions {
  maxPages?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * BFS crawl from a target URL. Returns pages discovered (same-origin, 2xx/3xx/4xx
 * HTML pages only), robots.txt and sitemap text. Capped at MAX_PAGES.
 */
export async function crawlSite(target: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const seed = normalizeUrl(target) ?? target;
  const seedUrl = seed;
  const origin = new URL(seedUrl).origin;
  const maxPages = opts.maxPages ?? MAX_PAGES;
  const concurrency = opts.concurrency ?? CRAWL_CONCURRENCY;

  const queue: string[] = [seedUrl];
  const visited = new Set<string>([seedUrl]);
  const pages: CrawlPage[] = [];
  let capped = false;

  // robots.txt + sitemap fetched early (cheap, no render needed).
  const robotsTxt = await fetchText(`${origin}/robots.txt`);
  let sitemap: string | null = null;
  if (robotsTxt) {
    const sm = /^Sitemap:\s*(\S+)/im.exec(robotsTxt);
    if (sm) sitemap = (await fetchText(sm[1])) ?? null;
  }
  if (!sitemap) {
    sitemap = (await fetchText(`${origin}/sitemap.xml`)) ?? null;
  }

  while (queue.length > 0 && pages.length < maxPages && !capped) {
    const batch = queue.splice(0, concurrency);
    const results = await Promise.all(
      batch.map((u) => {
        const depth = depthOf(u, seedUrl);
        return crawlOne(seedUrl, u, depth).catch((err) => {
          const p: CrawlPage = {
            url: u, status: 0, finalUrl: u, redirectChain: [u], contentType: null,
            title: null, metaDescription: null, robotsMeta: null, canonical: null,
            h1s: [], images: [], links: [], internalLinks: [], externalLinks: [],
            jsonLd: [], hasViewport: false, sizeKb: null, depth, error: String(err),
          };
          return p;
        });
      })
    );

    for (const page of results) {
      if (pages.length >= maxPages) {
        capped = true;
        break;
      }
      // Only keep HTML pages (skip images/css/js) with sane statuses.
      const ct = page.contentType ?? "";
      if (page.status > 0 && ct && !/text\/html/.test(ct) && !/application\/xhtml/.test(ct)) continue;
      pages.push(page);
      for (const link of page.internalLinks) {
        if (!visited.has(link) && queue.length < maxPages) {
          visited.add(link);
          queue.push(link);
        }
      }
    }
    opts.onProgress?.(pages.length, maxPages);
  }

  const byStatus: Record<number, number> = {};
  let indexed = 0;
  for (const p of pages) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    if (p.status >= 200 && p.status < 300) indexed++;
  }

  return {
    seedUrl,
    origin,
    pages,
    indexed,
    byStatus,
    robotsTxt,
    sitemap,
    generatedAt: new Date().toISOString(),
    capped,
  };
}

function depthOf(url: string, seed: string): number {
  // Approximate BFS depth via path segment distance from the seed path.
  const up = new URL(url).pathname.split("/").filter(Boolean);
  const sp = new URL(seed).pathname.split("/").filter(Boolean);
  let common = 0;
  while (common < up.length && common < sp.length && up[common] === sp[common]) common++;
  return Math.min(up.length - common, CRAWL_DEPTH_CAP);
}
