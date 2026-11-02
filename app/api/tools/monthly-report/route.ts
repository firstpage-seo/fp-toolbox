import { NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { getClientData } from "@/lib/client-data";
import type { ClientDataResult } from "@/lib/client-data";
import { runLlmTool, getGscSites } from "@/lib/tool-api";
import { resolveRefine, listUserOutputs } from "@/lib/tool-runtime";
import type { RefineInput } from "@/lib/generator";

export interface ReportSection {
  heading: string;
  paragraphs: string[];
  bullets: string[];
}

export interface MonthlyReport {
  title: string;
  summary: string;
  sections: ReportSection[];
}

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
  parts.push(`- URL: ${d.url}`);
  if (d.gsc?.totals) {
    parts.push(
      `- GSC (30d): ${d.gsc.totals.clicks} clicks, ${d.gsc.totals.impressions} impressions, ` +
        `CTR ${fmtPct(d.gsc.totals.ctr)}, avg position ${Math.round(d.gsc.totals.position * 10) / 10}`
    );
    if (d.gsc.topQueries.length) {
      parts.push(
        `- Top queries: ${d.gsc.topQueries
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
      `- AI visibility: ${d.aiVisibility.totalCitations} citations / ${d.aiVisibility.totalPages} pages`
    );
  }
  if (d.errors.length) {
    parts.push(`- Data gaps (do not mention in the report): ${d.errors.join("; ")}`);
  }
  return parts.join("\n");
}

export async function GET() {
  const sites = await getGscSites();
  const outputs = await listUserOutputs("monthly-report");
  return NextResponse.json({ sites: sites.map((s) => s.siteUrl), outputs: outputs ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const url = String(body.url || "").trim();
  const clientName = String(body.clientName || "").trim();
  const period = String(body.period || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid http(s) client url is required" }, { status: 400 });
  }

  let refine: RefineInput | undefined;
  try {
    refine = await resolveRefine(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }

  const data = await getClientData(url);
  const brief: Record<string, unknown> = { url, clientName, period, data };

  const result = await runLlmTool({
    toolSlug: "monthly-report",
    brief,
    refine,
    generate: async (b, r) => {
      const d = (b.data as ClientDataResult) ?? data;
      const context = buildContext(d);
      const system =
        "You are the SEO account manager at First Page Digital, a Hong Kong performance marketing agency.\n" +
        "Write a client-facing monthly SEO report. Output STRICT JSON only:\n" +
        '{"title": string, "summary": string, "sections": [{"heading": string, "paragraphs": string[], "bullets": string[]}]}\n' +
        "Guidelines: 4-6 sections (e.g. Organic Search Performance, Traffic, Site Health, AI Visibility, Next Steps). Use the real data — never fabricate numbers. Professional, concrete, no fluff.";
      let user = `## Client\n${JSON.stringify({ url: b.url, clientName: b.clientName, period: b.period }, null, 2)}\n\n${context}`;
      if (r) {
        user += `\n\n## Previous Version\n${JSON.stringify(r.previous)}\n\n## Refine Instruction\n${r.instruction}\n\nRevise ONLY what the instruction asks. Keep everything else identical. Output the same JSON shape as before.`;
      }
      const res = await complete({ system, user });
      const report = parseJson<MonthlyReport>(res.text);
      return {
        output: report,
        model: res.model,
        costUsd: res.costUsd,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
      };
    },
  });

  return NextResponse.json({
    report: result.output,
    outputId: result.outputId,
    meta: { model: result.model, costUsd: result.costUsd },
  });
}
