import { NextResponse } from "next/server";
import { captureScreenshot } from "@/lib/screenshot";
import { runQuery } from "@/lib/tool-api";

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

export async function POST(request: Request) {
  const body = await request.json();
  const url = String(body.url || "").trim();
  const device = body.device === "mobile" ? "mobile" : "desktop";
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid http(s) url is required" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "page-screenshot",
      fetch: async () => {
        const viewport = VIEWPORTS[device];
        const dataUrl = await captureScreenshot(url, viewport);
        return { url, device, viewport, dataUrl };
      },
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
