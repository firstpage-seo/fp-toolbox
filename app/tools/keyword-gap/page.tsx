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

interface GapResult {
  domainA: string;
  domainB: string;
  country: string;
  aKeywordCount: number;
  bKeywordCount: number;
  gapCount: number;
  gap: { keyword: string; volume: number }[];
}

export default function KeywordGapPage() {
  const prefill = usePrefill();
  const [domainA, setDomainA] = useState(prefill.domainA || "");
  const [domainB, setDomainB] = useState(prefill.domainB || "");
  const [country, setCountry] = useState("hk");
  const [limit, setLimit] = useState(50);
  const { data, error, loading, run } = useToolApi<GapResult>("keyword-gap");

  const sendTo: SendToLink[] = data?.gap?.[0]
    ? [
        {
          label: "Content Brief",
          href: prefillUrl("/tools/content-brief", { keyword: data.gap[0].keyword }),
        },
        {
          label: "Meta Generator",
          href: prefillUrl("/tools/meta-generator", { keyword: data.gap[0].keyword }),
        },
        {
          label: "SEO ROI",
          href: prefillUrl("/tools/seo-roi", { keyword: data.gap[0].keyword, domain: data.domainA }),
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
            label="Domain A (client)"
            value={domainA}
            onChange={(e) => setDomainA(e.target.value)}
            placeholder="client.com.hk"
          />
        </div>
        <div>
          <Input
            label="Domain B (competitor)"
            value={domainB}
            onChange={(e) => setDomainB(e.target.value)}
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
            label="Per domain"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="mt-1"
          >
            {[25, 50, 100, 200].map((n) => (
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
          onClick={() => run({ domainA, domainB, country, limit })}
          disabled={loading || !domainA || !domainB}
        >
          {loading ? "Comparing…" : "Find gap"}
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
