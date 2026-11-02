"use client";

interface ToolSearchProps {
  value: string;
  onChange: (value: string) => void;
}

/** Controlled search input with icon. */
export default function ToolSearch({ value, onChange }: ToolSearchProps) {
  return (
    <div className="relative flex-1 min-w-[240px]">
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tools by name, description, category or owner…"
        aria-label="Search tools"
        className="w-full h-[46px] rounded-[10px] border border-border bg-white pl-[42px] pr-3.5 text-[14.5px] text-foreground placeholder:text-muted focus:outline-none focus:border-blue focus:ring-[3px] focus:ring-fp-500/15"
      />
    </div>
  );
}
