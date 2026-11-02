import type { ReactNode } from "react";
import InsightList from "./InsightList";
import type { Insight } from "@/lib/insights";

interface SectionHeaderProps {
  /** Anchor id the sticky nav jumps to (#website / #sales / #lead-quality). */
  id: string;
  /** Accent color scheme for the section. */
  accent: "website" | "sales";
  title: string;
  /** Tag pill next to the title, e.g. "firstpage.hk" / "HubSpot". */
  tag: string;
  insights: Insight[];
  /** Extra content on the header right (e.g. uptime status pills). */
  right?: ReactNode;
}

const ACCENT_BAR: Record<SectionHeaderProps["accent"], string> = {
  website: "bg-fp-500",
  sales: "bg-[oklch(0.55_0.14_152)]",
};

/** Section header (design-ref .zonehead + .takeaways): accent bar + title + tag pill + takeaways box. */
export default function SectionHeader({
  id,
  accent,
  title,
  tag,
  insights,
  right,
}: SectionHeaderProps) {
  return (
    <div id={id} className="scroll-mt-40 pt-9">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className={`w-1 h-[24px] rounded-[2px] ${ACCENT_BAR[accent]}`} aria-hidden />
          <h2 className="text-2xl font-extrabold text-navy">{title}</h2>
          <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted border border-border bg-white px-2.5 py-1 rounded-full">
            {tag}
          </span>
        </div>
        {right ?? null}
      </div>
      <div className="mt-5 rounded-[14px] border border-border bg-white p-4 shadow-[var(--shadow-sm)]">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">
          Last 30 days
        </span>
        <div className="mt-2">
          <InsightList insights={insights} />
        </div>
      </div>
    </div>
  );
}
