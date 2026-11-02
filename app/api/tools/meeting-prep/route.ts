import { NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { getClientData } from "@/lib/client-data";
import type { ClientDataResult } from "@/lib/client-data";
import { runLlmTool, getGscSites } from "@/lib/tool-api";
import { resolveRefine, listUserOutputs } from "@/lib/tool-runtime";
import type { RefineInput } from "@/lib/generator";

export interface MeetingBrief {
  title: string;
  overview: string;
  keyFindings: { stat: string; insight: string }[];
  talkingPoints: string[];
  questions: string[];
  recommendations: string[];
}

/** Strip markdown code fences and parse the LLM's JSON output. */
function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

function fmtPct(v: number | null | undefined): string {
  return v == null ? "n/a" : `${Math.round(v * 100)}%`;
}

function buildContext(d: ClientDataResult): string {
  const parts: string[] = ["## Real client data (use it, never fabricate)"];
  parts.push(`- URL: ${d.url} · domain: ${d.domain}`);
  parts.push(
    `- Portfolio match: GSC ${d.matched.gscSite ?? "none"} · GA4 ${d.matched.ga4Property ?? "none"}`
  );
  if (d.gsc?.totals) {
    parts.push(
      `- GSC (30d): ${d.gsc.totals.clicks} clicks, ${d.gsc.totals.impressions} impressions, ` +
        `CTR ${fmtPct(d.gsc.totals.ctr)}, avg position ${Math.round(d.gsc.totals.position * 10) / 10}`
    );
    if (d.gsc.topQueries.length) {
      parts.push(
        `- GSC top queries: ${d.gsc.topQueries
          .map((q) => `"${q.query}" (${q.clicks} clicks, pos ${Math.round(q.position)})`)
          .join("; ")}`
      );
    }
  }
  if (d.ga4?.totals) {
    parts.push(
      `- GA4 (30d): ${d.ga4.totals.activeUsers} active users, ${d.ga4.totals.sessions} sessions`
    );
  }
  if (d.psi?.performanceScore != null) {
    parts.push(
      `- PageSpeed (mobile): ${d.psi.performanceScore}/100, LCP ${d.psi.lcpMs ? Math.round(d.psi.lcpMs / 1000) + "s" : "n/a"}, CLS ${d.psi.cls ?? "n/a"}`
    );
  }
  if (d.ahrefs?.keywords?.length) {
    parts.push(
      `- Ahrefs top keywords: ${d.ahrefs.keywords.map((k) => `"${k.keyword}" (${k.volume})`).join("; ")}`
    );
  }
  if (d.aiVisibility) {
    parts.push(
      `- AI visibility: ${d.aiVisibility.totalCitations} citations / ${d.aiVisibility.totalPages} pages across ${d.aiVisibility.platforms.length} AI platforms`
    );
  }
  if (d.errors.length) {
    parts.push(`- Data gaps (do not mention in the brief): ${d.errors.join("; ")}`);
  }
  return parts.join("\n");
}

export async function GET() {
  // Portfolio URL suggestions for the input's datalist + saved-output history.
  const sites = await getGscSites();
  const outputs = await listUserOutputs("meeting-prep");
  return NextResponse.json({ sites: sites.map((s) => s.siteUrl), outputs: outputs ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const url = String(body.url || "").trim();
  const clientName = String(body.clientName || "").trim();
  const focus = String(body.focus || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid http(s) client url is required" }, { status: 400 });
  }

  let refine: RefineInput | undefined;
  try {
    refine = await resolveRefine(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }

  // Collect the data once — a refine reuses the same snapshot instead of re-hitting every API.
  const data = await getClientData(url);
  const brief: Record<string, unknown> = { url, clientName, focus, data };

  const result = await runLlmTool({
    toolSlug: "meeting-prep",
    brief,
    refine,
    generate: async (b, r) => {
      const d = (b.data as ClientDataResult) ?? data;
      const context = buildContext(d);
      const system =
        "You are the senior SEO account strategist at First Page Digital, a Hong Kong performance marketing agency.\n" +
        "Write a client meeting prep brief. Output STRICT JSON only, no prose around it, in this shape:\n" +
        '{"title": string, "overview": string, "keyFindings": [{"stat": string, "insight": string}], ' +
        '"talkingPoints": string[], "questions": string[], "recommendations": string[]}\n' +
        "Guidelines: 4-6 keyFindings, 3-5 talkingPoints, 4-6 questions, 3-5 recommendations. Use the real data — never fabricate numbers. Be direct and client-friendly.";
      let user = `## Client\n${JSON.stringify({ url: b.url, clientName: b.clientName, focus: b.focus }, null, 2)}\n\n${context}`;
      if (r) {
        user += `\n\n## Previous Version\n${JSON.stringify(r.previous)}\n\n## Refine Instruction\n${r.instruction}\n\nRevise ONLY what the instruction asks. Keep everything else identical. Output the same JSON shape as before.`;
      }
      const res = await complete({ system, user });
      const brief = parseJson<MeetingBrief>(res.text);
      return {
        output: brief,
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
