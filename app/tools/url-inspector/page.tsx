"use client";

import { useState } from "react";
import { useToolApi } from "@/components/tools/useToolApi";
import ResultView, { type SendToLink } from "@/components/tools/ResultView";
import { usePrefill, prefillUrl } from "@/components/tools/usePrefill";
import tool from "./tool";
import { ToolPageHeader } from "@/lib/tool-icons";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ErrorBanner from "@/components/ui/ErrorBanner";

interface UrlInspectorResult {
  url: string;
  site: string | null;
  inspection: Record<string, unknown> | null;
  psi: Record<string, unknown> | null;
}

export default function UrlInspectorPage() {
  const prefill = usePrefill();
  const [url, setUrl] = useState(prefill.url || "");
  const [site, setSite] = useState(prefill.site || "");
  const { data, error, loading, run } = useToolApi<UrlInspectorResult>("url-inspector");

  const sendTo: SendToLink[] = data
    ? [
        {
          label: "Mobile vs Desktop PSI",
          href: prefillUrl("/tools/mobile-desktop-psi", { url: data.url }),
        },
        {
          label: "Onsite Audit",
          href: prefillUrl("/tools/onsite-audit", { url: data.url }),
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
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://client-site.com/page"
          />
        </div>
        <div>
          <Input
            label="GSC site (optional — auto-matched)"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="https://client-site.com/"
          />
        </div>
      </Card>

      <div className="mt-4">
        <Button
          size="lg"
          onClick={() => run({ url, site })}
          disabled={loading || !url}
        >
          {loading ? "Inspecting…" : "Inspect"}
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
