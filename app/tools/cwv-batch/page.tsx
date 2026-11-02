"use client";

import { useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView, { type SendToLink } from "@/components/tools/ResultView";
import { prefillUrl } from "@/components/tools/usePrefill";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface CwvRow {
  url: string;
  performanceScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  status: string;
}

interface CwvBatchResult {
  audited: number;
  rows: CwvRow[];
}

export default function CwvBatchPage() {
  const [urls, setUrls] = useState("");
  const { data, error, loading, run } = useToolApi<CwvBatchResult>("cwv-batch");

  function submit() {
    const list = urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (list.length) run({ urls: list });
  }

  const sendTo: SendToLink[] = data
    ? data.rows
        .filter((r) => r.status === "ok")
        .map((r) => ({
          label: `Inspect ${r.url.replace(/^https?:\/\//, "")}`,
          href: prefillUrl("/tools/url-inspector", { url: r.url, site: r.url }),
        }))
    : [];

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mt-6">
        <Textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={6}
          placeholder={"https://client-site.com/\nhttps://client-site.com/pricing\n…"}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button size="lg" onClick={submit} disabled={loading || !urls.trim()}>
            {loading ? "Auditing…" : "Audit batch"}
          </Button>
          <span className="text-xs text-slate-400">
            {urls.split("\n").filter((u) => u.trim()).length}/10 URLs
          </span>
        </div>
      </div>

      {error && <ErrorBanner className="mt-6">{error}</ErrorBanner>}
      {data && (
        <div className="mt-6">
          <ResultView data={data} sendTo={sendTo} />
        </div>
      )}
      </div>
    </>
  );
}
