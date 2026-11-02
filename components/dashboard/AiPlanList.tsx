import type { AiPlan } from "@/lib/ai-plans";

interface AiPlanListProps {
  plans: AiPlan[] | null | undefined;
}

const IMPACT_STYLES: Record<AiPlan["impact"], string> = {
  high: "bg-[oklch(0.55_0.14_152_/_0.14)] text-[oklch(0.42_0.13_152)]",
  medium: "bg-[oklch(0.72_0.15_75_/_0.18)] text-[oklch(0.5_0.13_75)]",
  low: "bg-slate-100 text-slate-600",
};

/** AI-suggested actionable plans for one dashboard section. Renders nothing when unavailable. */
export default function AiPlanList({ plans }: AiPlanListProps) {
  if (!plans || plans.length === 0) return null;
  return (
    <div className="mt-4 rounded-[14px] border border-border bg-white shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-surface/60">
        <span aria-hidden>✨</span>
        <p className="text-[15px] font-extrabold text-navy">AI Suggested Action Plan</p>
        <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.06em] text-fp-600 bg-fp-500/10 px-2.5 py-1 rounded-full">
          7d plan
        </span>
      </div>
      <ol>
        {plans.map((plan, idx) => (
          <li key={idx} className="flex items-start gap-3.5 px-5 py-4 border-b border-border last:border-0">
            <span className="w-[26px] shrink-0 font-extrabold text-[13px] text-fp-600 tabular-nums">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] text-foreground">
                <b className="text-navy">{plan.action}</b>
              </p>
              <p className="mt-0.5 text-[13px] text-muted">{plan.why}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-[0.07em] ${IMPACT_STYLES[plan.impact]}`}
            >
              {plan.impact}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
