import { NextResponse } from "next/server";
import { getMcpGsc } from "@/lib/mcp";
import { getGscSites, runQuery } from "@/lib/tool-api";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const sites = await getGscSites();
  return NextResponse.json({ sites });
}

export async function POST(request: Request) {
  const body = await request.json();
  const siteUrl = String(body.siteUrl || "");
  const days = Math.min(90, Math.max(1, Number(body.days) || 30));
  const minClicks = Math.max(0, Number(body.minClicks) || 0);
  const query = String(body.query || "").trim().toLowerCase();
  if (!siteUrl) {
    return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "gsc-explorer",
      fetch: async () => {
        const end = new Date();
        end.setUTCDate(end.getUTCDate() - 1);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - (days - 1));
        const rows = await getMcpGsc(siteUrl, iso(start), iso(end), 1000);
        const filtered = rows
          .filter((r) => (r.clicks ?? 0) >= minClicks)
          .filter((r) => !query || (r.keys ?? []).join(" ").toLowerCase().includes(query))
          .map((r) => ({
            query: (r.keys ?? []).join(" "),
            clicks: r.clicks ?? 0,
            impressions: r.impressions ?? 0,
            ctr: r.ctr ?? 0,
            position: r.position ?? 0,
          }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 100);
        return {
          siteUrl,
          days,
          totals: {
            clicks: filtered.reduce((s, r) => s + r.clicks, 0),
            impressions: filtered.reduce((s, r) => s + r.impressions, 0),
          },
          rows: filtered,
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
