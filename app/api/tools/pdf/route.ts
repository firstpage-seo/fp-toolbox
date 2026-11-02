import { NextResponse } from "next/server";
import { currentUsername } from "@/lib/auth";
import { htmlToPdf, PdfError } from "@/lib/pdf";
import { logUsage } from "@/lib/usage";

const MAX_HTML = 1_000_000; // 1MB cap — documents are small, this guards abuse.

export async function POST(request: Request) {
  const body = await request.json();
  const html = String(body.html || "");
  const landscape = Boolean(body.landscape);
  const rawFilename = String(body.filename || "export.pdf");
  const filename = rawFilename.replace(/[^\w.\-]/g, "").slice(0, 120) || "export.pdf";

  if (!html.trim()) {
    return NextResponse.json({ error: "html is required" }, { status: 400 });
  }
  if (html.length > MAX_HTML) {
    return NextResponse.json({ error: "html too large (max 1MB)" }, { status: 400 });
  }

  const user = (await currentUsername()) || "unknown";
  const started = Date.now();
  try {
    const pdf = await htmlToPdf(html, { landscape });
    await logUsage({
      user,
      toolSlug: "pdf",
      action: "export",
      durationMs: Date.now() - started,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
    }).catch(() => undefined);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (err) {
    const msg =
      err instanceof PdfError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
