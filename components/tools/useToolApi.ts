"use client";

import { useCallback, useState } from "react";

/**
 * Client hook for tool API routes: POST /api/tools/<slug> with a JSON body,
 * tracking loading/error/data. Data-tool routes respond {data, durationMs};
 * LLM-tool routes respond with their output shape + outputId/meta. A non-ok
 * response (or a thrown fetch) surfaces json.error as `error` and returns null.
 */
export function useToolApi<T = unknown>(toolSlug: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (body: Record<string, unknown>): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tools/${toolSlug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as T & { error?: string };
        if (!res.ok) {
          setError(json.error || "Request failed");
          return null;
        }
        setData(json);
        return json;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toolSlug]
  );

  return { data, error, loading, run, setData, setError };
}
