import { NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { getCompetitorKeywords } from "@/lib/ahrefs";
import { runLlmTool } from "@/lib/tool-api";
import { resolveRefine, listUserOutputs } from "@/lib/tool-runtime";
import type { RefineInput } from "@/lib/generator";

interface KeywordVolume {
  keyword: string;
  volume: number;
}

export async function GET() {
  const outputs = await listUserOutputs("seo-roi");
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
  const domain = String(body.domain || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const rawKeywords = Array.isArray(body.keywords)
    ? body.keywords
    : String(body.keywords || "").split(/[\n,;]+/);
  const manualKeywords = rawKeywords.map((k: unknown) => String(k).trim()).filter(Boolean);
  const avgDealValue = Number(body.avgDealValue);
  const conversionRate = Math.min(20, Math.max(0.1, Number(body.conversionRate) || 2));
  if (!manualKeywords.length && !domain) {
    return NextResponse.json({ error: "keywords or domain is required" }, { status: 400 });
  }
  if (!Number.isFinite(avgDealValue) || avgDealValue <= 0) {
    return NextResponse.json({ error: "avgDealValue must be a positive number" }, { status: 400 });
  }

  let refine: RefineInput | undefined;
  try {
    refine = await resolveRefine(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }

  const result = await runLlmTool({
    toolSlug: "seo-roi",
    brief: { domain, keywords: manualKeywords, avgDealValue, conversionRate },
    refine,
    generate: async (b, r) => {
      // Volumes: manual keywords win; else pull the domain's top keywords from Ahrefs.
      let volumes: KeywordVolume[] = manualKeywords.map((k: string) => ({ keyword: k, volume: 0 }));
      if (domain) {
        try {
          const kw = await getCompetitorKeywords(domain, { country: "hk", limit: 5 });
          const byName = new Map(kw.keywords.map((k) => [k.keyword.toLowerCase(), k.volume]));
          volumes = volumes.map((v) => {
            const hit = byName.get(v.keyword.toLowerCase());
            return hit !== undefined ? { ...v, volume: hit } : v;
          });
          if (!manualKeywords.length) {
            volumes = kw.keywords.map((k) => ({ keyword: k.keyword, volume: k.volume }));
          }
        } catch {
          // volumes stay 0 — the LLM will flag the assumption
        }
      }

      const system =
        "You are the SEO analyst at First Page Digital, a Hong Kong SEO agency.\n" +
        "Build a transparent SEO ROI estimate. Output STRICT JSON only:\n" +
        '{"estimate": {"monthlyTraffic": number, "monthlyLeads": number, "monthlyRevenue": number, "annualRevenue": number}, ' +
        '"assumptions": string[], "narrative": string}\n' +
        "Method: use standard position-based CTR curves (top-3 ≈ 20-30% of volume), the provided conversion rate and average deal value. State every assumption in assumptions[] — flag volumes you had to guess as 'estimated volume'. The narrative is 2-3 sentences for a sales context, using the real numbers.";
      let user = `## Inputs\n${JSON.stringify(
        { domain: b.domain, avgDealValue: b.avgDealValue, conversionRatePct: b.conversionRate },
        null,
        2
      )}\n\n## Keyword volumes\n${volumes.map((v) => `- "${v.keyword}" — ${v.volume || "unknown"}`).join("\n")}`;
      if (r) {
        user += `\n\n## Previous Version\n${JSON.stringify(r.previous)}\n\n## Refine Instruction\n${r.instruction}\n\nRevise ONLY what the instruction asks. Keep everything else identical. Output the same JSON shape as before.`;
      }
      const res = await complete({ system, user });
      const output = parseJson<Record<string, unknown>>(res.text);
      return {
        output: { volumes, ...output },
        model: res.model,
        costUsd: res.costUsd,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
      };
    },
  });

  return NextResponse.json({
    roi: result.output,
    outputId: result.outputId,
    meta: { model: result.model, costUsd: result.costUsd },
  });
}
