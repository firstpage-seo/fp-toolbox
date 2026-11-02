import MetricCard from "./MetricCard";
import UnconfiguredNotice from "./UnconfiguredNotice";
import { PsiKpi, PsiDetail } from "./PsiPanel";
import CardHead from "./CardHead";
import StatMini from "./StatMini";
import TwoCol from "./TwoCol";
import Legend from "./Legend";
import HBarRow from "./HBarRow";
import TrafficTrendChart from "./TrafficTrendChart";
import SearchPerformanceTable from "./SearchPerformanceTable";
import TopLandingPagesTable from "./TopLandingPagesTable";
import GscSummary from "./GscSummary";
import Card from "@/components/ui/Card";
import type { WebsiteData } from "@/lib/dashboard";
import SourceFilter from "./SourceFilter";

/** Organic search and site analytics from GA4, GSC, PSI, and Ahrefs. */
export function OrganicTrafficSection({ d, finalizedDate }: { d: WebsiteData; finalizedDate: string }) {
  const ga4Trend = d.ga4.trend;
  const ai = d.aiVisibility.result;
  const keywords = d.ahrefs.result?.keywords ?? [];
  const maxVolume = keywords.length ? Math.max(...keywords.map((k) => k.volume)) : 0;
  const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <div className="pt-9 flex items-center gap-3.5">
        <span className="w-1 h-6 rounded-sm bg-fp-500" aria-hidden />
        <h2 className="text-2xl font-extrabold text-navy">Organic Traffic Performance</h2>
        <span className="text-xs font-bold text-muted">{d.targets.domain}</span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted">
        <p>
          <span className="font-bold text-navy">Selected period:</span>{" "}
          <time dateTime={d.dateRange.startDate}>{formatDate(d.dateRange.startDate)}</time> to{" "}
          <time dateTime={d.dateRange.endDate}>{formatDate(d.dateRange.endDate)}</time>
          {` · ${d.rangeDays} calendar ${d.rangeDays === 1 ? "day" : "days"}, including both dates`}
        </p>
        <p>
          <span className="font-bold text-navy">Comparison period:</span>{" "}
          <time dateTime={d.comparisonRange.startDate}>{formatDate(d.comparisonRange.startDate)}</time> to{" "}
          <time dateTime={d.comparisonRange.endDate}>{formatDate(d.comparisonRange.endDate)}</time>
          {` · previous ${d.comparisonRange.days} calendar ${d.comparisonRange.days === 1 ? "day" : "days"}`}
        </p>
        <p className="text-xs">GA4 and GSC use these periods. PageSpeed and Ahrefs show current snapshots.</p>
        <p className="font-semibold text-amber-700">GSC finalized data is available through {formatDate(finalizedDate)}. The 7d, 30d, and 90d presets end on this date so they include the full number of days.</p>
      </div>

      <SourceFilter panels={{
        ga4: (<>
      <div className="mt-6 max-w-sm">
        <MetricCard
          label="Active users"
          value={d.ga4.totals ? d.ga4.totals.activeUsers.toLocaleString() : "—"}
          sub={d.ga4.totals ? `GA4 · last ${d.rangeDays} days` : "GA4 not loaded"}
          delta={d.deltas.ga4Users}
          deltaHint="vs comparison period"
          spark={ga4Trend.map((t) => t.activeUsers)}
          sparkColor="#427fe0"
        />
      </div>
      {/* Site analytics — GA4 */}
      <Card className="mt-8">
        <CardHead title="Site analytics" src={`GA4 · ${d.ga4.propertyId}`} />
        {d.ga4.error ? (
          <p className="text-sm text-rose-600">Couldn&apos;t load GA4: {d.ga4.error}</p>
        ) : d.ga4.totals ? (
          <TwoCol
            left={
              <>
                <TrafficTrendChart data={ga4Trend} />
                <Legend
                  items={[
                    { color: "#427fe0", label: "Active users" },
                    { color: "oklch(0.5 0.14 254)", label: "Sessions" },
                    {
                      color: "repeating-linear-gradient(90deg,#787878 0 2px,transparent 2px 4px)",
                      label: "Users · 7d avg",
                    },
                  ]}
                />
              </>
            }
            right={
              <>
                <StatMini label={`Active users (${d.rangeDays}d)`} value={d.ga4.totals.activeUsers.toLocaleString()} />
                <StatMini label={`Sessions (${d.rangeDays}d)`} value={d.ga4.totals.sessions.toLocaleString()} />
                <StatMini
                  label="Avg users / day"
                  value={ga4Trend.length ? Math.round(d.ga4.totals.activeUsers / ga4Trend.length).toLocaleString() : "—"}
                />
                <StatMini
                  label="Peak day"
                  value={
                    ga4Trend.length
                      ? `${ga4Trend.reduce((m, t) => (t.activeUsers > m.activeUsers ? t : m)).date.slice(5)} · ${ga4Trend
                          .reduce((m, t) => (t.activeUsers > m.activeUsers ? t : m))
                          .activeUsers.toLocaleString()}`
                      : "—"
                  }
                />
              </>
            }
          />
        ) : (
          <p className="text-sm text-muted">Loading GA4…</p>
        )}
      </Card>

      </>),
        gsc: (<>
      <GscSummary key={`${d.dateRange.startDate}:${d.dateRange.endDate}`} startDate={d.dateRange.startDate} endDate={d.dateRange.endDate} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Impressions"
          value={d.gsc.totals ? d.gsc.totals.impressions.toLocaleString() : "—"}
          sub={d.gsc.totals ? "GSC · organic search" : "GSC not loaded"}
          delta={d.deltas.gscImpressions}
          deltaHint="vs comparison period"
        />
        <MetricCard
          label="Clicks"
          value={d.gsc.totals ? d.gsc.totals.clicks.toLocaleString() : "—"}
          sub={d.gsc.totals ? "GSC · organic search" : "GSC not loaded"}
          delta={d.deltas.gscClicks}
          deltaHint="vs comparison period"
          spark={d.gsc.daily.map((p) => p.clicks)}
          sparkColor="#427fe0"
        />
        <MetricCard
          label="CTR"
          value={d.gsc.totals ? `${(d.gsc.totals.ctr * 100).toFixed(1)}%` : "—"}
          sub={d.gsc.totals ? "GSC · organic search" : "GSC not loaded"}
          delta={d.deltas.gscCtr}
          deltaSuffix=" pp"
          deltaHint="vs comparison period"
        />
        <MetricCard
          label="Average position"
          value={d.gsc.totals ? d.gsc.totals.position.toFixed(1) : "—"}
          sub={d.gsc.totals ? "Lower is better" : "GSC not loaded"}
          delta={d.deltas.gscPosition}
          deltaInvert
          deltaHint="vs comparison period"
        />
      </div>
      {/* Landing pages — GSC */}
      <Card className="mt-8">
        <CardHead title="Top landing pages by clicks" src={`GSC · ${d.gsc.siteUrl}`} />
        <TopLandingPagesTable pages={d.gsc.landingPages} error={d.gsc.pagesError} />
      </Card>

      {/* Search queries — GSC */}
      <Card className="mt-8">
        <CardHead title="Top queries" src={`GSC · ${d.gsc.siteUrl}`} />
        {d.gsc.error ? (
          <p className="text-sm text-rose-600">Couldn&apos;t load GSC: {d.gsc.error}</p>
        ) : (
          <SearchPerformanceTable queries={d.gsc.queries.slice(0, 8)} />
        )}
      </Card>

      </>),
        ahrefs: (<>
      <div className="mt-6 max-w-sm">
        <MetricCard
          label="Keywords tracked"
          value={d.ahrefs.result ? d.ahrefs.result.keywords.length : "—"}
          sub={d.ahrefs.configured ? `${d.targets.domain} (HK)` : "needs AHREFS_API_KEY"}
        />
      </div>
      {/* Search presence — Ahrefs keywords + AI visibility */}
      <Card className="mt-8">
        <CardHead title="Search presence" src="Ahrefs" />
        {!d.ahrefs.configured ? (
          <UnconfiguredNotice envVar="AHREFS_API_KEY">
            Connect Ahrefs to see which keywords we rank for.
          </UnconfiguredNotice>
        ) : d.ahrefs.error ? (
          <p className="text-sm text-rose-600">Couldn&apos;t fetch Ahrefs: {d.ahrefs.error}</p>
        ) : (
          <TwoCol
            left={
              <>
                {keywords.slice(0, 5).map((k) => (
                  <HBarRow
                    key={k.keyword}
                    name={k.keyword}
                    pct={maxVolume > 0 ? Math.round((k.volume / maxVolume) * 100) : 0}
                    value={k.volume.toLocaleString()}
                    color="#427fe0"
                  />
                ))}
                <Legend
                  items={[
                    {
                      color: "#427fe0",
                      label: "Monthly search volume · bars relative to top keyword",
                    },
                  ]}
                />
              </>
            }
            right={
              ai ? (
                <>
                  <StatMini label="AI Visibility, total citations" value={ai.totalCitations} />
                  <div className="mt-2 flex flex-col gap-2">
                    {ai.platforms.map((p) => (
                      <span
                        key={p.name}
                        className="inline-flex items-center justify-between gap-2 text-[12.5px] font-bold border border-border bg-white rounded-full px-3.5 py-1.5"
                        title={`${p.pages} distinct pages cited`}
                      >
                        {p.name}
                        <b className="font-mono text-[12px] text-navy">{p.citations}</b>
                      </span>
                    ))}
                  </div>
                </>
              ) : null
            }
          />
        )}
      </Card>
      </>),
        pagespeed: (<>
      <div className="mt-6 max-w-sm">
        <PsiKpi days={d.rangeDays} />
      </div>
      {/* Site performance — PSI (client-filled; never blocks hydration) */}
      <PsiDetail days={d.rangeDays} />

      </>),
      }} />
    </>
  );
}
