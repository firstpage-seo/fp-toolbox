import type { Insight } from "@/lib/insights";

interface InsightListProps {
  insights: Insight[];
  empty?: string;
}

const TONE_STYLES: Record<Insight["tone"], { text: string; dot: string }> = {
  good: { text: "text-[oklch(0.42_0.13_152)]", dot: "bg-[oklch(0.55_0.14_152)]" },
  bad: { text: "text-[oklch(0.62_0.20_22)]", dot: "bg-[oklch(0.62_0.20_22)]" },
  neutral: { text: "text-muted", dot: "bg-muted" },
};

/** Rule-driven headline takeaways for a section. Pure presentational. */
export default function InsightList({
  insights,
  empty = "No standout signals this window.",
}: InsightListProps) {
  if (insights.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {insights.map((insight, idx) => {
        const tone = TONE_STYLES[insight.tone];
        return (
          <li key={idx} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`}
              aria-hidden
            />
            <span className={tone.text}>{insight.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
