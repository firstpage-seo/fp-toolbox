import Link from "next/link";
import { getSpamReport } from "@/lib/hubspot";
import { getGreetingStats, listRecentGreetings } from "@/lib/greeting";
import { cached } from "@/lib/cache";
import StatCard from "@/components/ui/StatCard";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Memoized 10 min (DB-backed) — the admin page no longer re-hits HubSpot on
  // every refresh. Greeting stats are a cheap local COUNT, no memo needed.
  const report = await cached("spam-report-admin:30", () => getSpamReport(30), 10 * 60 * 1000);
  const greeting = await getGreetingStats(30);
  const greetingLog = await listRecentGreetings(15);
  const worstSource = report.topSources[0];
  const totalSpam = report.spam || 1;

  return (
    <>
      {/* Banner */}
      <div className="bg-grad-banner text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-white text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.015em]">
              Leads
            </h1>
            <p className="mt-1.5 text-[14px] text-[oklch(0.93_0.02_250)]">
              Last 30 days · inbound quality, spam heuristics + auto-greeting status
            </p>
          </div>
          <Link
            href="/tools/spam-report"
            className="inline-flex items-center gap-2 rounded-[10px] bg-grad-cta text-white font-bold text-[14px] px-5 py-3 min-h-[44px] shadow-[0_6px_16px_oklch(0.62_0.19_22_/_0.35)] hover:brightness-105 transition-all"
          >
            Run live spam report →
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Headline takeaways */}
        <div className="rounded-[14px] border border-[oklch(0.62_0.2_22_/_0.22)] bg-[oklch(0.62_0.2_22_/_0.06)] px-5 py-4 mb-6 text-[14px] leading-relaxed text-foreground">
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

        {/* Auto-greeting KPI row */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-[16px] font-extrabold text-navy">Auto-greeting</h2>
            {greeting.live ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                live
              </span>
            ) : (
              <span
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700"
                title="GREETING_DRY_RUN=1 or SMTP_USER unset — nothing was actually sent"
              >
                dry-run
              </span>
            )}
            <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              every 5 min · on new lead with owner
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Sent total" value={greeting.totalSent.toLocaleString()} sub="since auto-greeting enabled" />
            <StatCard label="Sent (30d)" value={greeting.sentDays.toLocaleString()} sub="last 30 days" />
            <StatCard label="Queued" value={greeting.queued.toLocaleString()} tone="fp-700" sub="would send on next poll" />
            <StatCard label="Retrying" value={greeting.retrying.toLocaleString()} sub="errored, re-sent on next poll" />
          </div>

          {/* Recently sent / retrying */}
          <div className="mt-5 bg-white border border-border rounded-[14px] shadow-[var(--shadow-sm)] p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <h2 className="text-[16px] font-extrabold text-navy">Recently sent</h2>
              <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                greeting_sent · latest first
              </span>
            </div>
            {greetingLog.length === 0 ? (
              <p className="text-sm text-muted">
                {greeting.live
                  ? "Nothing sent yet — new leads will appear here within 5 minutes."
                  : "Dry-run mode writes nothing — this list fills once live sends start."}
              </p>
            ) : (
              <Table className="text-[13.5px]">
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="h-auto px-0 py-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                      Recipient
                    </TableHead>
                    <TableHead className="h-auto px-0 py-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                      As
                    </TableHead>
                    <TableHead className="h-auto px-0 py-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                      Subject
                    </TableHead>
                    <TableHead className="h-auto px-0 py-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                      Sent
                    </TableHead>
                    <TableHead className="h-auto px-0 py-2 text-right text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {greetingLog.map((g) => (
                    <TableRow key={g.contactId} className="border-border">
                      <TableCell className="px-0 py-2.5 pr-4">
                        <span className="block truncate font-medium text-navy">{g.email}</span>
                      </TableCell>
                      <TableCell className="px-0 py-2.5 pr-4 text-muted">{g.ownerName || "—"}</TableCell>
                      <TableCell className="px-0 py-2.5 pr-4 text-xs text-navy">{g.subject || "—"}</TableCell>
                      <TableCell className="px-0 py-2.5 pr-4 whitespace-nowrap tabular-nums text-muted">
                        {new Date(g.sentAt).toLocaleDateString()}{" "}
                        {new Date(g.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="px-0 py-2.5 text-right">
                        {g.error ? (
                          <span
                            className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700"
                            title={g.error}
                          >
                            retrying
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            sent
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard label="Total contacts" value={report.total.toLocaleString()} sub="last 30 days" />
          <StatCard label="Real leads" value={report.good.toLocaleString()} sub="pass the spam filter" />
          <StatCard label="Spam" value={report.spam.toLocaleString()} sub="blocked by the filter" />
          <StatCard label="Spam rate" value={`${report.spamRatePct}%`} sub="of all inbound" />
        </div>

        {/* Two panels */}
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <div className="bg-white border border-border rounded-[14px] shadow-[var(--shadow-sm)] p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <h2 className="text-[16px] font-extrabold text-navy">Why contacts are spam</h2>
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
              <h2 className="text-[16px] font-extrabold text-navy">Worst source domains</h2>
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
                      <TableCell className="px-0 py-2.5 pr-4 font-mono text-xs text-navy">
                        {s.domain}
                      </TableCell>
                      <TableCell className="px-0 py-2.5 pr-4 text-right tabular-nums">
                        {s.count}
                      </TableCell>
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
      </main>
    </>
  );
}
