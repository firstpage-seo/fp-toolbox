import { NextResponse } from "next/server";
import { getMcpPsi } from "@/lib/mcp";
import { runQuery } from "@/lib/tool-api";

export async function POST(request: Request) {
  const body = await request.json();
  const url = String(body.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid http(s) url is required" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "psi-auditor",
      fetch: async () => {
        // Lighthouse-style categories via firstpage MCP (own key, no rate limits —
        // Google's public PSI REST API v5 was decommissioned, 404).
        const result = await getMcpPsi(url, "mobile");
        const grade = (score: number | null): string => {
          if (score === null) return "n/a";
          if (score >= 90) return "Good";
          if (score >= 50) return "Needs improvement";
          return "Poor";
        };
        return {
          url: result.url,
          performance: result.performanceScore,
          accessibility: result.accessibilityScore,
          bestPractices: result.bestPracticesScore,
          seo: result.seoScore,
          lcpMs: result.lcpMs,
          cls: result.cls,
          tbtMs: result.tbtMs,
          grades: {
            performance: grade(result.performanceScore),
            accessibility: grade(result.accessibilityScore),
            bestPractices: grade(result.bestPracticesScore),
            seo: grade(result.seoScore),
          },
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
