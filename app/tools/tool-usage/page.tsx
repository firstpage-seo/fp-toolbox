"use client";

import { useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView from "@/components/tools/ResultView";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface UsageStatsResult {
  totalRuns: number;
  activeUsers: number;
  totalCostUsd: number;
  perTool: { tool_slug: string; runs: number; cost_usd: number }[];
  windowDays: number | null;
}

export default function ToolUsagePage() {
  const [days, setDays] = useState(0); // 0 = all time
  const { data, error, loading, run } = useToolApi<UsageStatsResult>("tool-usage");

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
            <option value={0}>All time</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </Select>
        </div>
        <Button size="lg" onClick={() => run({ days })} disabled={loading}>
          {loading ? "Loading…" : "Usage"}
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
