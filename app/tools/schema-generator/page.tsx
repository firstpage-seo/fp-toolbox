"use client";

import { useState } from "react";
import { usePrefill } from "@/components/tools/usePrefill";
import OutputHistory, { type OutputItem } from "@/components/tools/OutputHistory";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import ErrorBanner from "@/components/ui/ErrorBanner";

const SCHEMA_TYPES = ["FAQPage", "Article", "LocalBusiness", "Product", "BreadcrumbList"];

interface SchemaResult {
  type: string;
  schema: Record<string, unknown>;
  script: string;
}

export default function SchemaGeneratorPage() {
  const prefill = usePrefill();
  const [url, setUrl] = useState(prefill.url || "");
  const [keyword, setKeyword] = useState(prefill.keyword || "");
  const [type, setType] = useState("FAQPage");
  const [result, setResult] = useState<SchemaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate(extra: { refineOutputId?: number; refineInstruction?: string } = {}) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tools/schema-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, keyword, type, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }
      setResult(data);
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
    const out = item.output as { type: string; schema: Record<string, unknown> };
    setResult({ type: out.type, schema: out.schema, script: `<script type="application/ld+json">\n${JSON.stringify(out.schema, null, 2)}\n</script>` });
    setCost(Number(item.costUsd));
    setActiveId(item.id);
    const b = item.brief as Record<string, unknown>;
    setUrl(String(b.url ?? ""));
    setKeyword(String(b.keyword ?? ""));
    setType(String(b.type ?? "FAQPage"));
  }

  function copyScript() {
    if (!result) return;
    void navigator.clipboard.writeText(result.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mt-6 grid gap-4 sm:grid-cols-3">
        <Input
          label="Page URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://client-site.com/faq"
        />
        <Input
          label="Topic (if no URL)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="local seo services"
        />
        <Select
          label="Schema type"
          className="mt-1"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {SCHEMA_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Card>

      <div className="mt-4">
        <Button
          size="lg"
          onClick={() => generate()}
          disabled={loading || (!url && !keyword)}
        >
          {loading ? "Generating…" : "Generate schema"}
        </Button>
      </div>

      {error && <ErrorBanner className="mt-6">{error}</ErrorBanner>}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            {cost != null && <span className="text-xs text-slate-500">Cost: US${cost.toFixed(4)}</span>}
            <Button variant="secondary" size="md" onClick={copyScript}>
              {copied ? "Copied ✓" : "Copy script tag"}
            </Button>
          </div>

          <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            {result.script}
          </pre>

          <div className="flex gap-2">
            <Input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder="Refine (e.g. add openingHours to LocalBusiness)"
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

          <OutputHistory toolSlug="schema-generator" refreshKey={historyKey} activeId={activeId} onLoad={loadOutput} />
        </div>
      )}
      </div>
    </>
  );
}
