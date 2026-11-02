import { NextResponse } from "next/server";
import { getDealsReport, aggregateDeals } from "@/lib/hubspot-deals";
import { runQuery } from "@/lib/tool-api";

export async function POST(request: Request) {
  const body = await request.json();
  const days = Math.min(90, Math.max(1, Number(body.days) || 30));
  try {
    const { data } = await runQuery({
      toolSlug: "pipeline-pulse",
      fetch: async () => {
        const report = await getDealsReport(days);
        const agg = aggregateDeals(report);
        return {
          days,
          newCount: agg.newCount,
          pipelineValue: agg.pipelineValue,
          avgAmount: agg.avgAmount,
          funnel: agg.funnel,
          closedWon: agg.closedWon,
          closedLostCount: agg.closedLostCount,
          perOwner: agg.perOwner,
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
