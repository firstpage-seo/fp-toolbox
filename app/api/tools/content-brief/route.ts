import { NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { runLlmTool } from "@/lib/tool-api";
import { resolveRefine, listUserOutputs } from "@/lib/tool-runtime";
import type { RefineInput } from "@/lib/generator";

export interface ContentBriefOutput {
  keyword: string;
  title: string;
  searchIntent: string;
  targetAudience: string;
  wordCount: number;
  outline: { heading: string; points: string[] }[];
  faqIdeas: string[];
}

export async function GET() {
  const outputs = await listUserOutputs("content-brief");
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
  const keyword = String(body.keyword || "").trim();
  const url = String(body.url || "").trim();
  const tone = String(body.tone || "professional");
  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  let refine: RefineInput | undefined;
  try {
    refine = await resolveRefine(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }

  const result = await runLlmTool({
    toolSlug: "content-brief",
    brief: { keyword, url, tone },
    refine,
    generate: async (b, r) => {
      const system =
        "You are the content strategist at First Page Digital, a Hong Kong SEO agency.\n" +
        "Write a content brief for the given target keyword. Output STRICT JSON only:\n" +
        '{"keyword": string, "title": string, "searchIntent": string, "targetAudience": string, ' +
        '"wordCount": number, "outline": [{"heading": string, "points": string[]}], "faqIdeas": string[]}\n' +
        "Guidelines: 5-8 outline sections with 2-4 points each, 3-5 FAQ ideas. Be specific and practical for a writer.";
      let user = `## Target keyword\n${b.keyword}\n\nTone: ${b.tone}`;
      if (b.url) user += `\n\nExisting page to improve: ${b.url}`;
      if (r) {
        user += `\n\n## Previous Version\n${JSON.stringify(r.previous)}\n\n## Refine Instruction\n${r.instruction}\n\nRevise ONLY what the instruction asks. Keep everything else identical. Output the same JSON shape as before.`;
      }
      const res = await complete({ system, user });
      const output = parseJson<ContentBriefOutput>(res.text);
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
    brief: result.output,
    outputId: result.outputId,
    meta: { model: result.model, costUsd: result.costUsd },
  });
}
