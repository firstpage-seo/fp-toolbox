"use client";

import { AiPlanSkeleton } from "./DashboardSkeleton";
import AiPlanList from "./AiPlanList";
import type { AiPlans } from "@/lib/ai-plans";
import { usePlans } from "./panels-client";

/**
 * AI Suggested Action Plan panel — client-filled after the shell hydrates, so
 * the (up-to-90s, memoized + last-good-fallback) LLM call never pins the
 * page's document/hydration; skeleton shows while /api/dashboard/plans runs.
 */
export default function AiPlansPanel({ days, zone }: { days: number; zone: "website" | "sales" }) {
  const data = usePlans(days);
  if (data === null) return <AiPlanSkeleton />;
  const plans: AiPlans | null = data?.plans ?? null;
  if (!plans) return null;
  return <AiPlanList plans={zone === "website" ? plans.website : plans.sales} />;
}