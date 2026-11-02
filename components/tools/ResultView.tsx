"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

export interface SendToLink {
  label: string;
  href: string;
}

interface ResultViewProps {
  data: unknown;
  sendTo?: SendToLink[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toLocaleString() : String(Math.round(v * 100) / 100);
  }
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Render an array of records as a table with a union of their keys as columns. */
function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  const cols = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) set.add(k);
    return [...set];
  }, [rows]);
  if (cols.length === 0) return <p className="text-sm text-muted">No rows.</p>;
  return (
    <div className="overflow-hidden rounded-[10px] border border-border">
      <Table className="min-w-full text-[13.5px]">
        <TableHeader className="bg-surface/60">
          <TableRow className="border-border">
            {cols.map((c) => (
              <TableHead
                key={c}
                className="px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted"
              >
                {c.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ")}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} className="border-border">
              {cols.map((c) => (
                <TableCell key={c} className="px-3 py-2.5 text-navy">
                  {formatValue(r[c])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Recursive generic renderer: records → stat grid + sections, arrays → tables/lists. */
function renderNode(node: unknown): ReactNode {
  if (Array.isArray(node)) {
    if (node.length === 0) return <p className="text-sm text-muted">No data.</p>;
    if (node.every(isRecord)) return <DataTable rows={node} />;
    if (node.every((v) => !isRecord(v) && !Array.isArray(v))) {
      return (
        <ul className="space-y-1">
          {node.map((v, i) => (
            <li key={i} className="text-sm text-navy">
              {formatValue(v)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <pre className="overflow-x-auto rounded-[10px] bg-navy p-4 text-xs text-[oklch(0.92_0.02_250)] leading-relaxed">
        {JSON.stringify(node, null, 2)}
      </pre>
    );
  }
  if (isRecord(node)) {
    const entries = Object.entries(node);
    const scalars = entries.filter(([, v]) => !Array.isArray(v) && !isRecord(v));
    const complex = entries.filter(([, v]) => Array.isArray(v) || isRecord(v));
    return (
      <div className="space-y-5">
        {scalars.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scalars.map(([k, v]) => (
              <Card key={k} tone="slate" noPadding className="p-3">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                  {k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ")}
                </div>
                <div className="mt-1 text-lg font-extrabold text-navy">
                  {formatValue(v)}
                </div>
              </Card>
            ))}
          </div>
        )}
        {complex.map(([k, v]) => (
          <div key={k}>
            <h3 className="mb-2 text-sm font-extrabold uppercase tracking-[0.07em] text-muted">
              {k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ")}
            </h3>
            {renderNode(v)}
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-sm text-navy">{formatValue(node)}</p>;
}

/**
 * Generic result renderer for data tools. Renders any JSON payload as stat
 * cards + tables, with copy-JSON / download buttons and optional cross-tool
 * "Send to …" links on top.
 */
export default function ResultView({ data, sendTo }: ResultViewProps) {
  const [copied, setCopied] = useState(false);

  function copyJson() {
    void navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "result.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {sendTo?.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="rounded-full bg-fp-500/10 border border-fp-500/25 px-3.5 py-1.5 text-[12.5px] font-bold text-fp-600 hover:bg-fp-500/20"
          >
            {l.label} →
          </a>
        ))}
        <Button variant="secondary" onClick={copyJson}>
          {copied ? "Copied ✓" : "Copy JSON"}
        </Button>
        <Button variant="secondary" onClick={downloadJson}>
          Download
        </Button>
      </div>
      {renderNode(data)}
    </div>
  );
}
