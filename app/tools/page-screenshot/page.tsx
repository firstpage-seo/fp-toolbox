"use client";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";

import { useState } from "react";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";

interface ShotResult {
  url: string;
  device: string;
  viewport: { width: number; height: number };
  dataUrl: string;
}

export default function PageScreenshotPage() {
  const prefill = usePrefill();
  const [url, setUrl] = useState(prefill.url || "");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [shot, setShot] = useState<ShotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function capture() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tools/page-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, device }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Capture failed");
        return;
      }
      setShot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const filename = `${(shot?.url || "page").replace(/^https?:\/\//, "").replace(/[^\w.-]/g, "_")}-${device}.png`;

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="min-w-64 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://client-site.com/"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-fp-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Device</label>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as "desktop" | "mobile")}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-fp-400 focus:outline-none"
          >
            <option value="desktop">Desktop (1280×800)</option>
            <option value="mobile">Mobile (390×844)</option>
          </select>
        </div>
        <button
          onClick={capture}
          disabled={loading || !url}
          className="rounded-lg bg-fp-700 px-5 py-2 text-sm font-semibold text-white hover:bg-fp-800 disabled:opacity-40"
        >
          {loading ? "Capturing…" : "Capture"}
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {shot && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={prefillUrl("/tools/pitch-deck", { website: shot.url })}
              className="rounded-lg bg-fp-100 px-3 py-1.5 text-sm font-semibold text-fp-700 hover:bg-fp-200"
            >
              Pitch Deck →
            </a>
            <a
              href={shot.dataUrl}
              download={filename}
              className="rounded-lg bg-fp-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fp-800"
            >
              Download PNG
            </a>
            <span className="text-xs text-slate-500">
              {shot.device} · {shot.viewport.width}×{shot.viewport.height}
            </span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- base64 dataUrl; next/image can't optimize it */}
          <img
            src={shot.dataUrl}
            alt={`Screenshot of ${shot.url}`}
            className="w-full rounded-xl border border-slate-200 shadow-sm"
          />
        </div>
      )}
      </div>
    </>
  );
}
