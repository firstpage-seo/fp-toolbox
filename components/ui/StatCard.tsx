type StatTone = "white" | "fp-800" | "fp-700" | "fp-600";

const TONE: Record<StatTone, string> = {
  white: "bg-white border border-border",
  "fp-800": "bg-fp-800",
  "fp-700": "bg-fp-700",
  "fp-600": "bg-fp-600",
};

const VALUE: Record<StatTone, string> = {
  white: "text-navy",
  "fp-800": "text-white",
  "fp-700": "text-white",
  "fp-600": "text-white",
};

const LABEL: Record<StatTone, string> = {
  white: "text-muted",
  "fp-800": "text-fp-100",
  "fp-700": "text-fp-100",
  "fp-600": "text-fp-100",
};

const SUB: Record<StatTone, string> = {
  white: "text-muted",
  "fp-800": "text-fp-200",
  "fp-700": "text-fp-200",
  "fp-600": "text-fp-200",
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  /** "white" for light panels (dashboard/admin), fp-* tones for emphasis (hero panels). */
  tone?: StatTone;
  /** "lg" for hero-scale numbers. */
  size?: "md" | "lg";
  icon?: string;
}

const PADDING: Record<NonNullable<StatCardProps["size"]>, string> = {
  md: "p-6",
  lg: "p-8",
};

const VALUE_SIZE: Record<NonNullable<StatCardProps["size"]>, string> = {
  md: "text-3xl",
  lg: "text-4xl",
};

/** KPI card: label + big value + optional sub/icon. Static class maps — no dynamic Tailwind. */
export default function StatCard({
  label,
  value,
  sub,
  tone = "white",
  size = "md",
  icon,
}: StatCardProps) {
  return (
    <div className={`rounded-[14px] ${PADDING[size]} shadow-[var(--shadow-sm)] ${TONE[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`text-xs font-extrabold uppercase tracking-[0.08em] ${LABEL[tone]}`}>
          {label}
        </div>
        {icon ? (
          <span className="text-lg" aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
      <div
        className={`mt-2 ${VALUE_SIZE[size]} font-extrabold tracking-[-0.02em] leading-none ${VALUE[tone]}`}
      >
        {value}
      </div>
      {sub ? <div className={`mt-2 text-xs ${SUB[tone]}`}>{sub}</div> : null}
    </div>
  );
}
