"use client";

import { useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView from "@/components/tools/ResultView";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface PipelinePulseResult {
  days: number;
  newCount: number;
  pipelineValue: number;
  avgAmount: number;
  funnel: { open: number; won: number; lost: number };
  closedWon: { count: number; revenue: number };
  closedLostCount: number;
  perOwner: {
    ownerId: string;
    ownerName: string;
    wonCount: number;
    wonRevenue: number;
    openPipeline: number;
  }[];
}

export default function PipelinePulsePage() {
  const [days, setDays] = useState(30);
  const { data, error, loading, run } = useToolApi<PipelinePulseResult>("pipeline-pulse");

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
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </div>
        <Button size="lg" onClick={() => run({ days })} disabled={loading}>
          {loading ? "Pulsing…" : "Pulse"}
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
