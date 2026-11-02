"use client";

import { useState } from "react";

/**
 * Cross-tool context passing. Read once at mount from window.location.search:
 * ?url= ?domain= ?keyword= ?site= ?property= ?client= etc. Tools seed their form
 * state from this (avoids useSearchParams' Suspense requirement).
 */
export function usePrefill(): Record<string, string> {
  const [params] = useState(() => {
    if (typeof window === "undefined") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(window.location.search)) {
      out[k] = v;
    }
    return out;
  });
  return params;
}

/** Build a cross-tool link: `/tools/<slug>?url=…&domain=…`, omitting empty params. */
export function prefillUrl(
  path: string,
  params: Record<string, string | undefined>
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, v);
  }
  const q = qs.toString();
  return q ? `${path}?${q}` : path;
}
