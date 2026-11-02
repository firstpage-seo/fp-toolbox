import Link from "next/link";
import { Suspense } from "react";
import { getWebsiteData, getSalesData, getClientsInventory } from "@/lib/dashboard";
import type { WebsiteData, SalesData } from "@/lib/dashboard";
import { getUptimeStats } from "@/lib/uptime";
import { buildWebsiteInsights, buildSalesInsights } from "@/lib/insights";
import RangePicker from "@/components/dashboard/RangePicker";
import SectionNav from "@/components/dashboard/SectionNav";
import WebsiteSection from "@/components/dashboard/WebsiteSection";
import SalesSection from "@/components/dashboard/SalesSection";
import LeadQualitySection from "@/components/dashboard/LeadQualitySection";
import { ZoneSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { getSpamReport } from "@/lib/hubspot";
import type { SpamReport } from "@/lib/hubspot";
import { cached } from "@/lib/cache";

// ponytail: render on every request — the uptime panel must reflect the 5-min
// checker live, and external API calls are all memoized for 1h anyway.
export const dynamic = "force-dynamic";

/** 7/30/90 range from `?days=`; anything else (or missing) falls back to 30. */
function parseDays(raw: string | undefined): number {
  const n = Number(raw);
  return n === 7 || n === 90 ? n : 30;
}

/** Pagehead portfolio line — independent fetch, streams in after the banner. */
async function ClientsCount() {
  const { configured, inventory } = await getClientsInventory();
  if (!configured || !inventory) return null;
  return (
    <p className="mt-[3px] text-[12.5px] text-[oklch(0.93_0.02_250)] opacity-85">
      {inventory.gscSites} GSC sites · {inventory.ga4Properties} GA4 properties under management
    </p>
  );
}

/** Website zone: waits only on its own data, then streams in independently.
 * PSI + AI plans are client-filled panels inside WebsiteSection — they never
 * block this zone or the page hydration. */
async function WebsiteZone({ webP }: { webP: Promise<WebsiteData> }) {
  const web = await webP;
  const uptime = await getUptimeStats(web.targets.url);
  const insights = buildWebsiteInsights(web);
  return <WebsiteSection d={web} uptime={uptime} insights={insights} />;
}

/** Sales zone: waits only on its own data, then streams in independently. */
async function SalesZone({ salesP }: { salesP: Promise<SalesData> }) {
  const sales = await salesP;
  const insights = buildSalesInsights(sales);
  return <SalesSection d={sales} insights={insights} />;
}

/** Empty report shape for the tolerant fallback — never rendered when `error` is set. */
const EMPTY_SPAM_REPORT: SpamReport = {
  total: 0,
  good: 0,
  spam: 0,
  spamRatePct: 0,
  categories: [],
  topSources: [],
};

/** Lead Quality zone — same memoized 10-min source as /admin, keyed by the
 * selected range. Tolerant: a HubSpot 429 (rate limit) degrades to an inline
 * error instead of crashing. */
async function LeadQualityZone({ days }: { days: number }) {
  let report: SpamReport | null = null;
  let error: string | null = null;
  try {
    report = await cached(`spam-report-overview:${days}`, () => getSpamReport(days), 10 * 60 * 1000);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return <LeadQualitySection report={report ?? EMPTY_SPAM_REPORT} days={days} error={error} />;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = parseDays(sp.days);

  // Kick off both zones' fetches NOW (not awaited here) so they run in
  // parallel while the shell streams. PSI + AI plans are served by the
  // /api/dashboard/panels endpoint and filled client-side after hydration —
  // they never hold up the document.
  const webP = getWebsiteData(days);
  const salesP = getSalesData(days);

  return (
    <>
      {/* Page head — design-ref dashboard.html .pagehead */}
      <div className="bg-grad-banner text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[34px] pb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-white text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.015em]">
              FirstPage Division Dashboard
            </h1>
            <p className="mt-1 text-[14px] text-[oklch(0.93_0.02_250)]">
              Website &amp; sales performance, refreshed hourly
            </p>
            <Suspense
              fallback={
                <p className="mt-[3px] text-[12.5px] text-[oklch(0.93_0.02_250)] opacity-60">
                  Loading portfolio…
                </p>
              }
            >
              <ClientsCount />
            </Suspense>
          </div>
          <RangePicker days={days} />
        </div>
      </div>

      <SectionNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Anchors live OUTSIDE the Suspense boundaries so SectionNav's
            scrollspy keeps observing stable nodes while zones stream in. */}
        <section id="website" className="scroll-mt-40">
          <Suspense
            fallback={
              <>
                <p className="pt-4 text-[13px] text-muted" role="status">
                  Loading the {days}-day dashboard…
                </p>
                <ZoneSkeleton title="Website Performance" tag="firstpage.hk" />
              </>
            }
          >
            <WebsiteZone webP={webP} />
          </Suspense>
        </section>
        <div className="mt-12" aria-hidden>
          <section id="sales" className="scroll-mt-40">
            <Suspense fallback={<ZoneSkeleton title="Sales Performance" tag="HubSpot" />}>
              <SalesZone salesP={salesP} />
            </Suspense>
          </section>
        </div>

        <section id="lead-quality" className="scroll-mt-40 pt-9">
          <Suspense
            fallback={<ZoneSkeleton title="Lead Quality" takeaways={false} cards={2} />}
          >
            <LeadQualityZone days={days} />
          </Suspense>
        </section>

        <p className="mt-10 pb-4 text-sm text-muted">
          Data refreshes hourly. Sources: HubSpot, firstpage MCP (GA4/GSC/PSI), Ahrefs.{" "}
          <Link href="/toolbox" className="font-bold text-fp-600">
            Open the toolbox →
          </Link>
        </p>
      </main>
    </>
  );
}
