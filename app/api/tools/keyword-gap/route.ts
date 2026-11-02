import { NextResponse } from "next/server";
import { getCompetitorKeywords } from "@/lib/ahrefs";
import { runQuery } from "@/lib/tool-api";

function cleanDomain(input: string): string {
  return input.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

const COUNTRIES = ["hk", "us", "sg", "au", "uk", "tw", "cn"];

export async function POST(request: Request) {
  const body = await request.json();
  const domainA = cleanDomain(String(body.domainA || ""));
  const domainB = cleanDomain(String(body.domainB || ""));
  const country = COUNTRIES.includes(String(body.country)) ? String(body.country) : "hk";
  const limit = Math.min(200, Math.max(10, Number(body.limit) || 50));
  if (!domainA || !domainB) {
    return NextResponse.json({ error: "domainA and domainB are required" }, { status: 400 });
  }
  if (domainA === domainB) {
    return NextResponse.json({ error: "domainA and domainB must differ" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "keyword-gap",
      fetch: async () => {
        const [a, b] = await Promise.all([
          getCompetitorKeywords(domainA, { country, limit }),
          getCompetitorKeywords(domainB, { country, limit }),
        ]);
        // Opportunities: keywords domainB ranks for that domainA does not.
        const gap = b.keywords
          .filter((k) => !a.keywords.some((ak) => ak.keyword.toLowerCase() === k.keyword.toLowerCase()))
          .sort((x, y) => y.volume - x.volume)
          .slice(0, limit);
        return {
          domainA,
          domainB,
          country,
          aKeywordCount: a.keywords.length,
          bKeywordCount: b.keywords.length,
          gapCount: gap.length,
          gap,
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
