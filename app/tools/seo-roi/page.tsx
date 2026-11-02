"use client";

import { useState } from "react";
import { usePrefill } from "@/components/tools/usePrefill";
import OutputHistory, { type OutputItem } from "@/components/tools/OutputHistory";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface SeoRoiResult {
  roi: {
    volumes: { keyword: string; volume: number }[];
    estimate: {
      monthlyTraffic: number;
      monthlyLeads: number;
      monthlyRevenue: number;
      annualRevenue: number;
    };
    assumptions: string[];
    narrative: string;
  };
}

export default function SeoRoiPage() {
  const prefill = usePrefill();
  const [domain, setDomain] = useState(prefill.domain || "");
  const [keywords, setKeywords] = useState(prefill.keyword || "");
  const [avgDealValue, setAvgDealValue] = useState(10000);
  const [conversionRate, setConversionRate] = useState(2);
  const [result, setResult] = useState<SeoRoiResult["roi"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);

  async function generate(extra: { refineOutputId?: number; refineInstruction?: string } = {}) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tools/seo-roi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, keywords, avgDealValue, conversionRate, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }
      setResult(data.roi);
      setCost(data.meta?.costUsd ?? null);
      setActiveId(data.outputId ?? null);
      setHistoryKey((k) => k + 1);
      setRefineText("");
    } finally {
      setLoading(false);
    }
  }

  async function refine() {
    if (!activeId || !refineText.trim()) return;
    setRefining(true);
    try {
      await generate({ refineOutputId: activeId, refineInstruction: refineText.trim() });
    } finally {
      setRefining(false);
    }
  }

  function loadOutput(item: OutputItem) {
    setResult((item.output as SeoRoiResult["roi"]));
    setCost(Number(item.costUsd));
    setActiveId(item.id);
    const b = item.brief as Record<string, unknown>;
    setDomain(String(b.domain ?? ""));
    if (Array.isArray(b.keywords)) setKeywords(b.keywords.join(", "));
    setAvgDealValue(Number(b.avgDealValue) || 10000);
    setConversionRate(Number(b.conversionRate) || 2);
  }

  const usd = (n: number) => `US$${Math.round(n).toLocaleString()}`;

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mt-6 grid gap-4 sm:grid-cols-2">
        <Textarea
          label="Keywords (comma / line separated)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          rows={3}
          placeholder={"seo agency hong kong\nlocal seo services"}
        />
        <div className="space-y-4">
          <Input
            label="Domain (optional — pulls top keywords)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="client-site.com.hk"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Avg deal value (USD)"
              type="number"
              min={1}
              value={avgDealValue}
              onChange={(e) => setAvgDealValue(Number(e.target.value))}
            />
            <Input
              label="Conversion rate %"
              type="number"
              min={0.1}
              max={20}
              step={0.5}
              value={conversionRate}
              onChange={(e) => setConversionRate(Number(e.target.value))}
            />
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <Button
          size="lg"
          onClick={() => generate()}
          disabled={loading || (!keywords.trim() && !domain)}
        >
          {loading ? "Estimating…" : "Estimate ROI"}
        </Button>
      </div>

      {error && <ErrorBanner className="mt-6">{error}</ErrorBanner>}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            {cost != null && <span className="text-xs text-slate-500">Cost: US${cost.toFixed(4)}</span>}
          </div>

          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card tone="slate" noPadding className="p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly traffic</div>
                <div className="mt-1 text-xl font-bold text-fp-700">
                  {Math.round(result.estimate.monthlyTraffic).toLocaleString()}
                </div>
              </Card>
              <Card tone="slate" noPadding className="p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly leads</div>
                <div className="mt-1 text-xl font-bold text-fp-700">
                  {Math.round(result.estimate.monthlyLeads).toLocaleString()}
                </div>
              </Card>
              <Card tone="slate" noPadding className="p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly revenue</div>
                <div className="mt-1 text-xl font-bold text-fp-700">{usd(result.estimate.monthlyRevenue)}</div>
              </Card>
              <Card tone="slate" noPadding className="p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Annual revenue</div>
                <div className="mt-1 text-xl font-bold text-fp-700">{usd(result.estimate.annualRevenue)}</div>
              </Card>
            </div>

            <p className="mt-4 text-sm text-slate-700">{result.narrative}</p>

            <div className="mt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assumptions</h3>
              <ul className="mt-2 space-y-1.5">
                {result.assumptions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="text-fp-600">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <div className="flex gap-2">
            <Input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder="Refine (e.g. use a 3% conversion rate for B2B)"
              className="flex-1"
            />
            <Button
              variant="brand"
              size="lg"
              onClick={refine}
              disabled={!activeId || !refineText.trim() || refining}
            >
              {refining ? "Refining…" : "Refine"}
            </Button>
          </div>

          <OutputHistory toolSlug="seo-roi" refreshKey={historyKey} activeId={activeId} onLoad={loadOutput} />
        </div>
      )}
      </div>
    </>
  );
}
