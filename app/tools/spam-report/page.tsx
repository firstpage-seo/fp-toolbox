"use client";

import { useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView from "@/components/tools/ResultView";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface SpamReportResult {
  total: number;
  good: number;
  spam: number;
  spamRatePct: number;
  categories: { reason: string; count: number }[];
  topSources: { domain: string; count: number }[];
}

export default function SpamReportPage() {
  const [days, setDays] = useState(30);
  const { data, error, loading, run } = useToolApi<SpamReportResult>("spam-report");

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
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </div>
        <Button size="lg" onClick={() => run({ days })} disabled={loading}>
          {loading ? "Reporting…" : "Report"}
        </Button>
      </div>

      {error && <ErrorBanner className="mt-6">{error}</ErrorBanner>}
      {data && (
        <div className="mt-6">
          <ResultView data={data} />
        </div>
      )}
      </div>
    </>
  );
}
