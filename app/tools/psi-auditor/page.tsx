"use client";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";

import { useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import { type SendToLink } from "@/components/tools/ResultView";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface PsiAuditResult {
  url: string;
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  grades: {
    performance: string;
    accessibility: string;
    bestPractices: string;
    seo: string;
  };
}

const CATS = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "bestPractices", label: "Best Practices" },
  { key: "seo", label: "SEO" },
] as const;

const GRADE_COLOR: Record<string, "emerald" | "amber" | "rose"> = {
  Good: "emerald",
  "Needs improvement": "amber",
};

export default function PsiAuditorPage() {
  const prefill = usePrefill();
  const [url, setUrl] = useState(prefill.url || "");
  const { data, error, loading, run } = useToolApi<PsiAuditResult>("psi-auditor");

  const sendTo: SendToLink[] = data
    ? [
        {
          label: "URL Inspector",
          href: prefillUrl("/tools/url-inspector", { url, site: url }),
        },
        {
          label: "Mobile vs Desktop",
          href: prefillUrl("/tools/mobile-desktop-psi", { url }),
        },
        {
          label: "Pitch Deck",
          href: prefillUrl("/tools/pitch-deck", { website: url }),
        },
      ]
    : [];

  const cwv: { label: string; value: string }[] = data
    ? [
        { label: "LCP (mobile)", value: data.lcpMs ? `${Math.round(data.lcpMs / 1000)}s` : "n/a" },
        { label: "TBT (mobile)", value: data.tbtMs != null ? `${Math.round(data.tbtMs / 1000)}s` : "n/a" },
        { label: "CLS (mobile)", value: data.cls != null ? data.cls.toFixed(3) : "n/a" },
      ]
    : [];

  return (
    <>
      <ToolPageHeader tool={tool} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mt-6 flex items-end gap-2">
          <div className="flex-1">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://client-site.com/page"
            />
          </div>
          <Button onClick={() => run({ url })} disabled={loading || !url}>
            {loading ? "Auditing…" : "Audit"}
          </Button>
        </div>

        {error && <ErrorBanner className="mt-6">{error}</ErrorBanner>}

        {data && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {sendTo.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="rounded-lg bg-fp-100 px-3 py-1.5 text-sm font-semibold text-fp-700 hover:bg-fp-200"
                >
                  {l.label} →
                </a>
              ))}
            </div>

            <Tabs defaultValue="performance">
              <TabsList className="w-full">
                {CATS.map((c) => (
                  <TabsTrigger key={c.key} value={c.key}>
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CATS.map((c) => {
                const score = data[c.key];
                const grade = data.grades[c.key];
                return (
                  <TabsContent
                    key={c.key}
                    value={c.key}
                    className="rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-end gap-3">
                      <span className="text-4xl font-extrabold text-navy">
                        {score === null ? "n/a" : score}
                      </span>
                      <span className="mb-1.5 text-sm text-slate-400">/ 100</span>
                      <Badge color={GRADE_COLOR[grade] ?? "rose"} className="mb-2 ml-auto">
                        {grade}
                      </Badge>
                    </div>
                    {c.key === "performance" && (
                      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                        {cwv.map((m) => (
                          <div key={m.label}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {m.label}
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {m.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        )}
      </div>
    </>
  );
}
