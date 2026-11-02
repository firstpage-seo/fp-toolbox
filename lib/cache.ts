/** Process-local cache for the report's external API calls. */
export const CACHE_TTL_MS = 60 * 60 * 1000;
export const FAIL_TTL_MS = 60 * 1000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const entries = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = CACHE_TTL_MS,
  failureTtlMs = FAIL_TTL_MS
): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    if (hit.value instanceof Error) throw hit.value;
    return hit.value as T;
  }

  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const request = fn()
    .then((value) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((error: unknown) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      entries.set(key, { value: failure, expiresAt: Date.now() + failureTtlMs });
      throw failure;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
