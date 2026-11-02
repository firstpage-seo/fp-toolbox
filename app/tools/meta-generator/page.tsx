"use client";

import { useState } from "react";
import { usePrefill } from "@/components/tools/usePrefill";
import ResultView from "@/components/tools/ResultView";
import OutputHistory, { type OutputItem } from "@/components/tools/OutputHistory";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface MetaItem {
  keyword: string;
  title: string;
  description: string;
}

export default function MetaGeneratorPage() {
  const prefill = usePrefill();
  const [keywords, setKeywords] = useState(prefill.keyword || "");
  const [locale, setLocale] = useState("en-HK");
  const [items, setItems] = useState<MetaItem[] | null>(null);
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
      const res = await fetch("/api/tools/meta-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, locale, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }
      setItems(data.items);
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
    setItems((item.output as { items: MetaItem[] }).items);
    setCost(Number(item.costUsd));
    setActiveId(item.id);
    const b = item.brief as Record<string, unknown>;
    if (Array.isArray(b.keywords)) setKeywords(b.keywords.join("\n"));
  }

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mt-6">
        <Textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          rows={5}
          placeholder={"seo agency hong kong\nlocal seo services\n…"}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Select value={locale} onChange={(e) => setLocale(e.target.value)}>
            {["en-HK", "en-US", "en-GB", "zh-HK", "zh-CN"].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          <Button size="lg" onClick={() => generate()} disabled={loading || !keywords.trim()}>
            {loading ? "Generating…" : "Generate metas"}
          </Button>
        </div>
      </Card>

      {error && (
        <ErrorBanner className="mt-6">{error}</ErrorBanner>
      )}

      {items && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            {cost != null && <span className="text-xs text-slate-500">Cost: US${cost.toFixed(4)}</span>}
            <div className="flex-1" />
            <div className="flex gap-2">
              <Input
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder="Refine (e.g. add a call to action)"
                className="flex-1 min-w-64"
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
          </div>
          <ResultView data={{ items }} />
          <OutputHistory toolSlug="meta-generator" refreshKey={historyKey} activeId={activeId} onLoad={loadOutput} />
        </div>
      )}
      </div>
    </>
  );
}
