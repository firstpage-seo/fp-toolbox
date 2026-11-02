import { NextResponse } from "next/server";
import { getCompetitorKeywords } from "@/lib/ahrefs";
import { runQuery } from "@/lib/tool-api";

const COUNTRIES = ["hk", "us", "sg", "au", "uk", "tw", "cn"];

export async function POST(request: Request) {
  const body = await request.json();
  const domain = String(body.domain || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const country = COUNTRIES.includes(String(body.country)) ? String(body.country) : "hk";
  const limit = Math.min(50, Math.max(1, Number(body.limit) || 10));
  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "competitor-profiler",
      fetch: async () => getCompetitorKeywords(domain, { country, limit }),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
