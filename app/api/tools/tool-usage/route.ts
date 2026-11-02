import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usage";
import { runQuery } from "@/lib/tool-api";

export async function POST(request: Request) {
  const body = await request.json();
  const daysRaw = Number(body.days);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(365, Math.floor(daysRaw)) : undefined;
  try {
    const { data } = await runQuery({
      toolSlug: "tool-usage",
      fetch: async () => {
        const stats = await getUsageStats(days);
        return { ...stats, windowDays: days ?? null };
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
