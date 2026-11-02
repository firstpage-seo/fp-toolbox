import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Small pill next to the title, e.g. "22 tools". */
  count?: string;
  /** Extra content on the right (e.g. actions, links). */
  trailing?: ReactNode;
}

/** Shared page header: blue-gradient banner with white title + count pill + right-side content. */
export default function PageHeader({
  title,
  description,
  count,
  trailing,
}: PageHeaderProps) {
  return (
    <div className="bg-grad-banner text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[34px] pb-10 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-white text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.015em]">
              {title}
            </h1>
            {count ? (
              <span className="rounded-full bg-white/14 border border-white/22 px-4 py-1.5 text-sm font-bold text-white">
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 text-[14px] text-[oklch(0.93_0.02_250)] max-w-[60ch]">
              {description}
            </p>
          ) : null}
        </div>
        {trailing ?? null}
      </div>
    </div>
  );
}
