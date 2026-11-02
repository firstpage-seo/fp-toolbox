"use client";

import { useEffect, useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView, { type SendToLink } from "@/components/tools/ResultView";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface Ga4SnapshotResult {
  propertyId: string;
  days: number;
  totals: { activeUsers: number; sessions: number };
  trend: { date: string; activeUsers: number; sessions: number }[];
}

export default function Ga4SnapshotPage() {
  const prefill = usePrefill();
  const [properties, setProperties] = useState<{ propertyId: string; displayName: string }[]>([]);
  const [propertyId, setPropertyId] = useState(prefill.property || "");
  const [days, setDays] = useState(30);
  const { data, error, loading, run } = useToolApi<Ga4SnapshotResult>("ga4-snapshot");

  useEffect(() => {
    fetch("/api/tools/ga4-snapshot")
      .then((r) => r.json())
      .then((j) => {
        const list: { propertyId: string; displayName: string }[] = j.properties ?? [];
        setProperties(list);
        if (!propertyId && list.length) setPropertyId(prefill.property || list[0].propertyId);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendTo: SendToLink[] = data
    ? [
        {
          label: "Monthly Report",
          href: prefillUrl("/tools/monthly-report", { property: data.propertyId }),
        },
      ]
    : [];

  return (
    <>
      <ToolPageHeader tool={tool} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <Input
            label="Property"
            list="ga4-properties"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder="Search or paste a property id…"
          />
          <datalist id="ga4-properties">
            {properties.map((p) => (
              <option key={p.propertyId} value={p.propertyId}>
                {p.displayName}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <Select
            label="Days"
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
      </Card>

      <div className="mt-4">
        <Button
          size="lg"
          onClick={() => run({ propertyId, days })}
          disabled={loading || !propertyId}
        >
          {loading ? "Running…" : "Snapshot"}
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
