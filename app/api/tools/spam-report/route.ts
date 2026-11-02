import { NextResponse } from "next/server";
import { getSpamReport } from "@/lib/hubspot";
import { runQuery } from "@/lib/tool-api";

export async function POST(request: Request) {
  const body = await request.json();
  const days = Math.min(90, Math.max(1, Number(body.days) || 30));
  try {
    const { data } = await runQuery({
      toolSlug: "spam-report",
      fetch: async () => getSpamReport(days),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
