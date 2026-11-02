"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";

export interface HubSpotLead {
  id: string;
  name: string;
  email: string;
  website: string | null;
  createdAt: string;
  score?: { score: number; label: "hot" | "warm" | "cold"; reasons: string[] };
}

const SCORE_STYLE = {
  hot: "bg-green-100 text-green-700",
  warm: "bg-amber-100 text-amber-700",
  cold: "bg-surface text-navy",
} as const;

function ScoreBadge({ score }: { score?: HubSpotLead["score"] }) {
  if (!score) return null;
  return (
    <span
      title={score.reasons.join(" · ")}
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${SCORE_STYLE[score.label]}`}
    >
      {score.score}
    </span>
  );
}

/** Right-rail HubSpot lead picker — sits beside the brief form, not inside it. */
export default function HubSpotLeads({
  onPick,
}: {
  onPick: (lead: HubSpotLead) => void;
}) {
  const [leads, setLeads] = useState<HubSpotLead[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLeads() {
    if (leads !== null) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hubspot/recent-leads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load leads");
      setLeads(data.leads || []);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card noPadding className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-navy">Recent leads</span>
        <button
          type="button"
          onClick={loadLeads}
          disabled={loading}
          className="rounded-lg border border-fp-300 bg-fp-50 px-3 py-1.5 text-xs font-semibold text-fp-700 hover:bg-fp-100 disabled:opacity-50"
        >
          {loading ? "Loading…" : open ? "Hide" : "📇 Import from HubSpot"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Last 7 days, spam filtered. Pick a lead to fill the brief.
      </p>

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {open && leads && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface p-2">
          {leads.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">No recent leads (last 7 days, spam filtered).</p>
          ) : (
            leads.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onPick(l)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-fp-100"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="block truncate text-sm font-medium text-navy">
                      {l.name || "(no name)"}
                    </span>
                    <ScoreBadge score={l.score} />
                  </span>
                  <span className="block truncate text-xs text-muted">{l.email}</span>
                </span>
                <span className="shrink-0 max-w-[9rem] truncate font-mono text-xs text-muted">
                  {l.website ? l.website.replace(/^https?:\/\//, "") : "—"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
