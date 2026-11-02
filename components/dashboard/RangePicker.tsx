import Link from "next/link";

const RANGES = [7, 30, 90] as const;

interface RangePickerProps {
  days: number;
}

/**
 * Dashboard time-range switcher (7/30/90 days) — server component: plain Links
 * against `?days=N` search params, no client state.
 */
export default function RangePicker({ days }: RangePickerProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[10px] bg-white/14 border border-white/22 p-1">
      {RANGES.map((r) => {
        const isActive = days === r;
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
  );
}
