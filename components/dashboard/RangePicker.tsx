import Link from "next/link";
import type { DashboardDateRange } from "@/lib/dashboard";

const RANGES = [7, 30, 90] as const;

interface RangePickerProps {
  days: number;
  range: DashboardDateRange;
  custom: boolean;
  maxDate: string;
}

/**
 * Dashboard time-range switcher (7/30/90 days) — server component: plain Links
 * against `?days=N` search params, no client state.
 */
export default function RangePicker({ days, range, custom, maxDate }: RangePickerProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
    <div className="inline-flex items-center gap-0.5 rounded-[10px] bg-white/14 border border-white/22 p-1">
      {RANGES.map((r) => {
        const isActive = !custom && days === r;
        return (
          <Link
            key={r}
            href={`/?days=${r}`}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-[7px] px-4 py-2 text-[13px] font-bold min-h-[38px] transition-colors ${
              isActive
                ? "bg-white text-navy"
                : "text-[oklch(0.93_0.02_250)] hover:bg-white/10"
            }`}
          >
            {r}d
          </Link>
        );
      })}
    </div>
    <form action="/" method="get" className="flex flex-wrap items-end gap-2 rounded-[10px] border border-white/22 bg-white/14 p-1.5">
      <label className="flex flex-col gap-1 text-xs font-semibold text-white/90">
        Start date
        <input type="date" name="start" required max={maxDate} defaultValue={range.startDate} className="min-h-9 rounded-md border border-white/30 bg-white px-2 text-sm text-navy" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-white/90">
        End date
        <input type="date" name="end" required max={maxDate} defaultValue={range.endDate} className="min-h-9 rounded-md border border-white/30 bg-white px-2 text-sm text-navy" />
      </label>
      <button type="submit" className={`min-h-9 rounded-md px-4 text-sm font-bold transition-colors ${custom ? "bg-white text-navy" : "bg-white/20 text-white hover:bg-white/30"}`}>
        Custom range
      </button>
    </form>
    </div>
  );
}
