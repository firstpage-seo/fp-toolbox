import { NextResponse } from "next/server";
import { currentUsername } from "@/lib/auth";
import { getWebsiteData, getSalesData } from "@/lib/dashboard";
import { buildAiPlans } from "@/lib/ai-plans";

export const dynamic = "force-dynamic";

/**
 * AI-plan panel (one shared LLM call for both zones — memoized 1h, last-good
 * fallback on failure), fetched client-side after hydration. Split from
 * /api/dashboard/panels so the up-to-90s generation never delays the PSI
 * card; the AI-plan cards show their skeleton while this runs.
 */
export async function GET(request: Request) {
  const user = await currentUsername();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Number(new URL(request.url).searchParams.get("days")) || 30;
  const plans = await Promise.all([getWebsiteData(days), getSalesData(days)]).then(
    ([web, sales]) => buildAiPlans(web, sales)
  );
  return NextResponse.json({ plans });
}
