/**
 * Loading skeletons for the `/` dashboard — shown inside each section's
 * Suspense fallback so the page shell renders instantly and zones fill in as
 * their data arrives. Pure presentational gray blocks (Tailwind `animate-pulse`),
 * shaped like the real layout to avoid layout shift.
 */

interface ZoneSkeletonProps {
  title: string;
  /** Tag pill text next to the title; omitted when empty (Lead Quality has none). */
  tag?: string;
  /** Render the "Last 30 days" takeaways box (Website/Sales have it, Lead Quality doesn't). */
  takeaways?: boolean;
  /** Number of large content cards below the KPI row. */
  cards?: number;
}

/**
 * Whole-zone skeleton: zone head + 4 KPI cards + big content cards.
 * Renders zone CONTENT only — the owning `<section id=…>` anchor lives on the
 * page outside the Suspense boundary, so the sticky SectionNav keeps working
 * while the zone streams in.
 */
export function ZoneSkeleton({ title, tag, takeaways = true, cards = 3 }: ZoneSkeletonProps) {
  return (
    <div>
      {/* Zone head */}
      <div className="pt-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="w-1 h-[24px] rounded-[2px] bg-border" aria-hidden />
            <div className="h-7 w-56 max-w-[60vw] rounded-md bg-surface animate-pulse" aria-hidden />
            <span className="sr-only">{title}</span>
            {tag ? (
              <div className="h-6 w-28 rounded-full bg-surface animate-pulse" />
            ) : null}
          </div>
          <div className="hidden sm:block h-9 w-32 rounded-[10px] bg-surface animate-pulse" />
        </div>
        {takeaways ? (
          <div className="mt-5 rounded-[14px] border border-border bg-white p-4 shadow-[var(--shadow-sm)]">
            <div className="h-3 w-24 rounded bg-surface animate-pulse" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-3/4 rounded bg-surface animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-surface animate-pulse" />
            </div>
          </div>
        ) : null}
      </div>

      {/* KPI row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[14px] border border-border bg-white p-[18px] shadow-[var(--shadow-sm)]"
          >
            <div className="h-3 w-20 rounded bg-surface animate-pulse" />
            <div className="mt-2.5 h-8 w-24 rounded bg-surface animate-pulse" />
            <div className="mt-2 h-3 w-28 rounded bg-surface animate-pulse" />
            <div className="mt-3 h-[26px] rounded bg-surface/60 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Big content cards */}
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="mt-8 rounded-[14px] border border-border bg-white p-6 shadow-[var(--shadow-sm)]"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-surface animate-pulse" />
            <div className="h-3 w-24 rounded bg-surface/60 animate-pulse" />
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="h-40 rounded-lg bg-surface/50 animate-pulse" />
            <div className="h-40 rounded-lg bg-surface/50 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small skeleton for the AI Suggested Action Plan card (secondary suspense inside each zone). */
export function AiPlanSkeleton() {
  return (
    <div className="mt-4 rounded-[14px] border border-border bg-white shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-surface/60">
        <div className="h-4 w-4 rounded-full bg-border animate-pulse" />
        <div className="h-4 w-52 rounded bg-border animate-pulse" />
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-surface animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-surface animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-surface animate-pulse" />
      </div>
    </div>
  );
}
