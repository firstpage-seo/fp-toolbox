"use client";

import { useState, type ReactNode } from "react";

type Source = "ga4" | "gsc" | "ahrefs" | "pagespeed";

const SOURCES: { id: Source; label: string }[] = [
  { id: "gsc", label: "GSC" },
  { id: "ga4", label: "GA4" },
  { id: "ahrefs", label: "Ahrefs" },
  { id: "pagespeed", label: "PageSpeed Insights" },
];

export default function SourceFilter({ panels }: { panels: Record<Source, ReactNode> }) {
  const [source, setSource] = useState<Source>("gsc");

  return (
    <>
      <nav aria-label="Traffic data source" className="mt-7 border-b border-border">
        <div className="flex gap-2 overflow-x-auto pb-3">
          {SOURCES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={source === id}
              onClick={() => setSource(id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fp-500 ${source === id ? "bg-navy text-white shadow-sm" : "bg-surface text-muted hover:bg-border"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <div key={source} role="region" aria-label={`${SOURCES.find((item) => item.id === source)?.label} report`}>
        {panels[source]}
      </div>
    </>
  );
}
