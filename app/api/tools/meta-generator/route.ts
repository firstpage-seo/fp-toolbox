import { NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { runLlmTool } from "@/lib/tool-api";
import { resolveRefine, listUserOutputs } from "@/lib/tool-runtime";
import type { RefineInput } from "@/lib/generator";

export interface MetaItem {
  keyword: string;
  title: string;
  description: string;
}

export async function GET() {
  const outputs = await listUserOutputs("meta-generator");
  if (!outputs) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ outputs });
}

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

export async function POST(request: Request) {
  const body = await request.json();
  const rawKeywords = Array.isArray(body.keywords)
    ? body.keywords
    : String(body.keywords || "").split(/[\n,;]+/);
  const keywords = rawKeywords
    .map((k: unknown) => String(k).trim())
    .filter(Boolean)
    .slice(0, 20);
  const locale = String(body.locale || "en-HK");
  if (keywords.length === 0) {
    return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
  }

  let refine: RefineInput | undefined;
  try {
    refine = await resolveRefine(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }

  const result = await runLlmTool({
    toolSlug: "meta-generator",
    brief: { keywords, locale },
    refine,
    generate: async (b, r) => {
      const system =
        "You are the SEO copywriter at First Page Digital, a Hong Kong performance marketing agency.\n" +
        "Write SEO title tags and meta descriptions for the given keywords. Output STRICT JSON only:\n" +
        '{"items": [{"keyword": string, "title": string, "description": string}]}\n' +
        "Guidelines: titles ≤ 60 chars, descriptions ≤ 155 chars, include the keyword naturally, one item per input keyword in the same order. Never fabricate brand names — use generic phrasing.";
      let user = `## Keywords\n${(b.keywords as string[]).map((k) => `- ${k}`).join("\n")}\n\nLocale: ${b.locale}`;
      if (r) {
        user += `\n\n## Previous Version\n${JSON.stringify(r.previous)}\n\n## Refine Instruction\n${r.instruction}\n\nRevise ONLY what the instruction asks. Keep everything else identical. Output the same JSON shape as before.`;
      }
      const res = await complete({ system, user });
      const output = parseJson<{ items: MetaItem[] }>(res.text);
      return {
        output,
        model: res.model,
        costUsd: res.costUsd,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
      };
    },
  });

  return NextResponse.json({
    items: (result.output as { items: MetaItem[] }).items,
    outputId: result.outputId,
    meta: { model: result.model, costUsd: result.costUsd },
  });
}
