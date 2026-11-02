"use client";

import { useEffect, useState } from "react";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";
import OutputHistory, { type OutputItem } from "@/components/tools/OutputHistory";
import { downloadPdf } from "@/components/tools/downloadPdf";
import { meetingBriefToHtml } from "@/components/tools/pdfRenderers";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface MeetingBrief {
  title: string;
  overview: string;
  keyFindings: { stat: string; insight: string }[];
  talkingPoints: string[];
  questions: string[];
  recommendations: string[];
}

export default function MeetingPrepPage() {
  const prefill = usePrefill();
  const [siteSuggestions, setSiteSuggestions] = useState<string[]>([]);
  const [url, setUrl] = useState(prefill.url || "");
  const [clientName, setClientName] = useState(prefill.client || "");
  const [focus, setFocus] = useState("");
  const [brief, setBrief] = useState<MeetingBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/tools/meeting-prep")
      .then((r) => r.json())
      .then((j) => setSiteSuggestions(Array.isArray(j.sites) ? j.sites : []))
      .catch(() => undefined);
  }, []);

  async function generate(extra: { refineOutputId?: number; refineInstruction?: string } = {}) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tools/meeting-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, clientName, focus, ...extra }),
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
    setBrief(item.output as MeetingBrief);
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
            list="meeting-sites"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://client-site.com/"
          />
          <datalist id="meeting-sites">
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
              label="Meeting focus (optional)"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. renew contract, review Q3 performance"
            />
          </div>
        </div>
        <div>
          <Button size="lg" onClick={() => generate()} disabled={loading || !url}>
            {loading ? "Preparing…" : "Generate brief"}
          </Button>
        </div>
      </Card>

      {error && (
        <ErrorBanner className="mt-6">{error}</ErrorBanner>
      )}

      {brief && (
        <div className="mt-6 space-y-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <a
              href={prefillUrl("/tools/proposal", { clientName, website: url })}
              className="rounded-lg bg-fp-100 px-3 py-1.5 text-sm font-semibold text-fp-700 hover:bg-fp-200"
            >
              Proposal →
            </a>
            <a
              href={prefillUrl("/tools/pitch-deck", { clientName, website: url })}
              className="rounded-lg bg-fp-100 px-3 py-1.5 text-sm font-semibold text-fp-700 hover:bg-fp-200"
            >
              Pitch Deck →
            </a>
            <a
              href={prefillUrl("/tools/onsite-audit", { url })}
              className="rounded-lg bg-fp-100 px-3 py-1.5 text-sm font-semibold text-fp-700 hover:bg-fp-200"
            >
              Onsite Audit →
            </a>
            <button
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadPdf({
                    html: meetingBriefToHtml(brief),
                    filename: "meeting-prep-brief.pdf",
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
            {cost != null && (
              <span className="text-xs text-slate-500">Generation cost: US${cost.toFixed(4)}</span>
            )}
          </div>

          <Card>
            <h2 className="text-xl font-bold text-slate-900">{brief.title}</h2>
            <p className="mt-2 text-sm text-slate-700">{brief.overview}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {brief.keyFindings.map((f, i) => (
                <Card key={i} tone="slate" noPadding className="p-3">
                  <div className="text-sm font-bold text-fp-700">{f.stat}</div>
                  <div className="mt-1 text-xs text-slate-600">{f.insight}</div>
                </Card>
              ))}
            </div>

            {[
              { title: "Talking points", items: brief.talkingPoints },
              { title: "Questions to ask", items: brief.questions },
              { title: "Recommendations", items: brief.recommendations },
            ].map((section) => (
              <div key={section.title} className="mt-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {section.title}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="text-fp-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>

          <div className="flex gap-2">
            <Input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder="Refine instruction (e.g. make it more aggressive on pricing)"
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

          <OutputHistory toolSlug="meeting-prep" refreshKey={historyKey} activeId={activeId} onLoad={loadOutput} />
        </div>
      )}
      </div>
    </>
  );
}
