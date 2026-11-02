// lib/render-diff.ts — JS-rendering SEO diagnosis.
//
// Compares the raw server HTML of a URL against the browserless-rendered DOM
// (JS executed). Big differences in title / meta / canonical / H1 mean the page
// relies on client-side rendering — content search engines may miss or see late.
// Degrades gracefully: rendered side is null when BROWSERLESS_URL is unset.

import { load } from "cheerio";

const BROWSERLESS_URL = process.env.BROWSERLESS_URL || "";
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || "";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface RenderField {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1s: string[];
  textLength: number;
}

export interface DiffRow {
  field: string;
  raw: string;
  rendered: string;
  changed: boolean;
}

export interface RenderDiffResult {
  url: string;
  rendered: boolean; // whether browserless render was available
  raw: RenderField;
  js: RenderField | null;
  differences: DiffRow[];
}

function parseFields(html: string): RenderField {
  const $ = load(html);
  const h1s: string[] = [];
  $("h1").each((_, el) => {
    const t = $(el).text().trim();
    if (t) h1s.push(t);
  });
  return {
    title: $("title").first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr("content")?.trim() || null,
    canonical: $('link[rel="canonical"]').attr("href")?.trim() || null,
    h1s,
    textLength: $("body").text().replace(/\s+/g, " ").trim().length,
  };
}

function fmt(f: RenderField): { title: string; metaDescription: string; canonical: string; h1s: string; textLength: string } {
  return {
    title: f.title ?? "—",
    metaDescription: f.metaDescription ?? "—",
    canonical: f.canonical ?? "—",
    h1s: f.h1s.length ? f.h1s.join(" | ") : "—",
    textLength: String(f.textLength),
  };
}

function compare(raw: RenderField, js: RenderField | null): DiffRow[] {
  const fields: { key: string; label: string }[] = [
    { key: "title", label: "Title" },
    { key: "metaDescription", label: "Meta description" },
    { key: "canonical", label: "Canonical" },
    { key: "h1s", label: "H1" },
    { key: "textLength", label: "Content length (chars)" },
  ];
  if (!js) {
    return fields.map((f) => ({ field: f.label, raw: "—", rendered: "n/a (browserless not configured)", changed: false }));
  }
  const a = fmt(raw);
  const b = fmt(js);
  return fields.map((f) => ({
    field: f.label,
    raw: a[f.key as keyof typeof a],
    rendered: b[f.key as keyof typeof a],
    changed: a[f.key as keyof typeof a] !== b[f.key as keyof typeof a],
  }));
}

async function fetchRaw(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Raw fetch failed (${res.status})`);
  return res.text();
}

async function renderJs(url: string): Promise<string | null> {
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

/** Compare raw server HTML vs browserless-rendered DOM for one URL. */
export async function renderDiff(url: string): Promise<RenderDiffResult> {
  const rawHtml = await fetchRaw(url);
  const raw = parseFields(rawHtml);
  const jsHtml = await renderJs(url);
  const js = jsHtml ? parseFields(jsHtml) : null;
  return {
    url,
    rendered: js != null,
    raw,
    js,
    differences: compare(raw, js),
  };
}
