import { pool } from "./db";

export interface UptimeCheck {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: Date;
}

export interface UptimeStats {
  totalChecks: number;
  okChecks: number;
  downChecks: number;
  uptimePct: number | null; // null when no checks yet
  lastCheck: UptimeCheck | null;
  recent: UptimeCheck[];
}

// ponytail: CREATE TABLE IF NOT EXISTS on first use, no migration framework.
export async function ensureUptimeTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uptime_checks (
      id BIGSERIAL PRIMARY KEY,
      target TEXT NOT NULL,
      ok BOOLEAN NOT NULL,
      status_code INTEGER,
      latency_ms INTEGER,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_uptime_target_time
      ON uptime_checks (target, checked_at DESC)
  `);
}

/** True when the target is considered alive (any 2xx/3xx response counts). */
function isOk(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 400;
}

/**
 * One probe of a site: HEAD request with a 15s timeout, recorded to Postgres.
 * Network/HTTP errors count as down (statusCode null). Never throws.
 */
export async function runUptimeCheck(target: string): Promise<UptimeCheck> {
  const startedAt = Date.now();
  let statusCode: number | null = null;
  try {
    const res = await fetch(target, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    statusCode = res.status;
  } catch {
    statusCode = null;
  }
  const latencyMs = Date.now() - startedAt;
  const check: UptimeCheck = {
    ok: statusCode !== null && isOk(statusCode),
    statusCode,
    latencyMs,
    checkedAt: new Date(),
  };
  try {
    await ensureUptimeTable();
    await pool.query(
      `INSERT INTO uptime_checks (target, ok, status_code, latency_ms)
       VALUES ($1, $2, $3, $4)`,
      [target, check.ok, check.statusCode, check.latencyMs]
    );
  } catch (err) {
    // ponytail: never crash the scheduler because the metrics store is down
    console.error("uptime check record failed:", err);
  }
  return check;
}

/** Aggregate recent checks (default last 24h) for the dashboard status panel. */
export async function getUptimeStats(
  target: string,
  hours = 24
): Promise<UptimeStats> {
  try {
    await ensureUptimeTable();
    // 5-min checks → up to 288 rows in 24h; cap above that so the uptimePct
    // window really covers the full requested range.
    const { rows } = await pool.query(
      `SELECT ok, status_code AS "statusCode", latency_ms AS "latencyMs", checked_at AS "checkedAt"
       FROM uptime_checks
       WHERE target = $1 AND checked_at > now() - make_interval(hours => $2)
       ORDER BY checked_at DESC
       LIMIT 1500`,
      [target, hours]
    );
    const recent: UptimeCheck[] = rows.map((r) => ({
      ok: Boolean(r.ok),
      statusCode: r.statusCode,
      latencyMs: r.latencyMs,
      checkedAt: r.checkedAt instanceof Date ? r.checkedAt : new Date(r.checkedAt),
    }));
    const totalChecks = recent.length;
    const okChecks = recent.filter((c) => c.ok).length;
    return {
      totalChecks,
      okChecks,
      downChecks: totalChecks - okChecks,
      uptimePct: totalChecks === 0 ? null : Math.round((okChecks / totalChecks) * 1000) / 10,
      lastCheck: recent[0] ?? null,
      recent: recent.slice(0, 30),
    };
  } catch (err) {
    console.error("getUptimeStats failed:", err);
    return { totalChecks: 0, okChecks: 0, downChecks: 0, uptimePct: null, lastCheck: null, recent: [] };
  }
}
