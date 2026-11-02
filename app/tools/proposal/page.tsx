"use client";

import { useState } from "react";
import BriefForm, { EMPTY_BRIEF, type BriefFormValues } from "@/components/tools/BriefForm";
import HubSpotLeads from "@/components/tools/HubSpotLeads";
import OutputHistory, { type OutputItem } from "@/components/tools/OutputHistory";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { downloadPdf } from "@/components/tools/downloadPdf";
import { proposalToHtml } from "@/components/tools/pdfRenderers";

interface ProposalSection {
  heading: string;
  paragraphs: string[];
  bullets: string[];
}

interface Proposal {
  title: string;
  sections: ProposalSection[];
}

export default function ProposalPage() {
  const [brief, setBrief] = useState<BriefFormValues>(EMPTY_BRIEF);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function generate(extra: { refineOutputId?: number; refineInstruction?: string } = {}) {
    setError(null);
    const res = await fetch("/api/tools/proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...brief, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Generation failed");
      return;
    }
    setProposal(data.proposal);
    setCost(data.meta?.costUsd ?? null);
    setActiveId(data.outputId ?? null);
    setHistoryKey((k) => k + 1);
    setRefineText("");
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
    setProposal(item.output as Proposal);
    setCost(Number(item.costUsd));
    setActiveId(item.id);
    setBrief((b) => ({ ...b, clientName: item.brief.clientName, website: item.brief.website ?? "" }));
  }

  function pickLead(l: { name: string; email: string; website: string | null }) {
    setBrief((b) => ({
      ...b,
      clientName: l.name || l.email.split("@")[0],
      website: l.website || "",
    }));
  }

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <BriefForm brief={brief} onChange={setBrief} submitLabel="Generate proposal" onGenerate={() => generate()} />

        <div className="space-y-4">
          <HubSpotLeads onPick={pickLead} />
          <OutputHistory toolSlug="proposal" refreshKey={historyKey} activeId={activeId} onLoad={loadOutput} />
        </div>
      </div>

      {/* Output: full width below the intake row */}
      <div className="mt-6">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {proposal && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await downloadPdf({ html: proposalToHtml(proposal), filename: "proposal.pdf", landscape: false });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                {exporting ? "Exporting…" : "Export PDF"}
              </Button>
              {cost != null && (
                <span className="text-xs text-slate-500">Generation cost: US${cost.toFixed(4)}</span>
              )}
            </div>

            <div className="mb-4 flex gap-2">
              <Input
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder="Refine instruction (e.g. expand the Investment section with a tiered option)"
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

            <div className="space-y-6">
              <Card noPadding className="p-10">
                <h1 className="text-3xl font-bold text-slate-900">{proposal.title}</h1>
                <p className="mt-2 text-sm text-fp-700">Prepared by First Page Digital</p>
              </Card>
              {proposal.sections.map((s, i) => (
                <Card key={i} noPadding className="p-10">
                  <h2 className="text-xl font-bold text-slate-900">{s.heading}</h2>
                  {s.paragraphs.map((p, j) => (
                    <p key={j} className="mt-3 text-slate-700">{p}</p>
                  ))}
                  {s.bullets.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {s.bullets.map((b, j) => (
                        <li key={j} className="flex gap-2 text-slate-700">
                          <span className="text-fp-600">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
