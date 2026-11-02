"use client";

import { useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView, { type SendToLink } from "@/components/tools/ResultView";
import { prefillUrl } from "@/components/tools/usePrefill";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface ScoredLead {
  id: string;
  name: string;
  email: string;
  website: string | null;
  createdAt: string;
  score: number;
  label: "hot" | "warm" | "cold";
  reasons: string[];
}

interface LeadScorerResult {
  days: number;
  total: number;
  counts: { hot: number; warm: number; cold: number };
  leads: ScoredLead[];
}

export default function LeadScorerPage() {
  const [days, setDays] = useState(7);
  const { data, error, loading, run } = useToolApi<LeadScorerResult>("lead-scorer");

  const sendTo: SendToLink[] = data?.leads?.[0]
    ? [
        {
          label: "Meeting Prep",
          href: prefillUrl("/tools/meeting-prep", {
            url: data.leads[0].website ?? "",
            client: data.leads[0].name || data.leads[0].email.split("@")[0],
          }),
        },
        {
          label: "Onsite Audit",
          href: prefillUrl("/tools/onsite-audit", { url: data.leads[0].website ?? "" }),
        },
      ]
    : [];

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mt-6 flex items-end gap-3">
        <div>
          <Select
            label="Window"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="mt-1"
          >
            {[1, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </div>
        <Button size="lg" onClick={() => run({ days })} disabled={loading}>
          {loading ? "Scoring…" : "Score leads"}
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
