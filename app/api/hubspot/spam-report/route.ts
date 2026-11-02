import { NextResponse } from "next/server";
import { currentUsername } from "@/lib/auth";
import { getSpamReport } from "@/lib/hubspot";
import { cached } from "@/lib/cache";

const SPAM_REPORT_TTL_MS = 10 * 60 * 1000;

export async function GET() {
  const user = await currentUsername();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Memoized 10 min (DB-backed, survives restarts) — fresh enough for the
    // admin page without re-hitting HubSpot on every refresh.
    const report = await cached("spam-report-api:30", () => getSpamReport(30), SPAM_REPORT_TTL_MS);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Spam report failed" },
      { status: 500 }
    );
  }
}