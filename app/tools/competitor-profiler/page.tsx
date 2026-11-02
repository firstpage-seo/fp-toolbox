"use client";

import { useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView, { type SendToLink } from "@/components/tools/ResultView";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface CompetitorResult {
  target: string;
  keywords: { keyword: string; volume: number }[];
}

export default function CompetitorProfilerPage() {
  const prefill = usePrefill();
  const [domain, setDomain] = useState(prefill.domain || "");
  const [country, setCountry] = useState("hk");
  const [limit, setLimit] = useState(10);
  const { data, error, loading, run } = useToolApi<CompetitorResult>("competitor-profiler");

  const sendTo: SendToLink[] = data
    ? [
        {
          label: "Keyword Gap",
          href: prefillUrl("/tools/keyword-gap", { domainB: data.target }),
        },
        ...(data.keywords[0]
          ? [
              {
                label: "Content Brief",
                href: prefillUrl("/tools/content-brief", {
                  keyword: data.keywords[0].keyword,
                }),
              },
              {
                label: "SEO ROI",
                href: prefillUrl("/tools/seo-roi", {
                  keyword: data.keywords[0].keyword,
                  domain: data.target,
                }),
              },
            ]
          : []),
      ]
    : [];

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <Input
            label="Domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="competitor.com.hk"
          />
        </div>
        <div>
          <Select
            label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1"
          >
            {["hk", "us", "sg", "au", "uk", "tw", "cn"].map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Select
            label="Keywords"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="mt-1"
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="mt-4">
        <Button
          size="lg"
          onClick={() => run({ domain, country, limit })}
          disabled={loading || !domain}
        >
          {loading ? "Profiling…" : "Profile"}
        </Button>
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
