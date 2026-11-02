"use client";

import { useEffect, useState } from "react";
import type { WebsitePsi } from "@/lib/dashboard";
import type { AiPlans } from "@/lib/ai-plans";

export interface DashboardPanels {
  psi: WebsitePsi;
}

export interface DashboardPlans {
  plans: AiPlans | null;
}

// PSI and AI plans are separate endpoints: psi_audit is 6h-memoized and
// answers in ms, while a fresh plans generation takes up to ~90s — a shared
// request would stall the PSI card behind the LLM. Each endpoint has its own
// in-flight fetch, shared by every card on the page (one request per window).

const inflightPsi = new Map<number, Promise<DashboardPanels>>();
const inflightPlans = new Map<number, Promise<DashboardPlans>>();

function fetchPanels(days: number): Promise<DashboardPanels> {
  const existing = inflightPsi.get(days);
  if (existing) return existing;
  const p = fetch(`/api/dashboard/panels?days=${days}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: DashboardPanels | null) => {
      if (!d) throw new Error("dashboard panels unavailable");
      return d;
    })
    .finally(() => inflightPsi.delete(days));
  inflightPsi.set(days, p);
  return p;
}

function fetchPlans(days: number): Promise<DashboardPlans> {
  const existing = inflightPlans.get(days);
  if (existing) return existing;
  const p = fetch(`/api/dashboard/plans?days=${days}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: DashboardPlans | null) => {
      if (!d) throw new Error("dashboard plans unavailable");
      return d;
    })
    .finally(() => inflightPlans.delete(days));
  inflightPlans.set(days, p);
  return p;
}

function useFetchedData<T>(days: number, fetcher: (days: number) => Promise<T>): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetcher(days)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        // Leave the skeleton — a transient 401/network blip shouldn't flash errors.
      });
    return () => {
      cancelled = true;
    };
  }, [days, fetcher]);
  return data;
}

/**
 * Shared client state for the PSI panels. The page shell renders a skeleton
 * immediately (no server suspense → hydration isn't blocked), and this fills
 * in as soon as the server memoized value arrives.
 */
export function usePanels(days: number): DashboardPanels | null {
  return useFetchedData(days, fetchPanels);
}

/** AI-plan cards — same pattern as usePanels, against /api/dashboard/plans. */
export function usePlans(days: number): DashboardPlans | null {
  return useFetchedData(days, fetchPlans);
}
