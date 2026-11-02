"use client";

interface CategoryFilterProps {
  /** Ordered category labels to render (All is prepended automatically). */
  categories: string[];
  /** Active category, or null for All. */
  active: string | null;
  onChange: (category: string | null) => void;
}

/** Horizontal category chips: All + one per category, single-select. */
export default function CategoryFilter({
  categories,
  active,
  onChange,
}: CategoryFilterProps) {
  const chip = (label: string, selected: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full px-4 py-2 text-[13px] font-bold min-h-[42px] transition-all cursor-pointer ${
        selected
          ? "bg-navy border border-navy text-white"
          : "border border-border bg-white text-muted hover:border-blue hover:text-fp-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      {chip("All", active === null, () => onChange(null))}
      {categories.map((c) => chip(c, active === c, () => onChange(c)))}
    </div>
  );
}
