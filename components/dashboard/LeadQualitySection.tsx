import Link from "next/link";
import StatCard from "@/components/ui/StatCard";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import type { SpamReport } from "@/lib/hubspot";

interface LeadQualitySectionProps {
  report: SpamReport;
  days: number;
  /** Load failure (e.g. HubSpot 429) — renders an inline error instead of the report. */
  error?: string | null;
}

/** Lead Quality zone on the dashboard — the full admin.html report (headline, KPI row, spam-reason bars, worst-source domains). */
export default function LeadQualitySection({ report, days, error }: LeadQualitySectionProps) {
  const worstSource = report.topSources[0];
  const totalSpam = report.spam || 1;

  return (
    <>
      {/* Zone head */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-1 h-[24px] rounded-[2px] bg-[oklch(0.62_0.2_22)]" aria-hidden />
          <div>
            <h2 className="text-2xl font-extrabold text-navy">Lead Quality</h2>
            <p className="mt-1 text-sm text-muted">
              Last {days} days · HubSpot contacts, run through the spam heuristics
            </p>
          </div>
        </div>
        <Link
          href="/tools/spam-report"
          className="inline-flex items-center gap-2 rounded-[10px] bg-grad-cta text-white font-bold text-[14px] px-5 py-3 min-h-[44px] shadow-[0_6px_16px_oklch(0.62_0.19_22_/_0.35)] hover:brightness-105 transition-all"
        >
          Run live spam report →
        </Link>
      </div>

      {error ? (
        <div
          className="mt-5 rounded-[14px] border-2 border-dashed border-rose-200 bg-rose-50 p-6 text-center"
          role="alert"
        >
          <p className="text-sm font-medium text-rose-700">
            Couldn&apos;t load the lead quality report.
          </p>
          <p className="mt-1 text-xs text-rose-500">{error}</p>
        </div>
      ) : (
        <>
          {/* Headline takeaways */}
      <div className="mt-5 rounded-[14px] border border-[oklch(0.62_0.2_22_/_0.22)] bg-[oklch(0.62_0.2_22_/_0.06)] px-5 py-4 text-[14px] leading-relaxed text-foreground">
        <b className="text-navy">Headline:</b> {report.spam.toLocaleString()} of{" "}
        {report.total.toLocaleString()} inbound contacts ({report.spamRatePct}%) are spam.{" "}
        <b className="text-navy">{report.good.toLocaleString()} real leads</b> pass the
        filter{worstSource ? (
          <>
            {" "}
            — top junk source: <b className="text-navy">{worstSource.domain}</b> (
            {worstSource.count} contacts)
          </>
        ) : null}
        .
      </div>

      {/* KPI row */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total contacts" value={report.total.toLocaleString()} sub="last 30 days" />
        <StatCard label="Real leads" value={report.good.toLocaleString()} sub="pass the spam filter" />
        <StatCard label="Spam" value={report.spam.toLocaleString()} sub="blocked by the filter" />
        <StatCard label="Spam rate" value={`${report.spamRatePct}%`} sub="of all inbound" />
      </div>

      {/* Two panels */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2 items-start">
        <div className="bg-white border border-border rounded-[14px] shadow-[var(--shadow-sm)] p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <h3 className="text-[16px] font-extrabold text-navy">Why contacts are spam</h3>
            <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              share of flagged
            </span>
          </div>
          {report.categories.length === 0 ? (
            <p className="text-sm text-muted">No spam in the window — clean!</p>
          ) : (
            <div className="space-y-2">
              {report.categories.map((c) => {
                const pct = Math.round((c.count / totalSpam) * 100);
                return (
                  <div key={c.reason} className="flex items-center gap-3 py-0.5">
                    <span className="w-[190px] shrink-0 text-[13px] font-semibold text-navy truncate">
                      {c.reason}
                    </span>
                    <div className="flex-1 h-5 rounded-md bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-md bg-[oklch(0.62_0.2_22_/_0.8)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-[54px] shrink-0 text-right font-mono text-[13px] font-bold text-navy">
                      {c.count} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-border rounded-[14px] shadow-[var(--shadow-sm)] p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <h3 className="text-[16px] font-extrabold text-navy">Worst source domains</h3>
            <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              by contacts
            </span>
          </div>
          {report.topSources.length === 0 ? (
            <p className="text-sm text-muted">No spam sources found.</p>
          ) : (
            <Table className="text-[13.5px]">
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="h-auto px-0 py-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                    Domain
                  </TableHead>
                  <TableHead className="h-auto px-0 py-2 pr-4 text-right text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                    Contacts
                  </TableHead>
                  <TableHead className="h-auto px-0 py-2 text-right text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                    Share
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.topSources.map((s) => (
                  <TableRow key={s.domain} className="border-border">
                    <TableCell className="px-0 py-2.5 pr-4 font-mono text-xs text-navy">{s.domain}</TableCell>
                    <TableCell className="px-0 py-2.5 pr-4 text-right tabular-nums">{s.count}</TableCell>
                    <TableCell className="px-0 py-2.5 text-right tabular-nums">
                      {((s.count / totalSpam) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
        </>
      )}
    </>
  );
}
