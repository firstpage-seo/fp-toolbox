import MetricCard from "./MetricCard";
import UnconfiguredNotice from "./UnconfiguredNotice";
import SectionHeader from "./SectionHeader";
import AiPlansPanel from "./AiPlansPanel";
import CardHead from "./CardHead";
import StatMini from "./StatMini";
import TwoCol from "./TwoCol";
import Legend from "./Legend";
import HBarRow from "./HBarRow";
import Card from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell } from "@/components/ui/table";
import LeadTrendChart from "./LeadTrendChart";
import LeadScoreChart from "./LeadScoreChart";
import { tools } from "@/lib/registry";
import type { SalesData } from "@/lib/dashboard";
import type { Insight } from "@/lib/insights";

const usd = (n: number): string =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const toolName = new Map(tools.map((t) => [t.slug, t.name]));

interface SalesSectionProps {
  d: SalesData;
  insights: Insight[];
}

/** Sales performance half of the dashboard — design-ref sales zone. */
export default function SalesSection({ d, insights }: SalesSectionProps) {
  const totalLeads = d.hubspot.spam?.good ?? d.hubspot.leads.length;
  const spamRate = d.hubspot.spam?.spamRatePct ?? null;
  const deals = d.deals.aggregate;
  const donutData = d.hubspot.spam
    ? [
        { name: "Good leads", value: d.hubspot.spam.good },
        { name: "Spam", value: d.hubspot.spam.spam },
      ]
    : [];
  const spamSources = (d.hubspot.spam?.topSources ?? []).slice(0, 5);

  const eng = d.engagement.report;
  const misrate =
    eng && eng.engagedCount > 0 ? Math.round((eng.engagedSpam / eng.engagedCount) * 100) : null;

  const funnel = deals
    ? [
        { name: "Open", count: deals.funnel.open, amount: deals.pipelineValue, color: "#427fe0" },
        { name: "Won", count: deals.funnel.won, amount: deals.closedWon.revenue, color: "oklch(0.55 0.14 152)" },
        { name: "Lost", count: deals.funnel.lost, amount: null, color: "oklch(0.62 0.2 22 / 0.7)" },
      ]
    : [];
  const funnelMax = deals ? Math.max(deals.funnel.open, deals.funnel.won, deals.funnel.lost) : 0;
  const maxRevenue = deals?.perOwner[0]?.wonRevenue ?? 0;

  return (
    <>
      <SectionHeader
        id="sales"
        accent="sales"
        title="Sales Performance"
        tag="HubSpot"
        insights={insights}
      />

      <AiPlansPanel days={d.rangeDays} zone="sales" />

      {/* KPI row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="New leads"
          value={totalLeads.toLocaleString()}
          sub={d.hubspot.configured ? "non-spam, from HubSpot" : "HubSpot not configured"}
          delta={d.deltas.leads}
          deltaHint="vs prev 30d"
          spark={d.hubspot.trend.map((t) => t.leads)}
        />
        <MetricCard
          label="Spam rate"
          value={spamRate !== null ? spamRate.toFixed(1) : "—"}
          suffix="%"
          sub={spamRate !== null ? "of contacts in window" : "needs HUBSPOT_SERVICE_KEY"}
          delta={d.deltas.spamRate}
          deltaInvert
          deltaSuffix="pp"
          deltaHint="improvement"
        />
        <MetricCard
          label="Closed-won"
          value={deals ? usd(deals.closedWon.revenue) : "—"}
          sub={deals ? `${deals.closedWon.count} deals` : "HubSpot deals not loaded"}
          delta={d.deltas.closedWonRevenue}
          deltaHint={deals ? `${deals.closedWon.count} deals` : undefined}
        />
        <MetricCard
          label="Pipeline (new)"
          value={deals ? usd(deals.pipelineValue) : "—"}
          sub={deals ? `${deals.newCount} deals created` : "needs deals.read scope"}
          delta={d.deltas.pipelineValue}
          deltaHint={deals ? `${deals.newCount} deals` : undefined}
        />
      </div>

      {/* Pipeline — deals created + outcome funnel */}
      <Card className="mt-8">
        <CardHead title="Pipeline" src="HubSpot deals" />
        {!d.hubspot.configured ? (
          <div className="mt-4">
            <UnconfiguredNotice envVar="HUBSPOT_SERVICE_KEY">
              Connect HubSpot to see pipeline and closed-won revenue.
            </UnconfiguredNotice>
          </div>
        ) : d.deals.error ? (
          <div className="rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 p-6 text-center">
            <div className="text-2xl" aria-hidden>🔒</div>
            <p className="mt-2 text-sm font-medium text-rose-700">
              Couldn&apos;t load deals — likely missing <code className="rounded bg-rose-100 px-1 py-0.5 font-mono">deals.read</code> scope.
            </p>
            <p className="mt-1 text-xs text-rose-500">{d.deals.error}</p>
          </div>
        ) : deals ? (
          <TwoCol
            left={
              <>
                <StatMini label="Avg deal size" value={deals.avgAmount ? usd(deals.avgAmount) : "—"} />
                <StatMini label="Won deals" value={deals.closedWon.count} />
                <StatMini label="New deals created" value={deals.newCount} />
                <StatMini label="Open pipeline value" value={usd(deals.pipelineValue)} />
              </>
            }
            right={
              <div className="flex flex-col gap-2 mt-2">
                {funnel.map((f) => (
                  <div key={f.name} className="flex items-center gap-3">
                    <span className="w-[70px] text-[12.5px] font-bold text-muted">{f.name}</span>
                    <div className="flex-1 h-[22px] rounded-md bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-md"
                        style={{ width: `${funnelMax > 0 ? (f.count / funnelMax) * 100 : 0}%`, background: f.color }}
                      />
                    </div>
                    <span className="w-[150px] text-right text-[13px] font-mono tabular-nums">
                      {f.count} deals{f.amount !== null ? ` · ${usd(f.amount)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            }
          />
        ) : (
          <p className="text-sm text-muted">Loading deals…</p>
        )}
      </Card>

      {/* Sales leaderboard */}
      <Card className="mt-8">
        <CardHead title="Sales leaderboard" src="closed-won · 30d" />
        {d.deals.error ? (
          <p className="text-sm text-rose-600">Deals unavailable: {d.deals.error}</p>
        ) : deals && deals.perOwner.length > 0 ? (
          <div>
            {deals.perOwner.map((row, idx) => (
              <div key={row.ownerId} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <span
                  className={`h-[26px] w-[26px] rounded-lg grid place-items-center font-extrabold text-[12.5px] shrink-0 ${
                    idx === 0
                      ? "bg-[oklch(0.72_0.15_75_/_0.25)] text-[oklch(0.5_0.13_75)]"
                      : "bg-surface text-navy"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="w-[150px] shrink-0 font-bold text-[13.5px] text-navy truncate">
                  {row.ownerName}
                  <small className="block font-medium text-[11.5px] text-muted">
                    {row.wonCount} won
                  </small>
                </span>
                <div className="flex-1 h-3 rounded-md bg-surface overflow-hidden">
                  <div
                    className="h-full rounded-md bg-[#427fe0]"
                    style={{ width: `${maxRevenue > 0 ? (row.wonRevenue / maxRevenue) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-[130px] shrink-0 text-right font-mono font-bold text-[13.5px] text-navy tabular-nums">
                  {usd(row.wonRevenue)} · {row.wonCount} won
                </span>
              </div>
            ))}
          </div>
        ) : deals ? (
          <p className="text-sm text-muted">No closed-won deals in this window.</p>
        ) : (
          <p className="text-sm text-muted">Loading leaderboard…</p>
        )}
      </Card>

      {/* HubSpot leads */}
      <Card className="mt-8">
        <CardHead title="HubSpot leads" src={`HubSpot contacts · ${d.rangeDays}d`} />
        {!d.hubspot.configured ? (
          <div className="mt-4">
            <UnconfiguredNotice envVar="HUBSPOT_SERVICE_KEY">
              Connect HubSpot to see lead volume, spam rate and source breakdown.
            </UnconfiguredNotice>
          </div>
        ) : (
          <>
            {d.hubspot.error ? (
              <p className="text-sm text-rose-600">Couldn&apos;t load leads: {d.hubspot.error}</p>
            ) : null}
            <TwoCol
              left={
                <>
                  <LeadTrendChart data={d.hubspot.trend} />
                  <Legend items={[{ color: "oklch(0.55 0.14 152)", label: "Daily new leads" }]} />
                </>
              }
              right={
                <>
                  <LeadScoreChart data={donutData} />
                  <Legend
                    center
                    items={[
                      { color: "oklch(0.55 0.14 152)", label: "Good leads" },
                      { color: "oklch(0.62 0.2 22 / 0.75)", label: "Spam" },
                    ]}
                  />
                  <div className="mt-2">
                    <StatMini label="Top spam source" value={spamSources[0]?.domain ?? "—"} />
                    <StatMini label="Spam contacts" value={d.hubspot.spam ? d.hubspot.spam.spam.toLocaleString() : "—"} />
                    <StatMini label="Good leads" value={d.hubspot.spam ? d.hubspot.spam.good.toLocaleString() : "—"} />
                  </div>
                </>
              }
            />
          </>
        )}
      </Card>

      {/* Lead quality check — engagement cross-check */}
      <Card className="mt-8">
        <CardHead title="Lead quality check" src="heuristic review · 30d" />
        {!d.hubspot.configured ? (
          <div className="mt-4">
            <UnconfiguredNotice envVar="HUBSPOT_SERVICE_KEY">
              Connect HubSpot to cross-check the spam filter against real engagement.
            </UnconfiguredNotice>
          </div>
        ) : d.engagement.error ? (
          <p className="text-sm text-rose-600">
            Couldn&apos;t load engagement data: {d.engagement.error}
          </p>
        ) : eng ? (
          <TwoCol
            left={
              <>
                <StatMini label="Engaged leads" value={eng.engagedCount} />
                <StatMini label="Flagged as spam" value={eng.engagedSpam} />
                <StatMini label="Misjudged rate" value={misrate !== null ? `${misrate}%` : "—"} />
                {eng.engagedSpam === 0 ? (
                  <p className="mt-3 text-sm font-bold text-[oklch(0.42_0.13_152)]">
                    ✓ Filter aligned — no engaged lead was flagged as spam.
                  </p>
                ) : (
                  <>
                    <h4 className="text-[13.5px] font-extrabold text-navy mt-3.5 mb-1.5">
                      Why real leads get flagged
                    </h4>
                    {eng.topReasons.slice(0, 4).map((r) => (
                      <HBarRow
                        key={r.label}
                        name={r.label}
                        pct={Math.round((r.count / eng.engagedSpam) * 100)}
                        value={r.count}
                        color="oklch(0.72 0.15 75)"
                        nameWidth="w-[190px]"
                      />
                    ))}
                  </>
                )}
              </>
            }
            right={
              <>
                <h4 className="text-[13.5px] font-extrabold text-navy mb-1.5">
                  Misjudged leads, follow up today
                </h4>
                {eng.misclassified.length === 0 ? (
                  <p className="text-sm text-muted">None this window.</p>
                ) : (
                  <Table className="text-[13.5px]">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="h-auto px-0 py-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">Contact</TableHead>
                        <TableHead className="h-auto px-0 py-2 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">Signal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eng.misclassified.slice(0, 5).map((m) => (
                        <TableRow key={m.email} className="border-border">
                          <TableCell className="px-0 py-2 pr-4 font-mono text-xs text-navy">{m.email}</TableCell>
                          <TableCell className="px-0 py-2 text-[12.5px] text-muted">{m.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <h4 className="text-[13.5px] font-extrabold text-navy mt-5 mb-1.5">
                  Spam without follow-up · top domains
                </h4>
                {eng.pureSpamTopDomains.length === 0 ? (
                  <p className="text-sm text-muted">—</p>
                ) : (
                  <Table className="text-[13.5px]">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="h-auto px-0 py-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">Domain</TableHead>
                        <TableHead className="h-auto px-0 py-2 text-right text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">Contacts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eng.pureSpamTopDomains.slice(0, 5).map((row) => (
                        <TableRow key={row.label} className="border-border">
                          <TableCell className="px-0 py-2 pr-4 font-mono text-xs text-navy">{row.label}</TableCell>
                          <TableCell className="px-0 py-2 text-right tabular-nums">{row.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            }
          />
        ) : (
          <p className="text-sm text-muted">Loading engagement data…</p>
        )}
      </Card>

      {/* Tool ROI */}
      <Card className="mt-8">
        <CardHead title="Tool ROI" src={`${d.rangeDays}d · usage_events`} />
        {d.usage.perTool.length === 0 ? (
          <p className="text-sm text-muted">
            No tool usage logged yet — runs appear here as the team uses the toolbox.
          </p>
        ) : (
          <Table className="text-[13.5px]">
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="h-auto px-0 py-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">Tool</TableHead>
                <TableHead className="h-auto px-0 py-2 pr-4 text-right text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">Runs</TableHead>
                <TableHead className="h-auto px-0 py-2 text-right text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">LLM cost (US$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.usage.perTool.slice(0, 8).map((t) => (
                <TableRow key={t.tool_slug} className="border-border">
                  <TableCell className="px-0 py-2.5 pr-4 font-bold text-navy">{toolName.get(t.tool_slug) ?? t.tool_slug}</TableCell>
                  <TableCell className="px-0 py-2.5 pr-4 text-right tabular-nums">{t.runs}</TableCell>
                  <TableCell className="px-0 py-2.5 text-right tabular-nums">{t.cost_usd.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="border-t-2 border-navy bg-transparent">
              <TableRow className="font-extrabold text-navy hover:bg-transparent">
                <TableCell className="px-0 py-2.5 pr-4">Total (all tools)</TableCell>
                <TableCell className="px-0 py-2.5 pr-4 text-right tabular-nums">{d.usage.totalRuns}</TableCell>
                <TableCell className="px-0 py-2.5 text-right tabular-nums">{d.usage.totalCostUsd.toFixed(2)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>
    </>
  );
}
