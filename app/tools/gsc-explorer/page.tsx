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

interface GscExplorerResult {
  siteUrl: string;
  days: number;
  totals: { clicks: number; impressions: number };
  rows: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
}

export default function GscExplorerPage() {
  const prefill = usePrefill();
  const [sites, setSites] = useState<{ siteUrl: string; displayName: string }[]>([]);
  const [site, setSite] = useState(prefill.site || "");
  const [days, setDays] = useState(30);
  const [minClicks, setMinClicks] = useState(0);
  const [query, setQuery] = useState(prefill.query || "");
  const { data, error, loading, run } = useToolApi<GscExplorerResult>("gsc-explorer");

  useEffect(() => {
    fetch("/api/tools/gsc-explorer")
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
          label: "URL Inspector",
          href: prefillUrl("/tools/url-inspector", {
            url: data.siteUrl.replace(/\/?$/, "/"),
            site: data.siteUrl,
          }),
        },
        {
          label: "Onsite Audit",
          href: prefillUrl("/tools/onsite-audit", { url: data.siteUrl }),
        },
      ]
    : [];

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Input
            label="Site"
            list="gsc-sites"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="Search or paste a site…"
          />
          <datalist id="gsc-sites">
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
        <div>
          <Input
            label="Min clicks"
            type="number"
            min={0}
            value={minClicks}
            onChange={(e) => setMinClicks(Number(e.target.value))}
          />
        </div>
        <div>
          <Input
            label="Query contains"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. seo agency"
          />
        </div>
      </Card>

      <div className="mt-4">
        <Button size="lg" onClick={() => run({ siteUrl: site, days, minClicks, query })} disabled={loading || !site}>
          {loading ? "Running…" : "Explore"}
        </Button>
      </div>

      {error && (
        <ErrorBanner className="mt-6">{error}</ErrorBanner>
      )}
      {data && (
        <div className="mt-6 space-y-4">
          <ResultView data={data} sendTo={sendTo} />
        </div>
      )}
      </div>
    </>
  );
}
