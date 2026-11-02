import { NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { runLlmTool } from "@/lib/tool-api";
import { resolveRefine, listUserOutputs } from "@/lib/tool-runtime";
import type { RefineInput } from "@/lib/generator";

const TYPES = ["FAQPage", "Article", "LocalBusiness", "Product", "BreadcrumbList"];

export async function GET() {
  const outputs = await listUserOutputs("schema-generator");
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
  const url = String(body.url || "").trim();
  const type = TYPES.includes(String(body.type)) ? String(body.type) : "FAQPage";
  const keyword = String(body.keyword || "").trim();
  if (!url && !keyword) {
    return NextResponse.json({ error: "url or keyword is required" }, { status: 400 });
  }

  let refine: RefineInput | undefined;
  try {
    refine = await resolveRefine(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }

  const result = await runLlmTool({
    toolSlug: "schema-generator",
    brief: { url, type, keyword },
    refine,
    generate: async (b, r) => {
      const system =
        "You are the technical SEO specialist at First Page Digital, a Hong Kong SEO agency.\n" +
        `Generate a valid JSON-LD structured data object of type ${b.type} for the given page. Output STRICT JSON only — the raw JSON-LD object itself (it will be embedded in <script type="application/ld+json">), no prose, no markdown fences.\n` +
        "Use real details when provided (URL, keyword topic); use generic placeholder text for anything unknown. Keep it valid and complete.";
      let user = `## Page\n${JSON.stringify({ url: b.url, type: b.type, keyword: b.keyword }, null, 2)}`;
      if (r) {
        user += `\n\n## Previous Version\n${JSON.stringify(r.previous)}\n\n## Refine Instruction\n${r.instruction}\n\nRevise ONLY what the instruction asks. Keep everything else identical. Output the same JSON shape as before.`;
      }
      const res = await complete({ system, user });
      const schema = parseJson<Record<string, unknown>>(res.text);
      return {
        output: { type: b.type, schema },
        model: res.model,
        costUsd: res.costUsd,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
      };
    },
  });

  const out = result.output as { type: string; schema: Record<string, unknown> };
  return NextResponse.json({
    type: out.type,
    schema: out.schema,
    script: `<script type="application/ld+json">\n${JSON.stringify(out.schema, null, 2)}\n</script>`,
    outputId: result.outputId,
    meta: { model: result.model, costUsd: result.costUsd },
  });
}
