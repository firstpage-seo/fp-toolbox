import { NextResponse } from "next/server";
import { getAiVisibility } from "@/lib/ahrefs";
import { runQuery } from "@/lib/tool-api";

export async function POST(request: Request) {
  const body = await request.json();
  const domain = String(body.domain || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "ai-visibility",
      fetch: async () => getAiVisibility(domain),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
