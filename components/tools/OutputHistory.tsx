"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";

export interface OutputItem {
  id: number;
  toolSlug: string;
  brief: { clientName: string; website?: string };
  costUsd: number;
  model: string;
  createdAt: string;
  output: unknown;
}

/** History rail — lists saved outputs, click to reload one. */
export default function OutputHistory({
  toolSlug,
  refreshKey,
  activeId,
  onLoad,
}: {
  toolSlug: string;
  refreshKey: number;
  activeId: number | null;
  onLoad: (item: OutputItem) => void;
}) {
  const [items, setItems] = useState<OutputItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Defer setLoading(true) to a microtask so it isn't a synchronous setState
    // inside the effect body (which triggers cascading renders + the lint rule).
    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    fetch(`/api/tools/${toolSlug}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setItems(data.outputs || []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toolSlug, refreshKey]);

  return (
    <Card noPadding className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-navy">Previous outputs</span>
        {loading && <span className="text-xs text-muted">loading…</span>}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-2 max-h-64 overflow-y-auto">
        {!loading && items && items.length === 0 && (
          <p className="py-3 text-xs text-muted">
            No saved outputs yet — generate once and it appears here.
          </p>
        )}
        {items?.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onLoad(item)}
            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-fp-100 ${
              activeId === item.id ? "bg-fp-50 ring-1 ring-fp-200" : ""
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-navy">
                {item.brief.clientName || "(untitled)"}
              </span>
              <span className="block text-xs text-muted">
                {new Date(item.createdAt).toLocaleString("en-HK", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted">${Number(item.costUsd).toFixed(4)}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
