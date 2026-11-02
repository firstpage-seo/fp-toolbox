"use client";

import { useEffect, useState } from "react";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";
import OutputHistory, { type OutputItem } from "@/components/tools/OutputHistory";
import { downloadPdf } from "@/components/tools/downloadPdf";
import { reportToHtml } from "@/components/tools/pdfRenderers";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface MonthlyReport {
  title: string;
  summary: string;
  sections: { heading: string; paragraphs: string[]; bullets: string[] }[];
}

export default function MonthlyReportPage() {
  const prefill = usePrefill();
  const [siteSuggestions, setSiteSuggestions] = useState<string[]>([]);
  const [url, setUrl] = useState(prefill.url || "");
  const [clientName, setClientName] = useState(prefill.client || "");
  const [period, setPeriod] = useState("");
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/tools/monthly-report")
      .then((r) => r.json())
      .then((j) => setSiteSuggestions(Array.isArray(j.sites) ? j.sites : []))
      .catch(() => undefined);
  }, []);

  async function generate(extra: { refineOutputId?: number; refineInstruction?: string } = {}) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tools/monthly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, clientName, period, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }
      setReport(data.report);
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
    setReport(item.output as MonthlyReport);
    setCost(Number(item.costUsd));
    setActiveId(item.id);
    const b = item.brief as Record<string, unknown>;
    setUrl(String(b.url ?? ""));
    setClientName(String(b.clientName ?? ""));
  }

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mt-6 grid gap-4">
        <div>
          <Input
            label="Client website"
            list="monthly-sites"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://client-site.com/"
          />
          <datalist id="monthly-sites">
            {siteSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="Client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Acme Ltd"
            />
          </div>
          <div>
            <Input
              label="Reporting period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="e.g. July 2026"
            />
          </div>
        </div>
        <div>
          <Button size="lg" onClick={() => generate()} disabled={loading || !url}>
            {loading ? "Generating…" : "Generate report"}
          </Button>
        </div>
      </Card>

      {error && (
        <ErrorBanner className="mt-6">{error}</ErrorBanner>
      )}

      {report && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={prefillUrl("/tools/proposal", { clientName, website: url })}
              className="rounded-lg bg-fp-100 px-3 py-1.5 text-sm font-semibold text-fp-700 hover:bg-fp-200"
            >
              Proposal →
            </a>
            <button
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadPdf({
                    html: reportToHtml(report),
                    filename: "monthly-seo-report.pdf",
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
            <h2 className="text-xl font-bold text-slate-900">{report.title}</h2>
            <p className="mt-2 text-sm text-slate-700">{report.summary}</p>

            <div className="mt-6 space-y-6">
              {report.sections.map((s, i) => (
                <section key={i}>
                  <h3 className="text-base font-bold text-slate-900">{s.heading}</h3>
                  {s.paragraphs.map((p, j) => (
                    <p key={j} className="mt-2 text-sm text-slate-700">
                      {p}
                    </p>
                  ))}
                  {s.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {s.bullets.map((b, k) => (
                        <li key={k} className="flex gap-2 text-sm text-slate-700">
                          <span className="text-fp-600">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </Card>

          <div className="flex gap-2">
            <Input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder="Refine (e.g. highlight the biggest win, soften the traffic drop)"
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

          <OutputHistory toolSlug="monthly-report" refreshKey={historyKey} activeId={activeId} onLoad={loadOutput} />
        </div>
      )}
      </div>
    </>
  );
}
