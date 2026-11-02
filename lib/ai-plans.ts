import { complete } from "./llm";
import { cached, peekCache, writeCache } from "./cache";
import type { WebsiteData, SalesData } from "./dashboard";

export interface AiPlan {
  /** One concrete, executable action. */
  action: string;
  /** Why — must cite a real number from the dashboard snapshot. */
  why: string;
  impact: "high" | "medium" | "low";
}

export interface AiPlans {
  website: AiPlan[];
  sales: AiPlan[];
}

const SYSTEM_PROMPT = `You are the growth strategist at First Page Digital, a Hong Kong performance marketing agency, advising on firstpage.hk (the agency's own site). Given the real dashboard snapshot, produce concrete actionable next-step plans.

Output STRICT JSON only, no prose around it, in exactly this shape:
{"website":[{"action":string,"why":string,"impact":"high"|"medium"|"low"}],"sales":[{"action":string,"why":string,"impact":"high"|"medium"|"low"}]}

Rules:
- 3-4 plans per section.
- Every "why" must cite a real number from the snapshot provided. Never fabricate metrics.
- Actions must be concrete and executable within a week by the team — not generic advice.
- "impact" is the expected business impact of doing it.
- Keep "action" under 12 words and "why" under 20 words — dashboard bullets, not essays.`;

const pct = (n: number | null): string => (n === null ? "n/a" : `${n > 0 ? "+" : ""}${n.toFixed(0)}%`);

/** Compact, LLM-friendly snapshot of the dashboard metrics (real numbers only). */
export function buildDashboardSummary(web: WebsiteData, sales: SalesData): string {
  const lines: string[] = [`Dashboard snapshot — last ${web.rangeDays} days (vs previous ${web.rangeDays} days)`];

  lines.push("\nWEBSITE");
  lines.push(`- GA4 active users: ${web.ga4.totals?.activeUsers ?? "n/a"} (delta ${pct(web.deltas.ga4Users)}), sessions: ${web.ga4.totals?.sessions ?? "n/a"} (delta ${pct(web.deltas.ga4Sessions)})`);
  lines.push(`- GSC: ${web.gsc.totals?.impressions ?? "n/a"} impressions (delta ${pct(web.deltas.gscImpressions)}), ${web.gsc.totals?.clicks ?? "n/a"} clicks (delta ${pct(web.deltas.gscClicks)}), CTR ${web.gsc.totals ? (web.gsc.totals.ctr * 100).toFixed(1) + "%" : "n/a"}, avg position ${web.gsc.totals?.position.toFixed(1) ?? "n/a"}`);
  if (web.gsc.queries.length) {
    lines.push(`- Top queries: ${web.gsc.queries.slice(0, 5).map((q) => `"${q.query}" (${q.clicks} clicks, pos ${q.position.toFixed(0)})`).join("; ")}`);
  }
  if (web.psi.result) {
    lines.push(`- PageSpeed mobile: ${web.psi.result.performanceScore ?? "n/a"}/100, LCP ${web.psi.result.lcpMs !== null ? (web.psi.result.lcpMs / 1000).toFixed(1) + "s" : "n/a"}, CLS ${web.psi.result.cls ?? "n/a"}`);
  }
  if (web.ahrefs.result?.keywords.length) {
    lines.push(`- Ahrefs top keywords: ${web.ahrefs.result.keywords.slice(0, 5).map((k) => `"${k.keyword}" (vol ${k.volume})`).join("; ")}`);
  }

  lines.push("\nSALES");
  lines.push(`- Leads: ${sales.hubspot.leads.length} (delta ${pct(sales.deltas.leads)}), spam rate ${sales.hubspot.spam?.spamRatePct ?? "n/a"}% (delta ${sales.deltas.spamRate !== null ? `${sales.deltas.spamRate > 0 ? "+" : ""}${sales.deltas.spamRate.toFixed(1)}pp` : "n/a"})`);
  if (sales.hubspot.spam?.topSources.length) {
    lines.push(`- Top spam sources: ${sales.hubspot.spam.topSources.slice(0, 3).map((s) => `${s.domain} (${s.count})`).join("; ")}`);
  }
  const deals = sales.deals.aggregate;
  lines.push(`- Deals created: ${deals?.newCount ?? "n/a"}, new pipeline ${deals ? "$" + deals.pipelineValue.toLocaleString() : "n/a"} (delta ${pct(sales.deltas.pipelineValue)}), avg deal size ${deals?.avgAmount ? "$" + deals.avgAmount.toLocaleString() : "n/a"}`);
  lines.push(`- Closed-won: ${deals?.closedWon.count ?? "n/a"} deals, ${deals ? "$" + deals.closedWon.revenue.toLocaleString() : "n/a"} (delta ${pct(sales.deltas.closedWonRevenue)})`);
  if (deals?.perOwner.length) {
    lines.push(`- Leaderboard: ${deals.perOwner.map((o) => `${o.ownerName} $${o.wonRevenue.toLocaleString()}`).join("; ")}`);
  }
  lines.push(`- Tool usage: ${sales.usage.totalRuns} runs, $${sales.usage.totalCostUsd.toFixed(2)} LLM cost; top tools: ${sales.usage.perTool.slice(0, 3).map((t) => `${t.tool_slug} (${t.runs})`).join("; ") || "none yet"}`);

  return lines.join("\n");
}

function isImpact(v: unknown): v is AiPlan["impact"] {
  return v === "high" || v === "medium" || v === "low";
}

function isPlan(v: unknown): v is AiPlan {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.action === "string" && p.action.length > 0 &&
    typeof p.why === "string" && p.why.length > 0 &&
    isImpact(p.impact)
  );
}

function parsePlans(raw: string): AiPlans | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const website = Array.isArray(o.website) ? o.website.filter(isPlan) : [];
  const sales = Array.isArray(o.sales) ? o.sales.filter(isPlan) : [];
  if (website.length === 0 && sales.length === 0) return null;
  return { website, sales };
}

/**
 * AI-suggested actionable plans for the dashboard. ONE shared LLM call for
 * both zones, memoized for the WINDOW LENGTH — 7D view caches 7 days, 30D
 * caches 30 days, 90D caches 90 days (one generation per window; the output
 * cites that window's numbers, so refreshing hourly burns credits for
 * identical content).
 *
 * Runs inside /api/dashboard/plans, fetched client-side after hydration — a
 * slow call delays only this card (skeleton while pending), never the page.
 * The bound exists so a hung OpenRouter can't pin the endpoint forever.
 * Measured generation with the tightened prompt (≤12/≤20-word plans) +
 * reasoning disabled is 11–15s, but provider queueing added ~45s on a live
 * run (2026-09) — the bound covers generation + queue headroom. The original
 * unbounded prompt ran 60–81s+ of pure generation; keep the output limits.
 *
 * On failure the last good plans are served from a shadow entry
 * (`ai-plans-lastgood:<days>`, TTL = window + 7d so it always outlives the
 * live entry, refreshed on every success) — the card degrades to stale
 * content instead of disappearing. A parse-null counts as a failure (60s
 * error memo), never a success, so a bad LLM answer can't blank the card.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const PLANS_TIMEOUT_MS = 90_000;

export async function buildAiPlans(web: WebsiteData, sales: SalesData): Promise<AiPlans | null> {
  if (!process.env.OPENROUTER_API && !process.env.OPENROUTER_API_KEY) return null;
  const liveTtlMs = web.rangeDays * DAY_MS;
  const lastGoodKey = `ai-plans-lastgood:${web.rangeDays}`;
  try {
    const plans = await cached(`ai-plans:${web.rangeDays}`, async () => {
      const result = await complete({
        system: SYSTEM_PROMPT,
        user: buildDashboardSummary(web, sales),
        timeoutMs: PLANS_TIMEOUT_MS,
        reasoningEnabled: false,
      });
      const plans = parsePlans(result.text);
      if (!plans) throw new Error("AI plans: unusable LLM output");
      return plans;
    });
    writeCache(lastGoodKey, plans, liveTtlMs + 7 * DAY_MS);
    return plans;
  } catch (err) {
    const stale = await peekCache<AiPlans>(lastGoodKey);
    if (stale) return stale;
    console.error("buildAiPlans failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
