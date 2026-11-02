import { pool } from "./db";

// Process-level TTL cache for external API calls, backed by Postgres so the
// cache survives dev-server restarts / HMR (which reset module state) and is
// shared across instances. Without the DB layer every restart re-hits every
// external API at once — the fastest way to burn rate limits.
// Next's unstable_cache doesn't memoize in dev mode, so the in-memory Map still
// short-circuits the hot path.
export const CACHE_TTL_MS = 60 * 60 * 1000;
/** Failed calls are memoized briefly so a refresh storm can't re-hit a rate-limited API. */
export const FAIL_TTL_MS = 60 * 1000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const memCache = new Map<string, CacheEntry>();

let cacheTableReady: Promise<void> | null = null;
function ensureCacheTable(): Promise<void> {
  if (!cacheTableReady) {
    cacheTableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS cache_store (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        )`
      )
      .then(() => undefined)
      .catch((err) => {
        // DB down — reset so the next call retries, degrade to memory-only.
        cacheTableReady = null;
        throw err;
      });
  }
  return cacheTableReady;
}

const isErrorEntry = (v: unknown): v is { __error: string } =>
  typeof v === "object" && v !== null && "__error" in v;

async function readDb(key: string): Promise<CacheEntry | null> {
  await ensureCacheTable();
  const { rows } = await pool.query(
    `SELECT value, expires_at AS "expiresAt" FROM cache_store WHERE key = $1`,
    [key]
  );
  if (rows.length === 0) return null;
  const expiresAt = new Date(rows[0].expiresAt).getTime();
  if (expiresAt <= Date.now()) return null;
  return { value: rows[0].value, expiresAt };
}

async function writeDb(key: string, value: unknown, expiresAt: number): Promise<void> {
  await ensureCacheTable();
  await pool.query(
    `INSERT INTO cache_store (key, value, expires_at) VALUES ($1, $2::jsonb, to_timestamp($3 / 1000.0))
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
    [key, JSON.stringify(value), expiresAt]
  );
}

/**
 * Memoized call with TTL. Reads in-memory first, then Postgres (survives
 * restarts / HMR), executes `fn` only on a full miss. Failures are cached for
 * FAIL_TTL_MS under the same key and re-thrown, so a failing/rate-limited API
 * is not re-hit on every render. A DB outage degrades to memory-only behaviour.
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = CACHE_TTL_MS,
  /** How long a FAILED call is memoized before it can be retried (default 60s). */
  failureTtlMs = FAIL_TTL_MS
): Promise<T> {
  // 1) in-memory
  const memHit = memCache.get(key);
  if (memHit && memHit.expiresAt > Date.now()) {
    const v = memHit.value;
    if (isErrorEntry(v)) throw new Error(v.__error);
    return v as T;
  }

  // 2) Postgres (restart/HMR survival) — a DB outage degrades to executing fn.
  let dbHit: CacheEntry | null = null;
  try {
    dbHit = await readDb(key);
  } catch {
    // DB down — fall through to execute.
  }
  if (dbHit) {
    memCache.set(key, dbHit);
    const v = dbHit.value;
    if (isErrorEntry(v)) throw new Error(v.__error);
    return v as T;
  }

  try {
    const value = await fn();
    const entry: CacheEntry = { value, expiresAt: Date.now() + ttlMs };
    memCache.set(key, entry);
    writeDb(key, value, entry.expiresAt).catch(() => undefined);
    return value;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const entry: CacheEntry = { value: { __error: msg }, expiresAt: Date.now() + failureTtlMs };
    memCache.set(key, entry);
    writeDb(key, entry.value, entry.expiresAt).catch(() => undefined);
    throw err;
  }
}

/**
 * Store a value under `key` without `cached()`'s read-miss execution — for
 * shadow entries like last-good fallbacks that are only ever written
 * programmatically. DB write failures are swallowed (memory still has it).
 */
export async function writeCache(key: string, value: unknown, ttlMs: number): Promise<void> {
  const entry: CacheEntry = { value, expiresAt: Date.now() + ttlMs };
  memCache.set(key, entry);
  await writeDb(key, value, entry.expiresAt).catch(() => undefined);
}

/**
 * Read-only lookup (memory → Postgres), honouring expiry — never executes a
 * producer. Error entries are never returned.
 */
export async function peekCache<T>(key: string): Promise<T | null> {
  const memHit = memCache.get(key);
  if (memHit && memHit.expiresAt > Date.now() && !isErrorEntry(memHit.value)) {
    return memHit.value as T;
  }
  try {
    const dbHit = await readDb(key);
    if (dbHit && !isErrorEntry(dbHit.value)) {
      memCache.set(key, dbHit);
      return dbHit.value as T;
    }
  } catch {
    // DB down — memory is all we have.
  }
  return null;
}
