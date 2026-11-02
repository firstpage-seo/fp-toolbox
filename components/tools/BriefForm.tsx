"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export interface BriefFormValues {
  clientName: string;
  industry: string;
  objective: string;
  targetMarket: string;
  budget: string;
  website: string;
  notes: string;
}

export const EMPTY_BRIEF: BriefFormValues = {
  clientName: "",
  industry: "",
  objective: "",
  targetMarket: "",
  budget: "",
  website: "",
  notes: "",
};

export default function BriefForm({
  brief,
  onChange,
  submitLabel,
  onGenerate,
}: {
  brief: BriefFormValues;
  onChange: (b: BriefFormValues) => void;
  submitLabel: string;
  onGenerate: (brief: BriefFormValues) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const set = (k: keyof BriefFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...brief, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onGenerate(brief);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="space-y-4">
        <span className="text-sm font-semibold text-navy">Client brief</span>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Client name *" value={brief.clientName} onChange={set("clientName")} required />
          <Input
            label="Industry *"
            value={brief.industry}
            onChange={set("industry")}
            required
            placeholder="e.g. Financial Services"
          />
          <Input
            label="Objective *"
            value={brief.objective}
            onChange={set("objective")}
            required
            placeholder="e.g. Lead Generation (B2B)"
          />
          <Input
            label="Target market"
            value={brief.targetMarket}
            onChange={set("targetMarket")}
            placeholder="e.g. Hong Kong, Singapore"
          />
          <Input label="Budget" value={brief.budget} onChange={set("budget")} placeholder="e.g. HKD 50k/month" />
          <Input
            label="Client website"
            value={brief.website}
            onChange={set("website")}
            placeholder="https://… (enables PSI + competitor data)"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Notes</label>
          <textarea
            rows={3}
            value={brief.notes}
            onChange={set("notes")}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-fp-400 focus:outline-none"
          />
        </div>
        <Button type="submit" disabled={busy} size="lg">
          {busy ? "Generating…" : submitLabel}
        </Button>
      </Card>
    </form>
  );
}
