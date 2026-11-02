"use client";

import { useEffect, useState } from "react";
import type { WebsitePsi } from "@/lib/dashboard";

export interface DashboardPanels {
  psi: WebsitePsi;
}

// Share one in-flight PageSpeed request across both visible cards.
const inflightPsi = new Map<number, Promise<DashboardPanels>>();

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
