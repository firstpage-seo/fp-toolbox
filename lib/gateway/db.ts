/**
 * Gateway runtime tables for team-key management (OpenRouter BYOK).
 *
 * Multi-key model (feat/gateway-multi-key):
 * - deepseek_teams         — one row per team (department). champion manages the
 *                            team's keys; credit_usd (monthly pool) + max_keys
 *                            (key count) are admin-controlled.
 * - deepseek_keys          — one row per issued OpenRouter key (per-key USD limit,
 *                            status active|revoked, created_by).
 * - deepseek_key_members   — key ↔ user binding (1–2 members per key, UNIQUE
 *                            (key_id, username)).
 * - deepseek_usage_snapshots — hourly per-key usage snapshots (history + charts).
 * - deepseek_alerts_log    — dedupe log for 80%/100% alerts (per key/level/month).
 *
 * Quota rules enforced in the service layer: active keys ≤ max_keys, and the
 * sum of active keys' limits ≤ credit_usd. OpenRouter enforces each key's own
 * monthly limit (403 hard block) — no shared-pool enforcement needed.
 *
 * CREATE TABLE IF NOT EXISTS + idempotent ALTERs on first use — same pattern as
 * lib/usage.ts (no migration framework at this scale).
 */
import { pool } from "../db";

export interface GatewayTeam {
  id: number;
  name: string;
  champion: string;
  creditUsd: number;
  maxKeys: number;
  createdAt: string;
}

export interface GatewayKey {
  id: number;
  teamId: number;
  hash: string;
  label: string;
  limitUsd: number;
  status: "active" | "revoked";
  createdBy: string;
  createdAt: string;
}

export interface KeyMember {
  keyId: number;
  username: string;
  assignedBy: string;
  createdAt: string;
}

export interface UsageSnapshot {
  id: number;
  teamId: number;
  keyId: number;
  usageUsd: number;
  limitUsd: number;
  capturedAt: string;
}

export type AlertLevel = "80" | "100";

export interface AlertLogEntry {
  id: number;
  teamId: number;
  keyId: number;
  level: AlertLevel;
  usageUsd: number;
  sentAt: string;
}

// Concurrent callers (getTeamsView fans out per team/key) must share ONE
// in-flight DDL run — parallel CREATE INDEX IF NOT EXISTS / DROP INDEX on the
// same names races pg_class and throws "duplicate key value violates unique
// constraint pg_class_relname_nsp_index". Memoized at module scope: concurrent
// callers await the same promise; on failure it resets so the next call retries.
let ensurePromise: Promise<void> | null = null;

export async function ensureGatewayTables(): Promise<void> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = runEnsureTables().catch((err) => {
    ensurePromise = null;
    throw err;
  });
  return ensurePromise;
}

/** Create/migrate the gateway tables + indexes on first use. Safe to repeat. */
async function runEnsureTables(): Promise<void> {
  // teams — multi-key columns (credit pool + key count limit), migrate old
  // single-key columns away (single-key model predates feat/gateway-multi-key).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deepseek_teams (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      champion TEXT NOT NULL,
      credit_usd NUMERIC(10,2) NOT NULL DEFAULT 30,
      max_keys INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE deepseek_teams DROP COLUMN IF EXISTS key_hash`);
  await pool.query(`ALTER TABLE deepseek_teams DROP COLUMN IF EXISTS key_label`);
  await pool.query(`ALTER TABLE deepseek_teams ADD COLUMN IF NOT EXISTS credit_usd NUMERIC(10,2) NOT NULL DEFAULT 30`);
  await pool.query(`ALTER TABLE deepseek_teams ADD COLUMN IF NOT EXISTS max_keys INTEGER NOT NULL DEFAULT 1`);

  // keys — one row per OpenRouter key
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deepseek_keys (
      id BIGSERIAL PRIMARY KEY,
      team_id BIGINT NOT NULL REFERENCES deepseek_teams(id),
      hash TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      limit_usd NUMERIC(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ds_keys_team ON deepseek_keys (team_id, status)
  `);

  // key members — 1–2 users per key
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deepseek_key_members (
      id BIGSERIAL PRIMARY KEY,
      key_id BIGINT NOT NULL REFERENCES deepseek_keys(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (key_id, username)
    )
  `);

  // usage snapshots — per-key hourly history
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deepseek_usage_snapshots (
      id BIGSERIAL PRIMARY KEY,
      team_id BIGINT NOT NULL REFERENCES deepseek_teams(id),
      key_id BIGINT REFERENCES deepseek_keys(id),
      usage_usd NUMERIC(12,6) NOT NULL,
      limit_usd NUMERIC(10,2) NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE deepseek_usage_snapshots ADD COLUMN IF NOT EXISTS key_id BIGINT`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ds_snap_key_time
      ON deepseek_usage_snapshots (key_id, captured_at DESC)
  `);

  // alerts — per-key dedupe (key, level, calendar month, UTC)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deepseek_alerts_log (
      id BIGSERIAL PRIMARY KEY,
      team_id BIGINT NOT NULL REFERENCES deepseek_teams(id),
      key_id BIGINT,
      level TEXT NOT NULL,
      usage_usd NUMERIC(12,6) NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE deepseek_alerts_log ADD COLUMN IF NOT EXISTS key_id BIGINT`);
  // Table UNIQUE(...) can't hold expressions, and date_trunc on timestamptz is
  // STABLE (timezone-dependent) — explicit zone cast makes the index IMMUTABLE.
  await pool.query(`DROP INDEX IF EXISTS idx_ds_alerts_dedupe`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ds_alerts_dedupe
      ON deepseek_alerts_log (key_id, level, date_trunc('month', sent_at AT TIME ZONE 'UTC'))
  `);
}

// ---- teams ------------------------------------------------------------------

const TEAM_COLUMNS = "id, name, champion, credit_usd, max_keys, created_at";

function rowToTeam(row: Record<string, unknown>): GatewayTeam {
  return {
    id: Number(row.id),
    name: String(row.name),
    champion: String(row.champion),
    creditUsd: Number(row.credit_usd),
    maxKeys: Number(row.max_keys),
    createdAt: String(row.created_at),
  };
}

export async function listTeams(): Promise<GatewayTeam[]> {
  await ensureGatewayTables();
  const { rows } = await pool.query(`SELECT ${TEAM_COLUMNS} FROM deepseek_teams ORDER BY name`);
  return rows.map(rowToTeam);
}

export async function getTeamById(id: number): Promise<GatewayTeam | null> {
  await ensureGatewayTables();
  const { rows } = await pool.query(`SELECT ${TEAM_COLUMNS} FROM deepseek_teams WHERE id = $1`, [id]);
  return rows.length ? rowToTeam(rows[0]) : null;
}

export async function getTeamsByChampion(champion: string): Promise<GatewayTeam[]> {
  await ensureGatewayTables();
  const { rows } = await pool.query(
    `SELECT ${TEAM_COLUMNS} FROM deepseek_teams WHERE champion = $1 ORDER BY name`,
    [champion]
  );
  return rows.map(rowToTeam);
}

export async function createTeam(opts: {
  name: string;
  champion: string;
  creditUsd?: number;
  maxKeys?: number;
}): Promise<GatewayTeam> {
  await ensureGatewayTables();
  const { rows } = await pool.query(
    `INSERT INTO deepseek_teams (name, champion, credit_usd, max_keys)
     VALUES ($1, $2, $3, $4)
     RETURNING ${TEAM_COLUMNS}`,
    [opts.name, opts.champion, opts.creditUsd ?? 30, opts.maxKeys ?? 1]
  );
  return rowToTeam(rows[0]);
}

/** Admin-only: adjust a team's monthly credit pool and/or key-count limit. */
export async function updateTeamLimits(
  id: number,
  patch: { creditUsd?: number; maxKeys?: number }
): Promise<GatewayTeam> {
  await ensureGatewayTables();
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (patch.creditUsd !== undefined) {
    values.push(patch.creditUsd);
    sets.push(`credit_usd = $${values.length}`);
  }
  if (patch.maxKeys !== undefined) {
    values.push(Math.max(0, Math.floor(patch.maxKeys)));
    sets.push(`max_keys = $${values.length}`);
  }
  if (sets.length === 0) {
    const t = await getTeamById(id);
    if (!t) throw new Error("Team not found");
    return t;
  }
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE deepseek_teams SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length}
     RETURNING ${TEAM_COLUMNS}`,
    values
  );
  if (!rows.length) throw new Error("Team not found");
  return rowToTeam(rows[0]);
}

// ---- keys -------------------------------------------------------------------

const KEY_COLUMNS = "id, team_id, hash, label, limit_usd, status, created_by, created_at";

function rowToKey(row: Record<string, unknown>): GatewayKey {
  return {
    id: Number(row.id),
    teamId: Number(row.team_id),
    hash: String(row.hash),
    label: String(row.label),
    limitUsd: Number(row.limit_usd),
    status: String(row.status) as GatewayKey["status"],
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  };
}

export async function createKeyRecord(opts: {
  teamId: number;
  hash: string;
  label: string;
  limitUsd: number;
  createdBy: string;
}): Promise<GatewayKey> {
  await ensureGatewayTables();
  const { rows } = await pool.query(
    `INSERT INTO deepseek_keys (team_id, hash, label, limit_usd, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${KEY_COLUMNS}`,
    [opts.teamId, opts.hash, opts.label, opts.limitUsd, opts.createdBy]
  );
  return rowToKey(rows[0]);
}

export async function getKeyById(id: number): Promise<GatewayKey | null> {
  await ensureGatewayTables();
  const { rows } = await pool.query(`SELECT ${KEY_COLUMNS} FROM deepseek_keys WHERE id = $1`, [id]);
  return rows.length ? rowToKey(rows[0]) : null;
}

export async function listKeysByTeam(teamId: number): Promise<GatewayKey[]> {
  await ensureGatewayTables();
  const { rows } = await pool.query(
    `SELECT ${KEY_COLUMNS} FROM deepseek_keys WHERE team_id = $1 ORDER BY id DESC`,
    [teamId]
  );
  return rows.map(rowToKey);
}

export async function listAllKeys(): Promise<GatewayKey[]> {
  await ensureGatewayTables();
  const { rows } = await pool.query(`SELECT ${KEY_COLUMNS} FROM deepseek_keys ORDER BY id DESC`);
  return rows.map(rowToKey);
}

export async function setKeyStatus(id: number, status: GatewayKey["status"]): Promise<void> {
  await pool.query(`UPDATE deepseek_keys SET status = $2 WHERE id = $1`, [id, status]);
}

export async function setKeyLimit(id: number, limitUsd: number): Promise<void> {
  await pool.query(`UPDATE deepseek_keys SET limit_usd = $2 WHERE id = $1`, [id, limitUsd]);
}

/** Keys bound to a user (via deepseek_key_members) — for the member view. */
export async function listKeysForUser(username: string): Promise<GatewayKey[]> {
  await ensureGatewayTables();
  const { rows } = await pool.query(
    `SELECT k.${KEY_COLUMNS.replace(/, /g, ", k.")}
     FROM deepseek_keys k
     JOIN deepseek_key_members m ON m.key_id = k.id
     WHERE m.username = $1
     ORDER BY k.id DESC`,
    [username]
  );
  return rows.map(rowToKey);
}

// ---- members ----------------------------------------------------------------

/** Bind a user to a key. Returns false when already bound (UNIQUE guard). */
export async function addKeyMember(opts: {
  keyId: number;
  username: string;
  assignedBy: string;
}): Promise<boolean> {
  await ensureGatewayTables();
  const { rowCount } = await pool.query(
    `INSERT INTO deepseek_key_members (key_id, username, assigned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (key_id, username) DO NOTHING`,
    [opts.keyId, opts.username, opts.assignedBy]
  );
  return (rowCount ?? 0) > 0;
}

export async function listKeyMembers(keyId: number): Promise<KeyMember[]> {
  await ensureGatewayTables();
  const { rows } = await pool.query(
    `SELECT key_id, username, assigned_by, created_at
     FROM deepseek_key_members WHERE key_id = $1 ORDER BY created_at`,
    [keyId]
  );
  return rows.map((r) => ({
    keyId: Number(r.key_id),
    username: String(r.username),
    assignedBy: String(r.assigned_by),
    createdAt: String(r.created_at),
  }));
}

export async function removeKeyMember(keyId: number, username: string): Promise<void> {
  await pool.query(
    `DELETE FROM deepseek_key_members WHERE key_id = $1 AND username = $2`,
    [keyId, username]
  );
}

// ---- usage snapshots --------------------------------------------------------

export async function recordUsageSnapshot(
  keyId: number,
  teamId: number,
  usageUsd: number,
  limitUsd: number
): Promise<void> {
  await pool.query(
    `INSERT INTO deepseek_usage_snapshots (team_id, key_id, usage_usd, limit_usd)
     VALUES ($1, $2, $3, $4)`,
    [teamId, keyId, usageUsd, limitUsd]
  );
}

export async function listSnapshots(keyId: number, days: number): Promise<UsageSnapshot[]> {
  const { rows } = await pool.query(
    `SELECT id, team_id, key_id, usage_usd, limit_usd, captured_at
     FROM deepseek_usage_snapshots
     WHERE key_id = $1 AND captured_at > now() - make_interval(days => $2)
     ORDER BY captured_at DESC`,
    [keyId, Math.max(1, Math.floor(days))]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    teamId: Number(r.team_id),
    keyId: Number(r.key_id),
    usageUsd: Number(r.usage_usd),
    limitUsd: Number(r.limit_usd),
    capturedAt: String(r.captured_at),
  }));
}

/** Drop hourly snapshots older than `days` — unbounded growth guard. */
export async function pruneSnapshots(days: number): Promise<void> {
  await pool.query(
    `DELETE FROM deepseek_usage_snapshots WHERE captured_at < now() - make_interval(days => $1)`,
    [Math.max(1, Math.floor(days))]
  );
}

// ---- alerts -----------------------------------------------------------------

/**
 * Record an alert, deduped per (key, level, calendar month, UTC).
 * Returns true when the alert is new (and should be pushed to the webhook).
 */
export async function recordAlert(
  teamId: number,
  keyId: number,
  level: AlertLevel,
  usageUsd: number
): Promise<boolean> {
  await ensureGatewayTables();
  const { rowCount } = await pool.query(
    `INSERT INTO deepseek_alerts_log (team_id, key_id, level, usage_usd)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key_id, level, date_trunc('month', sent_at AT TIME ZONE 'UTC')) DO NOTHING`,
    [teamId, keyId, level, usageUsd]
  );
  return (rowCount ?? 0) > 0;
}

export async function listRecentAlerts(days = 30): Promise<AlertLogEntry[]> {
  await ensureGatewayTables();
  const { rows } = await pool.query(
    `SELECT id, team_id, key_id, level, usage_usd, sent_at
     FROM deepseek_alerts_log
     WHERE sent_at > now() - make_interval(days => $1)
     ORDER BY sent_at DESC`,
    [days]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    teamId: Number(r.team_id),
    keyId: r.key_id === null ? 0 : Number(r.key_id),
    level: String(r.level) as AlertLevel,
    usageUsd: Number(r.usage_usd),
    sentAt: String(r.sent_at),
  }));
}
