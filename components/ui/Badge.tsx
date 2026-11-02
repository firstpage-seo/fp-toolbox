import type { ReactNode } from "react";

type BadgeColor = "fp" | "slate" | "emerald" | "blue" | "amber" | "rose" | "violet";

const COLOR: Record<BadgeColor, string> = {
  fp: "bg-fp-100 text-fp-700",
  slate: "bg-slate-100 text-slate-600",
  emerald: "bg-[oklch(0.55_0.14_152_/_0.13)] text-[oklch(0.42_0.13_152)]",
  blue: "bg-fp-100 text-fp-700",
  amber: "bg-[oklch(0.72_0.15_75_/_0.18)] text-[oklch(0.5_0.13_75)]",
  rose: "bg-[oklch(0.62_0.20_22_/_0.1)] text-[oklch(0.62_0.20_22)]",
  violet: "bg-violet-100 text-violet-700",
};

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  className?: string;
}

/** Small rounded status/category pill. Static class map — no dynamic Tailwind classes. */
export default function Badge({ children, color = "slate", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR[color]} ${className}`}
    >
      {children}
    </span>
  );
}
