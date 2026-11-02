// lib/pdf.ts — server-side HTML→PDF via the self-hosted browserless /pdf endpoint.
// Server-side only. BROWSERLESS_URL must be set or callers get a clear error.
// Verified against browserless.firstpage.com.hk: body is {html, options} and
// returns a raw PDF document.

const BROWSERLESS_URL = process.env.BROWSERLESS_URL || "";
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || "";

export interface PdfOptions {
  landscape?: boolean;
  format?: "A4" | "Letter";
  margins?: { top: string; bottom: string; left: string; right: string };
}

export class PdfError extends Error {}

/** Render an HTML string to a PDF buffer via browserless /pdf. */
export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
  if (!BROWSERLESS_URL) {
    throw new PdfError("BROWSERLESS_URL is not configured — PDF export unavailable");
  }
  const endpoint = new URL("/pdf", BROWSERLESS_URL);
  if (BROWSERLESS_TOKEN) endpoint.searchParams.set("token", BROWSERLESS_TOKEN);
  const res = await fetch(endpoint.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: {
        format: opts.format ?? "A4",
        landscape: opts.landscape ?? false,
        printBackground: true,
        ...(opts.margins ? { margin: opts.margins } : {}),
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PdfError(`browserless /pdf failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new PdfError("browserless /pdf returned an empty document");
  return buf;
}
