// HubSpot deals/pipeline client (HUBSPOT_SERVICE_KEY) — the revenue half of the
// sales dashboard. Pulls deals created in the window (new pipeline) and deals
// closed in the window (won/lost), then aggregates per sales owner for the
// leaderboard. Server-side only; failures throw and the dashboard degrades.

export interface DealSummary {
  id: string;
  name: string;
  amount: number | null;
  createdAt: string;
  closedAt: string | null;
  stage: string | null;
  pipeline: string | null;
  ownerId: string | null;
  /** true = won, false = lost, null = still open */
  outcome: "won" | "lost" | null;
}

export interface DealsReport {
  /** Deals created inside the window. */
  newDeals: DealSummary[];
  /** Deals closed (won or lost) inside the window. */
  closed: DealSummary[];
  /** ownerId -> display name; empty when the owners endpoint is unavailable. */
  owners: Record<string, string>;
}

export interface OwnerRow {
  ownerId: string;
  ownerName: string;
  wonCount: number;
  wonRevenue: number;
  /** Amount of open deals created in the window for this owner. */
  openPipeline: number;
}

export interface DealsAggregate {
  /** Deals created in the window. */
  newCount: number;
  /** Sum of amounts of new deals that are still open. */
  pipelineValue: number;
  /** Mean amount across new deals that carry an amount. */
  avgAmount: number;
  /** Outcome of deals created in the window. */
  funnel: { open: number; won: number; lost: number };
  /** Deals closed-won in the window (by close date). */
  closedWon: { count: number; revenue: number };
  /** Deals closed-lost in the window. */
  closedLostCount: number;
  /** Per-owner rows sorted by wonRevenue desc; unassigned deals -> "Unassigned". */
  perOwner: OwnerRow[];
}

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;
const DEAL_PROPERTIES = [
  "dealname",
  "amount",
  "createdate",
  "closedate",
  "dealstage",
  "pipeline",
  "hubspot_owner_id",
  "hs_is_closed_won",
  "hs_is_closed",
];

function token(): string {
  const t = process.env.HUBSPOT_SERVICE_KEY;
  if (!t) throw new Error("HUBSPOT_SERVICE_KEY not configured");
  return t;
}

function asNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toSummary(r: Record<string, unknown>): DealSummary {
  const p = (r.properties ?? {}) as Record<string, unknown>;
  // hs_is_closed_won is "false" for BOTH open and lost deals — the closed flag
  // (hs_is_closed) is what separates open from lost.
  const won = p.hs_is_closed_won === "true";
  const closed = p.hs_is_closed === "true";
  const outcome = won ? "won" : closed ? "lost" : null;
  return {
    id: String(r.id ?? ""),
    name: String(p.dealname ?? ""),
    amount: asNumber(p.amount),
    createdAt: String(p.createdate ?? ""),
    closedAt: p.closedate ? String(p.closedate) : null,
    stage: p.dealstage ? String(p.dealstage) : null,
    pipeline: p.pipeline ? String(p.pipeline) : null,
    ownerId: p.hubspot_owner_id ? String(p.hubspot_owner_id) : null,
    outcome,
  };
}

/** Paginated HubSpot search filtered on a single date property >= window start. */
async function searchDealsByDate(
  dateProperty: "createdate" | "closedate",
  days: number
): Promise<DealSummary[]> {
  const then = Date.now() - days * 24 * 3600 * 1000;
  const all: DealSummary[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      limit: PAGE_LIMIT,
      filterGroups: [
        { filters: [{ propertyName: dateProperty, operator: "GTE", value: String(then) }] },
      ],
      properties: DEAL_PROPERTIES,
      sort: [{ propertyName: dateProperty, direction: "DESCENDING" }],
    };
    if (after) body.after = after;
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`HubSpot deals error ${res.status}`);
    }
    const data = await res.json();
    for (const r of data.results ?? []) all.push(toSummary(r));
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return all;
}

/** ownerId -> display name; fails soft (empty map) so the leaderboard still renders. */
async function getOwners(): Promise<Record<string, string>> {
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
      headers: { Authorization: `Bearer ${token()}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, string> = {};
    for (const o of data.results ?? []) {
      const name = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim();
      map[String(o.id)] = name || String(o.email ?? o.id);
    }
    return map;
  } catch {
    return {};
  }
}

/** Raw deals for the window: created (new pipeline) + closed (won/lost). */
export async function getDealsReport(days: number): Promise<DealsReport> {
  const [newDeals, closed, owners] = await Promise.all([
    searchDealsByDate("createdate", days),
    searchDealsByDate("closedate", days),
    getOwners(),
  ]);
  return { newDeals, closed, owners };
}

/** Pure aggregation over a DealsReport — used by the dashboard + insights. */
export function aggregateDeals(report: DealsReport): DealsAggregate {
  const UNASSIGNED = "Unassigned";

  let pipelineValue = 0;
  let avgSum = 0;
  let avgCount = 0;
  const funnel = { open: 0, won: 0, lost: 0 };

  const newOpenByOwner = new Map<string, number>();
  for (const d of report.newDeals) {
    if (d.amount !== null) {
      avgSum += d.amount;
      avgCount++;
    }
    if (d.outcome === null) {
      funnel.open++;
      pipelineValue += d.amount ?? 0;
      const owner = d.ownerId ?? UNASSIGNED;
      newOpenByOwner.set(owner, (newOpenByOwner.get(owner) ?? 0) + (d.amount ?? 0));
    } else if (d.outcome === "won") {
      funnel.won++;
    } else {
      funnel.lost++;
    }
  }

  let wonCount = 0;
  let wonRevenue = 0;
  let lostCount = 0;
  const wonByOwner = new Map<string, { count: number; revenue: number }>();
  for (const d of report.closed) {
    if (d.outcome === "won") {
      wonCount++;
      wonRevenue += d.amount ?? 0;
      const owner = d.ownerId ?? UNASSIGNED;
      const row = wonByOwner.get(owner) ?? { count: 0, revenue: 0 };
      row.count++;
      row.revenue += d.amount ?? 0;
      wonByOwner.set(owner, row);
    } else if (d.outcome === "lost") {
      lostCount++;
    }
  }

  const perOwner: OwnerRow[] = [...wonByOwner.keys()].map((ownerId) => ({
    ownerId,
    ownerName: report.owners[ownerId] ?? ownerId,
    wonCount: wonByOwner.get(ownerId)!.count,
    wonRevenue: wonByOwner.get(ownerId)!.revenue,
    openPipeline: newOpenByOwner.get(ownerId) ?? 0,
  }));
  perOwner.sort((a, b) => b.wonRevenue - a.wonRevenue || b.wonCount - a.wonCount);

  return {
    newCount: report.newDeals.length,
    pipelineValue,
    avgAmount: avgCount ? Math.round(avgSum / avgCount) : 0,
    funnel,
    closedWon: { count: wonCount, revenue: wonRevenue },
    closedLostCount: lostCount,
    perOwner,
  };
}
