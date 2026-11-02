"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface Summary {
  trafficSummary: string;
  keySuccesses: string[];
  contentRoadmap: string[];
}

export default function GscSummary({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const response = await fetch("/api/dashboard/gsc-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not generate the summary. Try again.");
      setSummary(payload.summary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the summary. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-navy">GSC traffic summary</h3>
          <p className="mt-1 text-sm text-muted">A brief analysis of traffic, key successes, and a content roadmap for the selected period.</p>
        </div>
        <Button onClick={generate} disabled={loading} aria-busy={loading}>
          {loading ? "Generating…" : summary ? "Regenerate Summary" : "Generate Summary"}
        </Button>
      </div>
      {loading ? <p className="mt-5 text-sm text-muted" role="status">Analyzing GSC data…</p> : null}
      {error ? <p className="mt-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
      {summary ? (
        <div className="mt-6 grid gap-6 border-t border-border pt-6 lg:grid-cols-3">
          <section>
            <h4 className="text-sm font-extrabold text-navy">Traffic summary</h4>
            <p className="mt-2 text-sm leading-6 text-muted">{summary.trafficSummary}</p>
          </section>
          <section>
            <h4 className="text-sm font-extrabold text-navy">Key successes</h4>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              {summary.keySuccesses.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </section>
          <section>
            <h4 className="text-sm font-extrabold text-navy">Content roadmap</h4>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              {summary.contentRoadmap.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </section>
        </div>
      ) : null}
    </Card>
  );
}
