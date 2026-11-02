import type { ReactNode } from "react";

/**
 * Stroke-SVG icon paths keyed by tool name — ported from docs/design-ref/toolbox.html
 * (and tools.html). 24x24 viewBox, stroke=currentColor, stroke-width 1.7-1.8.
 * Replaces the emoji tiles of the old design.
 */
const ICON_PATHS: Record<string, string> = {
  "AI Visibility Scanner": '<path d="M12 2l2.4 6.2L21 9l-5 4.4L17.5 20 12 16.4 6.5 20 8 13.4 3 9l6.6-.8z"/>',
  "Competitor Profiler": '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/><path d="M12 2v20"/>',
  "Content Brief Generator": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h2"/>',
  "Core Web Vitals Batch": '<path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18H5a2 2 0 0 1-2-2v-4m18 0v4a2 2 0 0 1-2 2h-4M3 12h18"/>',
  "GA4 Traffic Snapshot": '<path d="M3 3v18h18"/><path d="M7 15l4-6 4 3 5-8"/>',
  "GSC Query Explorer": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v3l2 2"/>',
  "Keyword Gap Analyzer": '<circle cx="8" cy="8" r="5"/><circle cx="16" cy="16" r="5"/><path d="M10.5 10.5l3 3M13.5 10.5l-3 3"/>',
  "Lead Scorer": '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>',
  "Meeting Prep Brief": '<path d="M9 2h6a1 1 0 0 1 1 1v3H8V3a1 1 0 0 1 1-1z"/><path d="M4 6h16a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1z"/><path d="M12 11v4M10 13h4"/>',
  "Meta Tag Generator": '<path d="M8 12h8M8 8h5M8 16h3"/><rect x="3" y="4" width="18" height="16" rx="2"/>',
  "Mobile vs Desktop PSI": '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  "Monthly SEO Report": '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4M8 15h2M12 15h2M16 15h2M8 18h2M12 18h2"/>',
  "Pipeline Pulse": '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  "Pitch Deck Generator": '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/><path d="M7 11l3-3 2 2 3-4"/>',
  "Proposal Generator": '<path d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  "PageSpeed Auditor": '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>',
  "Schema Markup Generator": '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 5v2M15 5v2M9 17v2M15 17v2M5 9h2M5 15h2M17 9h2M17 15h2"/>',
  "SEO ROI Estimator": '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/><path d="M15 7h4v4"/>',
  "SERP Landscape": '<path d="M3 12h4l2-7 4 14 2-7h4"/>',
  "Lead Spam Report": '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>',
  "Tool Usage Stats": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  "URL Inspector": '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16"/>',
  "FAQ Schema Generator": '<path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.7v.5"/><circle cx="12" cy="18" r=".5"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
  "Onsite SEO Audit": '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18"/><path d="M12 7a5 5 0 0 1 0 10"/>',
  /* app-only tools (not in the design-ref map) */
  "Page Screenshot": '<path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  "Render Diff Checker": '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/><path d="M7 9h0M7 13h0M17 9h0M17 13h0"/>',
};

const FALLBACK_ICON =
  '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>';

/** Inner SVG markup (paths) for a tool's icon. */
export function toolIconMarkup(name: string): string {
  return ICON_PATHS[name] ?? FALLBACK_ICON;
}

/** Renders a tool's stroke icon, inheriting currentColor (e.g. category color). */
export function ToolIcon({
  name,
  className = "w-[22px] h-[22px]",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      // Static constant map — no user input reaches this.
      dangerouslySetInnerHTML={{ __html: toolIconMarkup(name) }}
    />
  );
}

/* ---------- category color helpers (design-ref category palette) ---------- */

const CATEGORY_COLOR_CLASS: Record<string, string> = {
  Sales: "text-[oklch(0.69_0.2_24)]",
  "SEO Research": "text-[oklch(0.62_0.16_250)]",
  "SEO Technical": "text-[oklch(0.44_0.12_256)]",
  Content: "text-[oklch(0.72_0.15_75)]",
  "SEO Content": "text-[oklch(0.72_0.15_75)]",
  Operations: "text-[oklch(0.55_0.14_152)]",
};

const CATEGORY_BG_CLASS: Record<string, string> = {
  Sales: "bg-[oklch(0.69_0.2_24_/_0.10)]",
  "SEO Research": "bg-[oklch(0.62_0.16_250_/_0.10)]",
  "SEO Technical": "bg-[oklch(0.44_0.12_256_/_0.10)]",
  Content: "bg-[oklch(0.72_0.15_75_/_0.14)]",
  "SEO Content": "bg-[oklch(0.72_0.15_75_/_0.14)]",
  Operations: "bg-[oklch(0.55_0.14_152_/_0.12)]",
};

const CATEGORY_BAR_CLASS: Record<string, string> = {
  Sales: "bg-[oklch(0.69_0.2_24)]",
  "SEO Research": "bg-[oklch(0.62_0.16_250)]",
  "SEO Technical": "bg-[oklch(0.44_0.12_256)]",
  Content: "bg-[oklch(0.72_0.15_75)]",
  "SEO Content": "bg-[oklch(0.72_0.15_75)]",
  Operations: "bg-[oklch(0.55_0.14_152)]",
};

const DEFAULT_COLOR = "text-fp-600";
const DEFAULT_BG = "bg-fp-500/10";
const DEFAULT_BAR = "bg-fp-500";

export function categoryColorClass(category: string): string {
  return CATEGORY_COLOR_CLASS[category] ?? DEFAULT_COLOR;
}

export function categoryBgClass(category: string): string {
  return CATEGORY_BG_CLASS[category] ?? DEFAULT_BG;
}

export function categoryBarClass(category: string): string {
  return CATEGORY_BAR_CLASS[category] ?? DEFAULT_BAR;
}

/** Raw OKLCH color string for inline styles (e.g. icon stroke in the tool page head). */
export function categoryColorValue(category: string): string {
  return (
    {
      Sales: "oklch(0.69 0.2 24)",
      "SEO Research": "oklch(0.62 0.16 250)",
      "SEO Technical": "oklch(0.44 0.12 256)",
      Content: "oklch(0.72 0.15 75)",
      "SEO Content": "oklch(0.72 0.15 75)",
      Operations: "oklch(0.55 0.14 152)",
    }[category] ?? "oklch(0.5 0.14 254)"
  );
}

/** Tool workspace page head: blue-gradient banner with category-colored icon tile + meta chips. */
export function ToolPageHeader({ tool }: { tool: { name: string; description: string; category: string; owner: string } }) {
  const tile: ReactNode = (
    <span
      className="w-[52px] h-[52px] rounded-[13px] bg-white/14 border border-white/25 grid place-items-center"
      style={{ color: categoryColorValue(tool.category) }}
    >
      <ToolIcon name={tool.name} className="w-[26px] h-[26px]" />
    </span>
  );
  return (
    <div className="bg-grad-banner text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-wrap items-center gap-5">
        {tile}
        <div className="min-w-0 flex-1">
          <h1 className="text-white text-[clamp(22px,2.8vw,30px)] font-extrabold tracking-[-0.015em]">
            {tool.name}
          </h1>
          <p className="mt-1 text-[13.5px] text-[oklch(0.93_0.02_250)] max-w-[62ch]">
            {tool.description}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="rounded-full bg-white/14 border border-white/22 px-3 py-1.5 text-[11.5px] font-bold text-white">
            {tool.category}
          </span>
          <span className="rounded-full bg-white/14 border border-white/22 px-3 py-1.5 text-[11.5px] font-bold text-white">
            {tool.owner}
          </span>
        </div>
      </div>
    </div>
  );
}
