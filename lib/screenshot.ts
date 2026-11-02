// lib/screenshot.ts — page screenshots via the self-hosted browserless /screenshot endpoint.
// Server-side only. Verified against browserless.firstpage.com.hk: POST /screenshot
// with {url, viewport, options:{type,fullPage}} returns the raw PNG bytes.

const BROWSERLESS_URL = process.env.BROWSERLESS_URL || "";
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || "";

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  fullPage?: boolean;
}

export class ScreenshotError extends Error {}

/** Capture a PNG screenshot of a URL via browserless /screenshot. Returns a base64 dataUrl. */
export async function captureScreenshot(
  url: string,
  opts: ScreenshotOptions = {}
): Promise<string> {
  if (!BROWSERLESS_URL) {
    throw new ScreenshotError("BROWSERLESS_URL is not configured — screenshots unavailable");
  }
  const endpoint = new URL("/screenshot", BROWSERLESS_URL);
  if (BROWSERLESS_TOKEN) endpoint.searchParams.set("token", BROWSERLESS_TOKEN);
  const res = await fetch(endpoint.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      viewport: { width: opts.width ?? 1280, height: opts.height ?? 720 },
      options: { type: "png", fullPage: opts.fullPage ?? false },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ScreenshotError(`browserless /screenshot failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) {
    throw new ScreenshotError("browserless /screenshot returned an empty image");
  }
  return `data:image/png;base64,${buf.toString("base64")}`;
}
