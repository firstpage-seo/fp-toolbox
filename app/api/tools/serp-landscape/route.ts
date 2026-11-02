import { NextResponse } from "next/server";
import { getMcpGsc } from "@/lib/mcp";
import { getGscSites, runQuery } from "@/lib/tool-api";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function bucketOf(position: number): string {
  if (position <= 3) return "1–3 (top 3)";
  if (position <= 10) return "4–10 (page 1)";
  if (position <= 20) return "11–20 (page 2)";
  if (position <= 50) return "21–50";
  return "50+";
}

export async function GET() {
  const sites = await getGscSites();
  return NextResponse.json({ sites });
}

export async function POST(request: Request) {
  const body = await request.json();
  const siteUrl = String(body.siteUrl || "");
  const days = Math.min(90, Math.max(1, Number(body.days) || 30));
  if (!siteUrl) {
    return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "serp-landscape",
      fetch: async () => {
        const end = new Date();
        end.setUTCDate(end.getUTCDate() - 1);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - (days - 1));
        const rows = await getMcpGsc(siteUrl, iso(start), iso(end), 1000);
        const byBucket = new Map<string, { queries: number; clicks: number; impressions: number }>();
        for (const r of rows) {
          const key = bucketOf(r.position ?? 0);
          const cur = byBucket.get(key) ?? { queries: 0, clicks: 0, impressions: 0 };
          cur.queries++;
          cur.clicks += r.clicks ?? 0;
          cur.impressions += r.impressions ?? 0;
          byBucket.set(key, cur);
        }
        const order = ["1–3 (top 3)", "4–10 (page 1)", "11–20 (page 2)", "21–50", "50+"];
        const buckets = order.map((name) => ({
          position: name,
          queries: byBucket.get(name)?.queries ?? 0,
          clicks: byBucket.get(name)?.clicks ?? 0,
          impressions: byBucket.get(name)?.impressions ?? 0,
        }));
        const topQueries = rows
          .map((r) => ({
            query: (r.keys ?? []).join(" "),
            impressions: r.impressions ?? 0,
            clicks: r.clicks ?? 0,
            ctr: r.ctr ?? 0,
            position: r.position ?? 0,
          }))
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 20);
        return { siteUrl, days, buckets, topQueries };
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
