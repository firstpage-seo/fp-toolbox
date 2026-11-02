/**
 * OpenRouter Management API client — programmatic key management for the
 * team-key gateway (BYOK hybrid: OpenRouter enforces per-key limits,
 * fp-toolbox manages teams/champions/alerting).
 *
 * Docs: https://openrouter.ai/docs/guides/overview/auth/management-api-keys
 * All endpoints live under /api/v1/keys and require the Management API key
 * (https://openrouter.ai/settings/management-keys), NOT a regular API key.
 *
 * Security: the management key lives server-side only (env
 * OPENROUTER_MANAGEMENT_KEY). Issued sub-keys are returned to the caller once
 * (plaintext) and only its hash + label are persisted in Postgres.
 */
const BASE = "https://openrouter.ai/api/v1";

export interface OpenRouterKey {
  hash: string;
  label: string;
  name: string;
  disabled: boolean;
  limit: number | null;
  limitRemaining: number | null;
  limitReset: "daily" | "weekly" | "monthly" | null;
  includeByokInLimit: boolean;
  usage: number;
  usageMonthly: number;
  byokUsageMonthly: number;
  createdAt: string;
}

export class OpenRouterError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `OpenRouter API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

function managementKey(): string {
  const key = process.env.OPENROUTER_MANAGEMENT_KEY;
  if (!key) {
    throw new OpenRouterError(0, null, "OPENROUTER_MANAGEMENT_KEY not configured");
  }
  return key;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${managementKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 300);
  }
  if (!res.ok) {
    throw new OpenRouterError(res.status, body);
  }
  return body as T;
}

function normalizeKey(raw: Record<string, unknown>): OpenRouterKey {
  return {
    hash: String(raw.hash),
    label: raw.label === null ? "" : String(raw.label),
    name: String(raw.name ?? ""),
    disabled: Boolean(raw.disabled),
    limit: raw.limit === null || raw.limit === undefined ? null : Number(raw.limit),
    limitRemaining:
      raw.limit_remaining === null || raw.limit_remaining === undefined ? null : Number(raw.limit_remaining),
    limitReset: (raw.limit_reset as OpenRouterKey["limitReset"]) ?? null,
    includeByokInLimit: Boolean(raw.include_byok_in_limit),
    usage: Number(raw.usage ?? 0),
    usageMonthly: Number(raw.usage_monthly ?? 0),
    byokUsageMonthly: Number(raw.byok_usage_monthly ?? 0),
    createdAt: String(raw.created_at ?? ""),
  };
}

function unwrapData(body: { data?: unknown }): Record<string, unknown>[] {
  if (Array.isArray(body.data)) return body.data as Record<string, unknown>[];
  if (body.data && typeof body.data === "object") return [body.data as Record<string, unknown>];
  return [];
}

export interface CreatedKey {
  /** Plaintext sub-key — shown to the user exactly once, never stored. */
  key: string;
  keyRow: OpenRouterKey;
}

/**
 * Issue a sub-key with a monthly USD limit, counting BYOK spend (the account
 * spend routed through the user's BYOK key) against the limit.
 * POST first, then PATCH the BYOK-inclusion + monthly reset (documented PATCH params).
 */
export async function createKey(opts: { name: string; limitUsd: number }): Promise<CreatedKey> {
  const created = await api<{ data?: unknown; key?: unknown }>("/keys", {
    method: "POST",
    body: JSON.stringify({ name: opts.name, limit: opts.limitUsd }),
  });
  const rows = unwrapData(created);
  const raw = rows[0];
  if (!raw) {
    throw new OpenRouterError(200, created, "create key returned no data");
  }
  const keyRow = normalizeKey(raw);
  // Plaintext key lives at BODY level, sibling of data (verified by PoC):
  //   {"data":{...},"key":"sk-or-v1-..."}
  const plaintext =
    (created.key as string | undefined) ??
    (raw.key as string | undefined) ??
    (raw.api_key as string | undefined) ??
    (raw.encoded_key as string | undefined);
  if (!plaintext) {
    throw new OpenRouterError(200, created, "create key response missing plaintext key");
  }

  // Force the two safety-relevant settings regardless of API defaults.
  const patched = await api<{ data?: unknown }>(`/keys/${encodeURIComponent(keyRow.hash)}`, {
    method: "PATCH",
    body: JSON.stringify({ include_byok_in_limit: true, limit_reset: "monthly" }),
  });
  const patchedRow = unwrapData(patched)[0];
  return { key: plaintext, keyRow: patchedRow ? normalizeKey(patchedRow) : keyRow };
}

/** List all keys (paginated; internal scale is ~31 keys, so bounded). */
export async function listKeys(): Promise<OpenRouterKey[]> {
  const out: OpenRouterKey[] = [];
  let offset = 0;
  const PAGE = 100;
  for (let i = 0; i < 10; i++) {
    const body = await api<{ data?: unknown }>(`/keys?limit=${PAGE}&offset=${offset}`);
    const rows = unwrapData(body);
    if (rows.length === 0) break;
    out.push(...rows.map(normalizeKey));
    if (rows.length < PAGE) break;
    offset += rows.length;
  }
  return out;
}

export async function getKey(hash: string): Promise<OpenRouterKey | null> {
  const body = await api<{ data?: unknown }>(`/keys/${encodeURIComponent(hash)}`);
  const row = unwrapData(body)[0];
  return row ? normalizeKey(row) : null;
}

export async function updateKey(
  hash: string,
  patch: { disabled?: boolean; name?: string; limit?: number }
): Promise<OpenRouterKey> {
  const body = await api<{ data?: unknown }>(`/keys/${encodeURIComponent(hash)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const row = unwrapData(body)[0];
  if (!row) {
    throw new OpenRouterError(200, body, "update key returned no data");
  }
  return normalizeKey(row);
}

export async function deleteKey(hash: string): Promise<void> {
  await api<{ deleted?: boolean }>(`/keys/${encodeURIComponent(hash)}`, {
    method: "DELETE",
  });
}

// ---- analytics ---------------------------------------------------------------

export interface AnalyticsFilter {
  field: string;
  operator: string;
  value: unknown;
}

export interface AnalyticsQueryOpts {
  metrics: string[];
  dimensions?: string[];
  filters?: AnalyticsFilter[];
  granularity?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * POST /api/v1/analytics/query. Unwraps `data.data` (the row list).
 * NOTE: the filter key is `field`, NOT `dimension` (400 otherwise).
 */
export async function queryAnalytics(opts: AnalyticsQueryOpts): Promise<Record<string, unknown>[]> {
  const body = await api<{ data?: { data?: unknown } }>("/analytics/query", {
    method: "POST",
    body: JSON.stringify({
      metrics: opts.metrics,
      dimensions: opts.dimensions,
      filters: opts.filters,
      granularity: opts.granularity ?? "month",
      start_date: opts.startDate,
      end_date: opts.endDate,
    }),
  });
  if (Array.isArray(body.data?.data)) return body.data.data as Record<string, unknown>[];
  return [];
}

/**
 * Model pricing map (https://openrouter.ai/api/v1/models): model id →
 * per-1M-token USD input/output price. Tolerant: returns {} on any failure —
 * the savings estimate just becomes unavailable, never throws.
 */
export async function getModelPricing(): Promise<Record<string, { input: number; output: number }>> {
  try {
    const res = await fetch(`${BASE}/models`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${managementKey()}` },
    });
    if (!res.ok) return {};
    const body = (await res.json()) as { data?: unknown };
    const out: Record<string, { input: number; output: number }> = {};
    if (Array.isArray(body.data)) {
      for (const raw of body.data as Record<string, unknown>[]) {
        const id = String(raw.id ?? "");
        if (!id) continue;
        // API prices are per token (e.g. 6.5e-8) — store per-1M for the
        // savings math: tokens/1e6 × pricePerM.
        const p = raw.pricing as { prompt?: unknown; completion?: unknown } | undefined;
        const input = Number(p?.prompt) * 1e6;
        const output = Number(p?.completion) * 1e6;
        if (Number.isFinite(input) && Number.isFinite(output)) {
          out[id] = { input, output };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}
