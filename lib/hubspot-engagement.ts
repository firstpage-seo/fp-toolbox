// Lead-quality cross-check: which contacts the spam filter may have misjudged.
// Ground truth = "take action": the contact is associated with a deal created in
// the window (sales actively opened a deal — a real lead by definition). If the
// static filter (lib/hubspot.ts classify) still flags them as spam, the filter
// is wrong for that pattern. This module surfaces those misclassified leads and
// the patterns behind them, so the filter rules can be tuned.
//
// NOTE: notes/emails were considered as engagement signals first, but this
// HubSpot env has zero human-written notes (97.5% of notes are the "Lead
// Assignment Report" workflow template, the rest are system HTML) and emails
// need a scope the key lacks. Deals are the only reliable manual signal.

import { classify, REASON_LABELS } from "./hubspot";

export interface MisclassifiedLead {
  name: string;
  email: string;
  website: string | null;
  reason: string;
}

export interface PatternRow {
  label: string;
  count: number;
}

export interface EngagementReport {
  days: number;
  totalContacts: number;
  engagedCount: number;
  engagedGood: number;
  engagedSpam: number;
  misclassified: MisclassifiedLead[];
  /** Why the filter flagged the misclassified real leads (most common first). */
  topReasons: PatternRow[];
  /** Email domains of misclassified real leads. */
  topDomains: PatternRow[];
  /** Email domains of spam without any engagement — the contrast set. */
  pureSpamTopDomains: PatternRow[];
}

interface RawContact {
  id: string;
  name: string;
  email: string;
  website: string | null;
}

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

function token(): string {
  const t = process.env.HUBSPOT_SERVICE_KEY;
  if (!t) throw new Error("HUBSPOT_SERVICE_KEY not configured");
  return t;
}

/** All contacts created in the window — including ones the spam filter rejects. */
async function fetchAllContacts(days: number): Promise<RawContact[]> {
  const then = Date.now() - days * 24 * 3600 * 1000;
  const all: RawContact[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      limit: PAGE_LIMIT,
      filterGroups: [
        { filters: [{ propertyName: "createdate", operator: "GTE", value: String(then) }] },
      ],
      properties: ["firstname", "lastname", "email", "website", "createdate"],
      sort: [{ propertyName: "createdate", direction: "DESCENDING" }],
    };
    if (after) body.after = after;
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HubSpot contacts error ${res.status}`);
    const data = await res.json();
    for (const r of data.results ?? []) {
      const p = (r.properties ?? {}) as Record<string, unknown>;
      const email = String(p.email ?? "").trim().toLowerCase();
      if (!email) continue;
      all.push({
        id: String(r.id),
        name: `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim(),
        email,
        website: p.website ? String(p.website).trim() : null,
      });
    }
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return all;
}

/** Ids of deals created in the window (the manual "take action" signal). */
async function fetchObjectIds(days: number): Promise<string[]> {
  const then = Date.now() - days * 24 * 3600 * 1000;
  const ids: string[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      limit: PAGE_LIMIT,
      filterGroups: [
        { filters: [{ propertyName: "createdate", operator: "GTE", value: String(then) }] },
      ],
      properties: ["createdate"],
      sort: [{ propertyName: "createdate", direction: "DESCENDING" }],
    };
    if (after) body.after = after;
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HubSpot deals error ${res.status}`);
    const data = await res.json();
    for (const r of data.results ?? []) ids.push(String(r.id));
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return ids;
}

/**
 * Batch-read associations (deals -> contacts) for the given ids, 100 per call.
 * Returns the set of target (contact) ids. HTTP 207 = partial success — errors
 * (e.g. object with no association) are skipped.
 */
async function fetchContactAssociations(ids: string[]): Promise<Set<string>> {
  const to: Set<string> = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const res = await fetch(
      "https://api.hubapi.com/crm/v3/associations/deals/contacts/batch/read",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: batch.map((id) => ({ id })) }),
        signal: AbortSignal.timeout(30_000),
      }
    );
    if (!res.ok && res.status !== 207) {
      throw new Error(`HubSpot deals associations error ${res.status}`);
    }
    const data = await res.json();
    for (const result of data.results ?? []) {
      for (const toItem of result.to ?? []) to.add(String(toItem.id));
    }
  }
  return to;
}

function countBy<T>(items: T[], key: (item: T) => string): PatternRow[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

const domainOf = (email: string): string => email.split("@")[1]?.toLowerCase() ?? "unknown";

/**
 * Engagement cross-check for the window: contacts associated with a deal
 * created in the window are real leads; those the static filter still calls
 * spam are misclassified. Fails soft (throws) — the dashboard degrades to null.
 */
export async function getEngagementReport(days: number): Promise<EngagementReport> {
  const [contacts, dealIds] = await Promise.all([
    fetchAllContacts(days),
    fetchObjectIds(days),
  ]);

  const dealContacts = dealIds.length
    ? await fetchContactAssociations(dealIds)
    : new Set<string>();
  const engaged = dealContacts;

  const misclassified: MisclassifiedLead[] = [];
  const engagedGood = new Set<string>();
  let engagedSpamCount = 0;
  const pureSpamDomains: string[] = [];

  for (const c of contacts) {
    const isEngaged = engaged.has(c.id);
    const { spam, reason } = classify(c.email, c.website);
    if (isEngaged) {
      if (spam) {
        engagedSpamCount++;
        misclassified.push({ name: c.name, email: c.email, website: c.website, reason });
      } else {
        engagedGood.add(c.id);
      }
    } else if (spam) {
      pureSpamDomains.push(domainOf(c.email));
    }
  }

  misclassified.sort((a, b) => a.reason.localeCompare(b.reason));

  return {
    days,
    totalContacts: contacts.length,
    engagedCount: [...engaged].filter((id) => contacts.some((c) => c.id === id)).length,
    engagedGood: engagedGood.size,
    engagedSpam: engagedSpamCount,
    misclassified: misclassified.slice(0, 12),
    topReasons: countBy(misclassified, (m) => REASON_LABELS[m.reason] ?? m.reason).slice(0, 5),
    topDomains: countBy(misclassified, (m) => domainOf(m.email)).slice(0, 5),
    pureSpamTopDomains: countBy(pureSpamDomains, (d) => d).slice(0, 5),
  };
}
