"use client";

import { useState } from "react";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";
import OutputHistory, { type OutputItem } from "@/components/tools/OutputHistory";
import { downloadPdf } from "@/components/tools/downloadPdf";
import { contentBriefToHtml } from "@/components/tools/pdfRenderers";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface ContentBriefOutput {
  keyword: string;
  title: string;
  searchIntent: string;
  targetAudience: string;
  wordCount: number;
  outline: { heading: string; points: string[] }[];
  faqIdeas: string[];
}

export default function ContentBriefPage() {
  const prefill = usePrefill();
  const [keyword, setKeyword] = useState(prefill.keyword || "");
  const [url, setUrl] = useState("");
  const [tone, setTone] = useState("professional");
  const [brief, setBrief] = useState<ContentBriefOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function generate(extra: { refineOutputId?: number; refineInstruction?: string } = {}) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tools/content-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, url, tone, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }
      setBrief(data.brief);
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
    setBrief(item.output as ContentBriefOutput);
    setCost(Number(item.costUsd));
    setActiveId(item.id);
    const b = item.brief as Record<string, unknown>;
    setKeyword(String(b.keyword ?? ""));
    setTone(String(b.tone ?? "professional"));
  }

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mt-6 grid gap-4">
        <Input
          label="Target keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="local seo services hong kong"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Existing page (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://client-site.com/page"
          />
          <Select
            label="Tone"
            className="mt-1"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
          >
            {["professional", "friendly", "authoritative", "conversational"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Button
            size="lg"
            onClick={() => generate()}
            disabled={loading || !keyword.trim()}
          >
            {loading ? "Generating…" : "Generate brief"}
          </Button>
        </div>
      </Card>

      {error && <ErrorBanner className="mt-6">{error}</ErrorBanner>}

      {brief && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={prefillUrl("/tools/meta-generator", { keyword: brief.keyword })}
              className="rounded-lg bg-fp-100 px-3 py-1.5 text-sm font-semibold text-fp-700 hover:bg-fp-200"
            >
              Meta Tags →
            </a>
            <a
              href={prefillUrl("/tools/schema-generator", { keyword: brief.keyword })}
              className="rounded-lg bg-fp-100 px-3 py-1.5 text-sm font-semibold text-fp-700 hover:bg-fp-200"
            >
              Schema →
            </a>
            <button
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadPdf({
                    html: contentBriefToHtml(brief),
                    filename: "content-brief.pdf",
                    landscape: false,
                  });
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setExporting(false);
                }
              }}
              disabled={exporting}
              className="rounded-lg bg-fp-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fp-800 disabled:opacity-40"
            >
              {exporting ? "Exporting…" : "Download PDF"}
            </button>
            {cost != null && <span className="text-xs text-slate-500">Cost: US${cost.toFixed(4)}</span>}
          </div>

          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card tone="slate" noPadding className="p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{brief.title}</div>
              </Card>
              <Card tone="slate" noPadding className="p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search intent</div>
                <div className="mt-1 text-sm text-slate-700">{brief.searchIntent}</div>
              </Card>
              <Card tone="slate" noPadding className="p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audience</div>
                <div className="mt-1 text-sm text-slate-700">{brief.targetAudience}</div>
              </Card>
              <Card tone="slate" noPadding className="p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Word count</div>
                <div className="mt-1 text-lg font-bold text-fp-700">{brief.wordCount}</div>
              </Card>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Outline</h3>
              <div className="mt-3 space-y-4">
                {brief.outline.map((s, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-4">
                    <div className="text-sm font-bold text-slate-900">
                      {i + 1}. {s.heading}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {s.points.map((p, j) => (
                        <li key={j} className="flex gap-2 text-sm text-slate-600">
                          <span className="text-fp-600">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">FAQ ideas</h3>
              <ul className="mt-2 space-y-1.5">
                {brief.faqIdeas.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-fp-600">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <div className="flex gap-2">
            <Input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder="Refine (e.g. target beginners, add comparison sections)"
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

          <OutputHistory toolSlug="content-brief" refreshKey={historyKey} activeId={activeId} onLoad={loadOutput} />
        </div>
      )}
      </div>
    </>
  );
}
