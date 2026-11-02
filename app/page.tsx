import { Suspense } from "react";
import { getWebsiteData, dashboardDateRange, latestFinalizedGscDate } from "@/lib/dashboard";
import type { WebsiteData } from "@/lib/dashboard";
import RangePicker from "@/components/dashboard/RangePicker";
import { OrganicTrafficSection } from "@/components/dashboard/WebsiteSection";
import { ZoneSkeleton } from "@/components/dashboard/DashboardSkeleton";

// Date ranges and external API calls depend on the current request.
export const dynamic = "force-dynamic";

/** 7/30/90 range from `?days=`; anything else (or missing) falls back to 30. */
function parseDays(raw: string | undefined): number {
  const n = Number(raw);
  return n === 7 || n === 90 ? n : 30;
}

/** Organic analytics use the same website request without waiting for uptime. */
async function OrganicZone({ webP, finalizedDate }: { webP: Promise<WebsiteData>; finalizedDate: string }) {
  return <OrganicTrafficSection d={await webP} finalizedDate={finalizedDate} />;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const days = parseDays(sp.days);
  const finalizedEnd = await latestFinalizedGscDate();
  const presetStart = new Date(Date.parse(`${finalizedEnd}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const range = sp.start && sp.end
    ? dashboardDateRange(days, sp.start, sp.end)
    : dashboardDateRange(days, presetStart, finalizedEnd);
  const custom = Boolean(sp.start && sp.end && range.startDate === sp.start && range.endDate === sp.end);
  const webP = getWebsiteData(range.days, range);

  return (
    <>
      {/* Page head — design-ref dashboard.html .pagehead */}
      <div className="bg-grad-banner text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[34px] pb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-white text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.015em]">
              FirstPage HK Organic Performance
            </h1>
            <p className="mt-1 text-[14px] text-[oklch(0.93_0.02_250)]">
              Organic traffic Analysis
            </p>
          </div>
          <RangePicker days={days} range={range} custom={custom} maxDate={finalizedEnd} />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <section id="organic-traffic" className="scroll-mt-40 mt-12">
          <Suspense fallback={<ZoneSkeleton title="Organic Traffic Performance" tag="firstpage.hk" takeaways={false} cards={4} />}>
            <OrganicZone webP={webP} finalizedDate={finalizedEnd} />
          </Suspense>
        </section>

        <p className="mt-10 pb-4 text-sm text-muted">
          Data refreshes hourly. Sources: firstpage MCP (GA4/GSC/PSI), Ahrefs.
        </p>
      </main>
    </>
  );
}
