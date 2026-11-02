"use client";

import { useEffect, useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView, { type SendToLink } from "@/components/tools/ResultView";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface SerpResult {
  siteUrl: string;
  days: number;
  buckets: { position: string; queries: number; clicks: number; impressions: number }[];
  topQueries: { query: string; impressions: number; clicks: number; ctr: number; position: number }[];
}

export default function SerpLandscapePage() {
  const prefill = usePrefill();
  const [sites, setSites] = useState<{ siteUrl: string; displayName: string }[]>([]);
  const [site, setSite] = useState(prefill.site || "");
  const [days, setDays] = useState(30);
  const { data, error, loading, run } = useToolApi<SerpResult>("serp-landscape");

  useEffect(() => {
    fetch("/api/tools/serp-landscape")
      .then((r) => r.json())
      .then((j) => {
        const list: { siteUrl: string; displayName: string }[] = j.sites ?? [];
        setSites(list);
        if (!site && list.length) setSite(prefill.site || list[0].siteUrl);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendTo: SendToLink[] = data
    ? [
        {
          label: "Query Explorer",
          href: prefillUrl("/tools/gsc-explorer", { site: data.siteUrl }),
        },
      ]
    : [];

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <Input
            label="Site"
            list="serp-sites"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="Search or paste a site…"
          />
          <datalist id="serp-sites">
            {sites.map((s) => (
              <option key={s.siteUrl} value={s.siteUrl}>
                {s.displayName}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <Select
            label="Days"
            className="mt-1"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="mt-4">
        <Button size="lg" onClick={() => run({ siteUrl: site, days })} disabled={loading || !site}>
          {loading ? "Mapping…" : "Map SERPs"}
        </Button>
      </div>

      {error && (
        <ErrorBanner className="mt-6">{error}</ErrorBanner>
      )}
      {data && (
        <div className="mt-6">
          <ResultView data={data} sendTo={sendTo} />
        </div>
      )}
      </div>
    </>
  );
}
