import { NextResponse } from "next/server";
import { getMcpGa4, type Ga4Report } from "@/lib/mcp";
import { getGa4Properties, runQuery } from "@/lib/tool-api";

export async function GET() {
  const properties = await getGa4Properties();
  return NextResponse.json({ properties });
}

export async function POST(request: Request) {
  const body = await request.json();
  const propertyId = String(body.propertyId || "");
  const days = Math.min(90, Math.max(1, Number(body.days) || 30));
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "ga4-snapshot",
      fetch: async () => {
        const report: Ga4Report = await getMcpGa4(
          propertyId,
          ["activeUsers", "sessions"],
          ["date"],
          `${days}daysAgo`,
          "today"
        );
        const uIdx = report.metricHeaders.findIndex((h) => h.name === "activeUsers");
        const sIdx = report.metricHeaders.findIndex((h) => h.name === "sessions");
        let users = 0;
        let sessions = 0;
        const trend: { date: string; activeUsers: number; sessions: number }[] = [];
        for (const row of report.rows) {
          const u = Number(row.metricValues[uIdx]?.value ?? 0);
          const s = Number(row.metricValues[sIdx]?.value ?? 0);
          users += u;
          sessions += s;
          const date = row.dimensionValues?.[0]?.value;
          if (date) trend.push({ date, activeUsers: u, sessions: s });
        }
        trend.sort((a, b) => a.date.localeCompare(b.date));
        return {
          propertyId,
          days,
          totals: { activeUsers: users, sessions },
          trend,
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
