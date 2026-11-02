"use client";

/**
 * Client-side PDF export: POST rendered HTML to /api/tools/pdf and download.
 * The HTML must carry inline styles — browserless /pdf renders it standalone
 * with no Tailwind/global CSS.
 */
export async function downloadPdf(opts: {
  html: string;
  landscape?: boolean;
  filename?: string;
}): Promise<void> {
  const filename = opts.filename || "export.pdf";
  const res = await fetch("/api/tools/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: opts.html,
      landscape: opts.landscape ?? false,
      filename,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "PDF export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
