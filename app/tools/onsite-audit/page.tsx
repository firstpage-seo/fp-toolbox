"use client";
import tool from "./tool";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { usePrefill } from "@/components/tools/usePrefill";

type Verdict = "pass" | "fail" | "warn" | "manual" | "n-a";
type ActionStatus = "pending" | "in-progress" | "done" | "n-a";

interface Progress {
  status: string;
  phase: string;
  message: string;
  pagesCrawled: number;
  pagesTotal: number;
}

interface AuditResult {
  jobId: string;
  target: string;
  domain: string;
  sections: { name: string; items: { id: string; item: string; kind: string; verdict: Verdict; evidence?: string }[] }[];
  summary: { passed: number; failed: number; warned: number; manual: number; total: number };
  manualActions: { id: string; item: string; section: string; instruction: string }[];
  llmSummary: string;
}

interface HistoryEntry {
  id: number;
  domain: string;
  createdAt: string;
  summary: { passed: number; failed: number; warned: number; manual: number } | null;
}

interface ActionState {
  status: ActionStatus;
  note: string;
  saved: boolean;
  saving: boolean;
}

const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  pass: { label: "Pass", cls: "bg-emerald-100 text-emerald-700" },
  fail: { label: "Fail", cls: "bg-rose-100 text-rose-700" },
  warn: { label: "Review", cls: "bg-amber-100 text-amber-700" },
  manual: { label: "Manual", cls: "bg-slate-200 text-slate-600" },
  "n-a": { label: "N/A", cls: "bg-violet-100 text-violet-700" },
};

const ACTION_STYLE: Record<ActionStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-slate-200 text-slate-600" },
  "in-progress": { label: "In progress", cls: "bg-blue-100 text-blue-700" },
  done: { label: "Done", cls: "bg-emerald-100 text-emerald-700" },
  "n-a": { label: "N/A", cls: "bg-violet-100 text-violet-700" },
};

const ACTION_STATUSES: ActionStatus[] = ["pending", "in-progress", "done", "n-a"];
const ACTION_FILTERS: ("all" | ActionStatus)[] = ["all", ...ACTION_STATUSES];

function statusText(s: string): string {
  if (s === "crawling") return "Crawling";
  if (s === "collecting") return "Collecting signals";
  if (s === "summarizing") return "Summarizing";
  if (s === "done") return "Done";
  if (s === "error") return "Error";
  return "Queued";
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toMarkdown(r: AuditResult): string {
  const lines: string[] = [`# Onsite SEO Audit — ${r.domain}`, "", r.llmSummary, ""];
  lines.push(`**Summary:** ${r.summary.passed} pass · ${r.summary.failed} fail · ${r.summary.warned} review · ${r.summary.manual} manual`, "");
  for (const sec of r.sections) {
    lines.push(`## ${sec.name}`, "");
    lines.push("| # | Check | Status | Evidence |", "|---|-------|--------|----------|");
    for (const it of sec.items) {
      const st = VERDICT_STYLE[it.verdict]?.label ?? it.verdict;
      lines.push(`| ${it.id} | ${it.item.replace(/\|/g, "\\|")} | ${st} | ${(it.evidence ?? "").replace(/\|/g, "\\|")} |`);
    }
    lines.push("");
  }
  if (r.manualActions.length) {
    lines.push("## Manual actions needed", "");
    for (const m of r.manualActions) lines.push(`- [ ] **${m.id}** ${m.item} — ${m.instruction}`);
  }
  return lines.join("\n");
}

export default function OnsiteAuditPage() {
  const prefill = usePrefill();
  const [url, setUrl] = useState(prefill.url || "");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [actions, setActions] = useState<Record<string, ActionState>>({});
  const [actionFilter, setActionFilter] = useState<"all" | ActionStatus>("all");
  const [verdictFilter, setVerdictFilter] = useState<"all" | Verdict>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/onsite-audit");
      const json = await res.json();
      if (json.history) setHistory(json.history);
    } catch {
      // history is best-effort
    }
  }, []);

  const loadActions = useCallback(async (domain: string) => {
    try {
      const res = await fetch(`/api/tools/onsite-audit/actions?domain=${encodeURIComponent(domain)}`);
      const json = await res.json();
      if (Array.isArray(json.actions)) {
        const map: Record<string, ActionState> = {};
        for (const a of json.actions as { itemId: string; status: ActionStatus; note: string }[]) {
          map[a.itemId] = { status: a.status, note: a.note, saved: true, saving: false };
        }
        setActions(map);
      }
    } catch {
      // actions are best-effort
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tools/onsite-audit")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.history) setHistory(json.history);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stopPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setError(null);
    setResult(null);
    setActions({});
    setStarting(true);
    try {
      const res = await fetch("/api/tools/onsite-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to start audit");
        setStarting(false);
        return;
      }
      setProgress(json.progress);
      setStarting(false);
      pollRef.current = setInterval(async () => {
        const pr = await fetch(`/api/tools/onsite-audit?jobId=${json.jobId}`);
        const pj = await pr.json();
        if (pj.error) {
          setError(pj.error);
          stopPoll();
          return;
        }
        setProgress(pj.progress);
        if (pj.progress?.status === "done" && pj.result) {
          setResult(pj.result);
          stopPoll();
          void refreshHistory();
          void loadActions(pj.result.domain);
        } else if (pj.progress?.status === "error") {
          setError(pj.progress.message || "Audit failed");
          stopPoll();
        }
      }, 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  const busy = starting || (progress && ["queued", "crawling", "collecting", "summarizing"].includes(progress.status));

  const loadRun = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/tools/onsite-audit?outputId=${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load run");
        return;
      }
      setResult(json.output as AuditResult);
      setProgress(null);
      if (Array.isArray(json.actions)) {
        const map: Record<string, ActionState> = {};
        for (const a of json.actions as { itemId: string; status: ActionStatus; note: string }[]) {
          map[a.itemId] = { status: a.status, note: a.note, saved: true, saving: false };
        }
        setActions(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const updateAction = async (itemId: string, patch: Partial<Pick<ActionState, "status" | "note">>) => {
    if (!result) return;
    const prev = actions[itemId] ?? { status: "pending" as ActionStatus, note: "", saved: true, saving: false };
    setActions((a) => ({ ...a, [itemId]: { ...prev, ...patch, saving: true } }));
    try {
      const res = await fetch("/api/tools/onsite-audit/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: result.domain,
          itemId,
          status: patch.status ?? prev.status,
          note: patch.note ?? prev.note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setActions((a) => ({ ...a, [itemId]: { ...a[itemId], saved: true, saving: false } }));
    } catch (e) {
      setActions((a) => ({ ...a, [itemId]: { ...a[itemId], saved: false, saving: false } }));
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const manualList = result?.manualActions ?? [];
  const doneCount = manualList.filter((m) => {
    const s = actions[m.id]?.status;
    return s === "done" || s === "n-a";
  }).length;
  const filteredManual = manualList.filter((m) => {
    if (actionFilter === "all") return true;
    return (actions[m.id]?.status ?? "pending") === actionFilter;
  });

  return (
    <>
      {/* Page head — onsite-audit.html hero */}
      <div className="bg-grad-banner text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-11 pb-[52px]">
          <span className="inline-flex items-center text-xs font-bold tracking-[0.12em] uppercase bg-white/14 border border-white/22 px-3.5 py-1.5 rounded-full mb-5">
            {tool.category} · Full-site audit
          </span>
          <h1 className="text-white text-[clamp(28px,3.4vw,40px)] font-extrabold tracking-[-0.02em] max-w-[24ch]">
            {tool.name}
          </h1>
          <p className="text-[oklch(0.93_0.02_250)] text-[15.5px] mt-3 max-w-[62ch]">
            {tool.description}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.09em] bg-white/10 border border-white/18 text-[oklch(0.96_0.01_250)] px-3 py-1.5 rounded-full">
              Job-based
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.09em] bg-white/10 border border-white/18 text-[oklch(0.96_0.01_250)] px-3 py-1.5 rounded-full">
              Owner: {tool.owner}
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        {/* Run card — onsite-audit.html .run-card */}
        <div className="relative z-10 -mt-7 bg-white border border-border rounded-[14px] shadow-[var(--shadow-md)] p-6">
          <div className="text-[11.5px] font-extrabold uppercase tracking-[0.09em] text-muted">
            Target URL
          </div>
          <div className="mt-2 flex flex-wrap gap-2.5">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://client-site.com"
              className="flex-1 min-w-[240px] h-[48px] rounded-[10px] border border-border px-4 text-[15px] text-foreground placeholder:text-muted focus:border-blue focus:outline-none focus:ring-[3px] focus:ring-fp-500/15"
            />
            <button
              onClick={run}
              disabled={busy || !url}
              className="inline-flex items-center gap-2.5 rounded-[10px] bg-grad-cta text-white font-bold text-[15px] px-5.5 min-h-[48px] shadow-[var(--shadow-md)] hover:brightness-105 active:translate-y-px disabled:opacity-45 disabled:cursor-default disabled:filter-none"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[17px] h-[17px]" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
              </svg>
              {busy ? "Running…" : "Run audit"}
            </button>
          </div>
          <p className="mt-3 text-[12.5px] text-muted leading-relaxed">
            The audit crawls the site, then checks on-page, Search Console,
            Analytics, PageSpeed and backlink signals. Manual steps are returned
            as a to-do list for the AM.
          </p>
        </div>

        {/* Progress card — onsite-audit.html .progress-card */}
        {progress && !result && (
          <div className="mt-4 bg-white border border-border rounded-[14px] shadow-[var(--shadow-sm)] p-6">
            <div className="flex items-baseline justify-between gap-3">
              <b className="text-[16px] font-extrabold text-navy tracking-[-0.01em]">{statusText(progress.status)}</b>
              <span className="text-[12.5px] text-muted uppercase tracking-wide">JOB PHASE</span>
            </div>
            <div className="mt-1 text-[13.5px] text-muted">{progress.message}</div>
            {progress.status === "crawling" && progress.pagesTotal > 0 && (
              <div className="mt-2.5 text-[13px] font-bold text-fp-600 tabular-nums">
                {progress.pagesCrawled}/{progress.pagesTotal} pages
              </div>
            )}
            <div className="mt-3.5 h-2 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full bg-grad-banner transition-all duration-500"
                style={{
                  width:
                    progress.status === "crawling" && progress.pagesTotal > 0
                      ? `${Math.min(100, (progress.pagesCrawled / progress.pagesTotal) * 100)}%`
                      : progress.status === "done"
                        ? "100%"
                        : "8%",
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-[10px] border border-[oklch(0.58_0.21_26_/_0.25)] bg-[oklch(0.62_0.2_22_/_0.06)] px-4 py-3 text-sm font-semibold text-[oklch(0.62_0.2_22)]">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4">
            {/* Result head — onsite-audit.html .result-head */}
            <div className="bg-white border border-border rounded-[14px] shadow-[var(--shadow-sm)] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3.5">
                <div>
                  <h2 className="text-[19px] font-extrabold text-navy">Audit result</h2>
                  <div className="text-[19px] font-extrabold text-navy">{result.domain}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {new Date().toLocaleString()} · {result.jobId}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => download("onsite-audit.md", toMarkdown(result), "text/markdown")}
                    className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-white px-3.5 py-2 text-[13px] font-bold text-navy hover:bg-surface"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]" aria-hidden="true">
                      <path d="M12 3v12M7 10l5 5 5-5" />
                      <path d="M4 21h16" />
                    </svg>
                    Report (.md)
                  </button>
                  <button
                    onClick={() => download("onsite-audit.json", JSON.stringify(result, null, 2), "application/json")}
                    className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-white px-3.5 py-2 text-[13px] font-bold text-navy hover:bg-surface"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]" aria-hidden="true">
                      <path d="M12 3v12M7 10l5 5 5-5" />
                      <path d="M4 21h16" />
                    </svg>
                    JSON
                  </button>
                  <button
                    onClick={() => {
                      setResult(null);
                      setProgress(null);
                      setActions({});
                    }}
                    className="inline-flex items-center gap-1.5 px-2 py-2 text-[13px] font-bold text-fp-600"
                  >
                    Run another audit
                  </button>
                </div>
              </div>

              {/* Stats — onsite-audit.html .stats */}
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { k: "Total", v: result.summary.total, cls: "text-navy" },
                  { k: "Pass", v: result.summary.passed, cls: "text-[oklch(0.42_0.13_152)]" },
                  { k: "Fail", v: result.summary.failed, cls: "text-[oklch(0.62_0.2_22)]" },
                  { k: "Review", v: result.summary.warned, cls: "text-[oklch(0.55_0.13_75)]" },
                  { k: "Manual", v: result.summary.manual, cls: "text-muted" },
                ].map((s) => (
                  <div key={s.k} className="rounded-[10px] bg-surface px-4 py-3.5">
                    <div className={`text-[28px] font-extrabold tracking-[-0.02em] leading-none tabular-nums ${s.cls}`}>{s.v}</div>
                    <div className="mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.09em] text-muted">{s.k}</div>
                  </div>
                ))}
              </div>

              {/* Executive summary — onsite-audit.html .summary-ai */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted mb-2">
                  Executive summary
                </div>
                <p className="text-[14px] leading-relaxed max-w-[75ch] text-[oklch(0.3_0.05_266)]">{result.llmSummary}</p>
              </div>
            </div>

            {/* Manual actions — onsite-audit.html .result-manual */}
            {manualList.length > 0 && (
              <div className="mt-4 bg-white border border-border rounded-[14px] shadow-[var(--shadow-sm)] p-6">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h3 className="text-[17px] font-extrabold text-navy">Manual actions needed</h3>
                  <span className="text-xs font-bold text-muted">{doneCount}/{manualList.length} done</span>
                </div>
                <p className="mt-1 text-[12.5px] text-muted">
                  Items that need an AM, client access, or a separate task. Tick them off as they are handled.
                </p>
                <div className="mt-3.5 h-2 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[oklch(0.55_0.14_152)] transition-all"
                    style={{ width: `${Math.min(100, (doneCount / manualList.length) * 100)}%` }}
                  />
                </div>
                <div className="mt-3">
                  {filteredManual.map((m) => {
                    const a = actions[m.id] ?? { status: "pending" as ActionStatus, note: "", saved: true, saving: false };
                    const done = a.status === "done" || a.status === "n-a";
                    return (
                      <div key={m.id} className={`flex items-start gap-3 py-2.5 border-t border-border first:border-0 ${done ? "opacity-45" : ""}`}>
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => void updateAction(m.id, { status: done ? "pending" : "done" })}
                          className="mt-1 h-[17px] w-[17px] shrink-0 cursor-pointer accent-fp-600"
                        />
                        <div className="min-w-0 flex-1">
                          <b className={`text-[13.5px] font-bold text-navy ${done ? "line-through" : ""}`}>{m.item}</b>
                          {m.instruction && (
                            <span className="block text-[12.5px] text-muted mt-0.5">{m.instruction}</span>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <select
                              value={a.status}
                              onChange={(e) => void updateAction(m.id, { status: e.target.value as ActionStatus })}
                              className="rounded-lg border border-border px-2 py-1 text-xs focus:border-fp-400 focus:outline-none"
                            >
                              {ACTION_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {ACTION_STYLE[s].label}
                                </option>
                              ))}
                            </select>
                            <input
                              value={a.note}
                              onChange={(e) =>
                                setActions((prev) => ({
                                  ...prev,
                                  [m.id]: { ...prev[m.id], note: e.target.value, saved: false, saving: false },
                                }))
                              }
                              onBlur={() => {
                                const cur = actions[m.id];
                                if (cur && !cur.saved) void updateAction(m.id, { note: cur.note });
                              }}
                              placeholder="Note…"
                              className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1 text-xs focus:border-fp-400 focus:outline-none"
                            />
                            <span className="w-14 text-right text-xs text-muted">
                              {a.saving ? "saving…" : a.saved ? "✓ saved" : ""}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-[11.5px] text-muted pt-0.5 shrink-0">{m.id}</span>
                      </div>
                    );
                  })}
                  {filteredManual.length === 0 && (
                    <p className="py-2 text-sm text-muted">No manual actions in this filter.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ACTION_FILTERS.map((f) => {
                    const count =
                      f === "all"
                        ? manualList.length
                        : manualList.filter((m) => (actions[m.id]?.status ?? "pending") === f).length;
                    return (
                      <button
                        key={f}
                        onClick={() => setActionFilter(f)}
                        className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                          actionFilter === f
                            ? "bg-navy border-navy text-white"
                            : "border-border bg-white text-muted hover:border-[oklch(0.75_0_0)]"
                        }`}
                      >
                        {f === "all" ? "All" : ACTION_STYLE[f].label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Checks filters — onsite-audit.html .filters */}
            <div className="flex flex-wrap gap-1.5 mt-5 mb-1">
              {(["all", "fail", "warn", "pass", "manual"] as const).map((f) => {
                const count = result.sections.reduce(
                  (n, s) => n + s.items.filter((it) => f === "all" || it.verdict === f).length,
                  0
                );
                const label = f === "all" ? "All" : f === "warn" ? "Review" : f === "pass" ? "Pass" : f === "fail" ? "Fail" : "Manual";
                return (
                  <button
                    key={f}
                    onClick={() => setVerdictFilter(f)}
                    className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                      verdictFilter === f
                        ? "bg-navy border-navy text-white"
                        : "border-border bg-white text-muted hover:border-[oklch(0.75_0_0)]"
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
              <span className="ml-auto self-center text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                Auto · Semi-auto · Manual
              </span>
            </div>

            {/* Sections — onsite-audit.html .sections / .sec */}
            <div className="mt-3.5 space-y-3.5">
              {result.sections.map((sec) => {
                const visible = sec.items.filter((it) => verdictFilter === "all" || it.verdict === verdictFilter);
                if (visible.length === 0) return null;
                const collapsed = collapsedSections.has(sec.name);
                const passCount = sec.items.filter((it) => it.verdict === "pass").length;
                const failCount = sec.items.filter((it) => it.verdict === "fail").length;
                return (
                  <div key={sec.name} className="border border-border rounded-[14px] bg-white shadow-[var(--shadow-sm)] overflow-hidden">
                    <div
                      className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none border-b border-border"
                      onClick={() =>
                        setCollapsedSections((prev) => {
                          const next = new Set(prev);
                          if (next.has(sec.name)) next.delete(sec.name);
                          else next.add(sec.name);
                          return next;
                        })
                      }
                    >
                      <h3 className="text-[15.5px] font-extrabold text-navy">{sec.name}</h3>
                      <span className="text-xs font-bold text-muted">{visible.length}</span>
                      <span className="ml-auto flex gap-2.5 text-[11px] font-bold tracking-[0.05em] text-muted">
                        <span>
                          <b className="text-[oklch(0.42_0.13_152)]">{passCount}</b> pass
                        </span>
                        <span>
                          <b className="text-[oklch(0.62_0.2_22)]">{failCount}</b> fail
                        </span>
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`w-4 h-4 text-muted transition-transform ${collapsed ? "-rotate-90" : ""}`}
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                    {!collapsed && (
                      <div className="px-5 py-1.5">
                        {visible.map((it) => {
                          const st = VERDICT_STYLE[it.verdict] ?? { label: it.verdict, cls: "bg-surface text-navy" };
                          const act = it.verdict === "manual" ? actions[it.id] : undefined;
                          return (
                            <div key={it.id} className="flex items-start gap-3 py-2 border-t border-border/60 first:border-0">
                              <span className="font-mono text-[11.5px] text-muted pt-0.5 shrink-0 min-w-[34px]">{it.id}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13.5px] text-navy">
                                  {it.item}
                                  {it.kind ? (
                                    <span className="inline-block text-[10px] font-extrabold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded ml-1.5 align-middle bg-surface text-muted">
                                      {it.kind === "semi-auto" ? "Semi-auto" : it.kind}
                                    </span>
                                  ) : null}
                                </div>
                                {it.evidence && <div className="mt-0.5 text-xs text-muted">{it.evidence}</div>}
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] ${st.cls}`}>
                                {st.label}
                              </span>
                              {act && (
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] ${ACTION_STYLE[act.status].cls}`}>
                                  {ACTION_STYLE[act.status].label}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {result.sections.every(
                (s) => s.items.filter((it) => verdictFilter === "all" || it.verdict === verdictFilter).length === 0
              ) && <p className="py-6 text-center text-[13.5px] text-muted">No checks match this filter in the current view.</p>}
            </div>

          </div>
        )}

        {/* History — onsite-audit.html .history-card */}
        <div className="mt-4 bg-white border border-border rounded-[14px] shadow-[var(--shadow-sm)] p-6">
          <div className="flex items-baseline gap-2.5 mb-1.5">
            <h3 className="text-[17px] font-extrabold text-navy">Previous runs</h3>
            <span className="text-xs font-bold text-muted">{history.length}</span>
          </div>
          {history.length === 0 ? (
            <p className="py-2 text-sm text-muted">No saved runs yet — run an audit and it will appear here.</p>
          ) : (
            <div>
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-3.5 py-3 border-t border-border first:border-0">
                  <div className="min-w-0 flex-1">
                    <b className="text-[14px] font-bold text-navy break-all">{h.domain || `Run #${h.id}`}</b>
                    <div className="text-xs text-muted mt-0.5">
                      {new Date(h.createdAt).toLocaleString()}
                      {h.summary
                        ? ` · ${h.summary.failed} fail · ${h.summary.warned} review · ${h.summary.manual} manual`
                        : ""}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => void loadRun(h.id)}>
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
