"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "website", label: "Website Performance" },
  { id: "organic-traffic", label: "Organic Traffic Performance" },
  { id: "sales", label: "Sales Performance" },
  { id: "lead-quality", label: "Lead Quality" },
] as const;

/**
 * Sticky in-page section nav for the two dashboard halves. Scrollspy via
 * IntersectionObserver: the section crossing the middle band becomes active.
 * Mobile: horizontally scrollable pills.
 */
export default function SectionNav({ view, days }: { view: "overview" | "organic"; days: number }) {
  const [active, setActive] = useState<string>(view === "organic" ? "organic-traffic" : "website");

  useEffect(() => {
    if (view === "organic") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      // Band across the middle of the viewport: a section is "current" while
      // it covers the band. Works with the sticky nav + header offsets.
      { rootMargin: "-35% 0px -50% 0px", threshold: 0 }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [view]);

  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-16 z-40 border-b border-border bg-white/96 backdrop-blur"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1.5 overflow-x-auto py-2.5">
          {SECTIONS.filter((s) => view !== "organic" || s.id === "website" || s.id === "organic-traffic").map((s) => {
            const isActive = view === "organic" ? s.id === "organic-traffic" : active === s.id;
            return (
              <a
                key={s.id}
                href={s.id === "organic-traffic" ? `/?view=organic&days=${days}` : s.id === "website" ? `/?days=${days}` : `#${s.id}`}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-bold transition-colors ${
                  isActive
                    ? "bg-navy text-white shadow-sm"
                    : "bg-surface text-muted hover:bg-border"
                }`}
              >
                {s.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
