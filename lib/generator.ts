import { complete } from "./llm";
import { loadBrandGuide, loadCaseStudies } from "./content";
import type { ClientGscTotals, ClientGscRow, ClientGa4Point } from "./client-data";
import type { AiVisibilityResult } from "./ahrefs";

export interface ClientBrief {
  clientName: string;
  industry: string;
  objective: string;
  targetMarket: string;
  budget: string;
  website: string;
  notes: string;
}

export interface DeckSlide {
  heading: string;
  bullets: string[];
  stat?: { value: string; label: string };
}

export interface Deck {
  title: string;
  subtitle: string;
  slides: DeckSlide[];
}

export interface ProposalSection {
  heading: string;
  paragraphs: string[];
  bullets: string[];
}

export interface Proposal {
  title: string;
  sections: ProposalSection[];
}

/** Strip markdown code fences and parse the LLM's JSON output. */
function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

export interface GenerationData {
  psi?: { performanceScore: number | null; lcpMs: number | null; cls: number | null } | null;
  competitors?: { target: string; keywords: { keyword: string; volume: number }[] } | null;
  gsc?: { totals: ClientGscTotals | null; topQueries: ClientGscRow[] } | null;
  ga4?: { totals: { activeUsers: number; sessions: number } | null; trend: ClientGa4Point[] } | null;
  aiVisibility?: AiVisibilityResult | null;
}

export interface RefineInput {
  instruction: string;
  previous: unknown;
}

function buildContext(brief: ClientBrief, data: GenerationData): string {
  const brand = loadBrandGuide();
  const cases = loadCaseStudies();
  const parts: string[] = [];
  if (brand) parts.push(`## Brand Guide\n${brand}`);
  if (cases.length) {
    parts.push(
      `## Case Studies (use these real results, never fabricate)\n${cases
        .map((c) => `- ${c.client} (${c.industry}): ${c.result}\n${c.body}`)
        .join("\n")}`
    );
  }
  if (data.psi?.performanceScore != null) {
    parts.push(
      `## Client Website Performance (PageSpeed Insights, real data)\n` +
        `- Performance score: ${data.psi.performanceScore}/100\n` +
        `- LCP: ${data.psi.lcpMs ? Math.round(data.psi.lcpMs / 1000) + "s" : "n/a"} · CLS: ${data.psi.cls ?? "n/a"}`
    );
  }
  if (data.competitors?.keywords?.length) {
    parts.push(
      `## Competitor Organic Keywords (Ahrefs, real data)\n` +
        data.competitors.keywords
          .map((k) => `- "${k.keyword}" — volume ${k.volume}`)
          .join("\n")
    );
  }
  if (data.gsc?.totals) {
    parts.push(
      `## Client Organic Search (Google Search Console, real data)\n` +
        `- ${data.gsc.totals.clicks} clicks · ${data.gsc.totals.impressions} impressions · ` +
        `CTR ${Math.round((data.gsc.totals.ctr ?? 0) * 100)}% · avg position ${Math.round(data.gsc.totals.position * 10) / 10}`
    );
    if (data.gsc.topQueries.length) {
      parts.push(
        `- Top queries: ` +
          data.gsc.topQueries
            .map((q) => `"${q.query}" (${q.clicks} clicks, pos ${Math.round(q.position)})`)
            .join("; ")
      );
    }
  }
  if (data.ga4?.totals) {
    parts.push(
      `## Client Traffic (GA4, real data)\n` +
        `- ${data.ga4.totals.activeUsers} active users · ${data.ga4.totals.sessions} sessions over 30 days`
    );
  }
  if (data.aiVisibility) {
    parts.push(
      `## Client AI Visibility (Ahrefs, real data)\n` +
        `- ${data.aiVisibility.totalCitations} citations across ${data.aiVisibility.platforms.length} AI search platforms`
    );
  }
  return parts.join("\n\n");
}

export async function generateDeck(brief: ClientBrief, data: GenerationData, refine?: RefineInput) {
  const context = buildContext(brief, data);
  const system = `You are the senior pitch deck writer at First Page Digital, a Hong Kong performance marketing agency.
Produce a pitch deck for the given client brief. Output STRICT JSON only, no prose around it, in this shape:
{"title": string, "subtitle": string, "slides": [{"heading": string, "bullets": string[], "stat"?: {"value": string, "label": string}}]}
Guidelines: 8-12 slides. Use the real data provided (case studies, PSI, competitor keywords) — never fabricate numbers. Be specific and direct. Slides should cover: client challenge, why us, data insights, proposed approach, channel mix, case proof, investment, next steps.`;
  const user = buildUserPrompt(brief, context, refine);
  const result = await complete({ system, user });
  const deck = parseJson<Deck>(result.text);
  return { ...result, deck };
}

export async function generateProposal(brief: ClientBrief, data: GenerationData, refine?: RefineInput) {
  const context = buildContext(brief, data);
  const system = `You are the senior proposal writer at First Page Digital, a Hong Kong performance marketing agency.
Write a full proposal draft for the given client brief. Output STRICT JSON only, no prose around it, in this shape:
{"title": string, "sections": [{"heading": string, "paragraphs": string[], "bullets": string[]}]}
Guidelines: sections should cover Executive Summary, Our Understanding of Your Challenge, Strategic Approach, Channel Plan, Case Proof, Investment, Next Steps. Use the real data provided (case studies, PSI, competitor keywords) — never fabricate numbers. Be specific and direct.`;
  const user = buildUserPrompt(brief, context, refine);
  const result = await complete({ system, user });
  const proposal = parseJson<Proposal>(result.text);
  return { ...result, proposal };
}

function buildUserPrompt(brief: ClientBrief, context: string, refine?: RefineInput): string {
  let user = `## Client Brief\n${JSON.stringify(brief, null, 2)}\n\n${context}`;
  if (refine) {
    user += `\n\n## Previous Version\n${JSON.stringify(refine.previous)}\n\n## Refine Instruction\n${refine.instruction}\n\nRevise ONLY what the instruction asks. Keep everything else identical. Output the same JSON shape as before.`;
  }
  return user;
}
