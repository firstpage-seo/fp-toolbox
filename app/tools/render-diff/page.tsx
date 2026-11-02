"use client";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";

import { useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView, { type SendToLink } from "@/components/tools/ResultView";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";

interface RenderDiffResult {
  url: string;
  rendered: boolean;
  raw: { title: string | null; metaDescription: string | null; canonical: string | null; h1s: string[]; textLength: number };
  js: { title: string | null; metaDescription: string | null; canonical: string | null; h1s: string[]; textLength: number } | null;
  differences: { field: string; raw: string; rendered: string; changed: boolean }[];
}

export default function RenderDiffPage() {
  const prefill = usePrefill();
  const [url, setUrl] = useState(prefill.url || "");
  const { data, error, loading, run } = useToolApi<RenderDiffResult>("render-diff");

  const changedCount = data?.differences.filter((d) => d.changed).length ?? 0;

  const sendTo: SendToLink[] = data
    ? [
        {
          label: "URL Inspector",
          href: prefillUrl("/tools/url-inspector", { url, site: url }),
        },
      ]
    : [];

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mt-6 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://client-site.com/page"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-fp-400 focus:outline-none"
        />
        <button
          onClick={() => run({ url })}
          disabled={loading || !url}
          className="rounded-lg bg-fp-700 px-5 py-2 text-sm font-semibold text-white hover:bg-fp-800 disabled:opacity-40"
        >
          {loading ? "Comparing…" : "Compare"}
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {data && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {sendTo.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg bg-fp-100 px-3 py-1.5 text-sm font-semibold text-fp-700 hover:bg-fp-200"
              >
                {l.label} →
              </a>
            ))}
            <span className="text-xs text-slate-500">
              {data.rendered ? `${changedCount} field(s) changed after JS render` : "browserless not configured — raw HTML only"}
            </span>
          </div>
          <ResultView data={data} />
        </div>
      )}
      </div>
    </>
  );
}
