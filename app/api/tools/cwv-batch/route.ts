import { NextResponse } from "next/server";
import { getMcpPsi } from "@/lib/mcp";
import { runQuery } from "@/lib/tool-api";

const MAX_URLS = 10;

export async function POST(request: Request) {
  const body = await request.json();
  const urls: string[] = Array.isArray(body.urls)
    ? body.urls.map((u: unknown) => String(u).trim()).filter(Boolean)
    : [];
  if (urls.length === 0) {
    return NextResponse.json({ error: "At least one url is required" }, { status: 400 });
  }
  if (urls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `Up to ${MAX_URLS} urls per run` },
      { status: 400 }
    );
  }
  if (urls.some((u) => !/^https?:\/\//i.test(u))) {
    return NextResponse.json({ error: "Every url must start with http(s)://" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "cwv-batch",
      fetch: async () => {
        const results = await Promise.all(
          urls.map((url) => getMcpPsi(url).catch(() => null))
        );
        return {
          audited: urls.length,
          rows: urls.map((url, i) => {
            const r = results[i];
            return {
              url,
              performanceScore: r?.performanceScore ?? null,
              lcpMs: r?.lcpMs ?? null,
              cls: r?.cls ?? null,
              status: r ? "ok" : "failed",
            };
          }),
        };
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
