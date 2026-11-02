import type { ReactNode } from "react";

interface SectionTitleProps {
  children: ReactNode;
  /** Optional item count shown next to the title. */
  count?: number;
  className?: string;
}

/** Section heading with an optional count, e.g. "SEO Research 6". */
export default function SectionTitle({ children, count, className = "" }: SectionTitleProps) {
  return (
    <div className={`flex items-baseline gap-2.5 ${className}`}>
      <h2 className="text-xl font-extrabold text-navy">{children}</h2>
      {count !== undefined ? (
        <span className="text-xs font-bold text-muted">{count}</span>
      ) : null}
    </div>
  );
}
