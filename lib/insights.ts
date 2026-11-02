import type { WebsiteData, SalesData } from "./dashboard";

export interface Insight {
  tone: "good" | "bad" | "neutral";
  text: string;
}

const fmtPct = (n: number): string => `${n > 0 ? "+" : ""}${n.toFixed(0)}%`;

function deltaInsight(
  label: string,
  delta: number | null,
  goodWhenUp = true
): Insight | null {
  if (delta === null) return null;
  if (Math.abs(delta) < 5) return null; // noise — skip
  const up = delta > 0;
  const good = up === goodWhenUp;
  return {
    tone: good ? "good" : "bad",
    text: `${label} ${up ? "up" : "down"} ${fmtPct(Math.abs(delta))}`,
  };
}

/**
 * Rule-driven headline takeaways for the Website zone — no LLM.
 * Emits only signals above a noise threshold; stays 0–4 items.
 */
export function buildWebsiteInsights(d: WebsiteData): Insight[] {
  const website: Insight[] = [];
  const traffic = deltaInsight("Website traffic", d.deltas.ga4Users);
  if (traffic) website.push(traffic);
  const clicks = deltaInsight("Organic clicks", d.deltas.gscClicks);
  if (clicks) website.push(clicks);
  const impressions = deltaInsight("Search impressions", d.deltas.gscImpressions);
  if (impressions) website.push(impressions);
  if (d.psi.result?.performanceScore !== null && d.psi.result?.performanceScore !== undefined) {
    const score = d.psi.result.performanceScore;
    if (score >= 90) {
      website.push({ tone: "good", text: `PageSpeed ${score}/100 — excellent` });
    } else if (score >= 50) {
      website.push({ tone: "neutral", text: `PageSpeed ${score}/100 — room to improve` });
    } else {
      website.push({ tone: "bad", text: `PageSpeed ${score}/100 — needs priority optimisation` });
    }
  }
  return website;
}

/**
 * Rule-driven headline takeaways for the Sales zone — no LLM.
 * Emits only signals above a noise threshold; stays 0–4 items.
 */
export function buildSalesInsights(d: SalesData): Insight[] {
  const sales: Insight[] = [];
  const leads = deltaInsight("New leads", d.deltas.leads);
  if (leads) sales.push(leads);
  if (d.deltas.spamRate !== null && Math.abs(d.deltas.spamRate) >= 2) {
    const up = d.deltas.spamRate > 0;
    sales.push({
      tone: up ? "bad" : "good",
      text: `Spam rate ${up ? "up" : "down"} ${Math.abs(d.deltas.spamRate).toFixed(1)}pp`,
    });
  }
  const revenue = deltaInsight("Closed-won revenue", d.deltas.closedWonRevenue);
  if (revenue) sales.push(revenue);
  const pipeline = deltaInsight("New pipeline", d.deltas.pipelineValue);
  if (pipeline) sales.push(pipeline);

  const top = d.deals.aggregate?.perOwner[0];
  if (top && top.wonRevenue > 0) {
    sales.push({
      tone: "good",
      text: `Top rep: ${top.ownerName} — $${top.wonRevenue.toLocaleString()} closed-won`,
    });
  }

  return sales;
}
