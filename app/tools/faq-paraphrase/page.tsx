"use client";

import { useState } from "react";
import OutputHistory, { type OutputItem } from "@/components/tools/OutputHistory";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface FaqItem {
  question: string;
  answer: string;
  paraphrase: string;
}

/** Parse pasted FAQ text → {question, answer}[].
 *  Accepts tab-separated "question\tanswer" lines, "Q:"/"A:"-prefixed pairs,
 *  or blocks where the first line is the question and the rest is the answer.
 */
function parseFaqs(text: string): FaqItem[] {
  const items: FaqItem[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    if (lines.some((l) => l.includes("\t"))) {
      for (const line of lines) {
        const [q, a] = line.split("\t").map((s) => s.trim());
        if (q && a) items.push({ question: q, answer: a, paraphrase: "" });
      }
      continue;
    }
    let question = "";
    const answers: string[] = [];
    for (const line of lines) {
      const qm = /^[QQ]:/.exec(line);
      const am = /^[Aa]:/.exec(line);
      if (qm) question = line.replace(/^[Qq]:\s*/, "").trim();
      else if (am) answers.push(line.replace(/^[Aa]:\s*/, "").trim());
      else if (!question) question = line;
      else answers.push(line);
    }
    if (question && answers.length) items.push({ question, answer: answers.join(" "), paraphrase: "" });
  }
  return items;
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(items: FaqItem[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["question", "answer", "paraphrase"].map(esc).join(",")];
  for (const it of items) rows.push([it.question, it.answer, it.paraphrase].map(esc).join(","));
  return rows.join("\n");
}

export default function FaqParaphrasePage() {
  const [text, setText] = useState("");
  const [tone, setTone] = useState("brand-safe, professional, friendly");
  const [items, setItems] = useState<FaqItem[] | null>(null);
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
      const faqs = parseFaqs(text);
      if (!faqs.length) {
        setError("Paste at least one question and answer first.");
        return;
      }
      const res = await fetch("/api/tools/faq-paraphrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faqs, tone, ...extra }),
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
    setItems(item.output as FaqItem[]);
    setCost(Number(item.costUsd));
    setActiveId(item.id);
    const b = item.brief as Record<string, unknown>;
    setTone(String(b.tone ?? "brand-safe, professional, friendly"));
  }

  const changedCount = items?.filter((i) => i.answer !== i.paraphrase).length ?? 0;

  return (
    <>
      <ToolPageHeader tool={tool} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mt-6 grid gap-4">
          <Textarea
            label="FAQs to paraphrase (paste Q&A text)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={
              "One FAQ per block — first line the question, rest the answer.\n\nHow much does SEO cost?\nPricing depends on scope; most clients start at US$800/mo.\n\nDo I need a contract?\nNo, you can cancel anytime with 30 days notice."
            }
          />
          <Input
            label="Brand tone / style guidance"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="brand-safe, professional, friendly"
          />
          <div className="flex items-center gap-3">
            <Button size="lg" onClick={() => generate()} disabled={loading || !text.trim()}>
              {loading ? "Paraphrasing…" : "Paraphrase FAQs"}
            </Button>
            {text.trim() && (
              <span className="text-xs text-muted">{parseFaqs(text).length} FAQ(s) detected</span>
            )}
          </div>
        </Card>

        {error && <ErrorBanner className="mt-6">{error}</ErrorBanner>}

        {items && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge color="fp">{items.length} items</Badge>
              <Badge color={changedCount ? "emerald" : "slate"}>{changedCount} revised</Badge>
              {cost != null && (
                <span className="text-xs text-slate-500">Cost: US${cost.toFixed(4)}</span>
              )}
            </div>

            <div className="space-y-4">
              {items.map((it, i) => {
                const changed = it.answer !== it.paraphrase;
                return (
                  <Card key={i} noPadding className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-bold text-navy">
                        {i + 1}. {it.question}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {changed && <Badge color="emerald">revised</Badge>}
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(it.paraphrase);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1200);
                          }}
                          className="rounded-lg bg-fp-100 px-2.5 py-1 text-xs font-semibold text-fp-700 hover:bg-fp-200"
                        >
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Original
                        </div>
                        <div className="mt-1 text-sm text-slate-700">{it.answer}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-fp-700">
                          Paraphrased
                        </div>
                        <div className="mt-1 text-sm text-slate-900">{it.paraphrase}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => download("faq-paraphrase.csv", toCsv(items), "text/csv;charset=utf-8")}>
                Download CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => download("faq-paraphrase.json", JSON.stringify(items, null, 2), "application/json")}>
                Download JSON
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(JSON.stringify(items, null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
              >
                Copy all (JSON)
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder="Refine (e.g. use simpler words for a consumer audience, shorten answers)"
                className="flex-1"
              />
              <Button variant="brand" size="lg" onClick={refine} disabled={!activeId || !refineText.trim() || refining}>
                {refining ? "Refining…" : "Refine"}
              </Button>
            </div>

            <OutputHistory toolSlug="faq-paraphrase" refreshKey={historyKey} activeId={activeId} onLoad={loadOutput} />
          </div>
        )}
      </div>
    </>
  );
}