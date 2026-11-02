import { NextResponse } from "next/server";
import { renderDiff } from "@/lib/render-diff";
import { runQuery } from "@/lib/tool-api";

export async function POST(request: Request) {
  const body = await request.json();
  const url = String(body.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid http(s) url is required" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "render-diff",
      fetch: async () => renderDiff(url),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
