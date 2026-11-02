// Onsite SEO Audit — manual-action tracking (per client domain).
//
// The manual checklist items a human has to complete are tracked in Postgres
// keyed by domain, so progress survives re-runs of the same site (a re-run
// shows the same action state — one checklist per client). Shared across
// users; user_name records who last updated each item.

import { pool } from "@/lib/db";

export const ACTION_STATUSES = ["pending", "in-progress", "done", "n-a"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface AuditAction {
  domain: string;
  itemId: string;
  status: ActionStatus;
  note: string;
  userName: string;
  updatedAt: string;
}

let tableReady: Promise<void> | null = null;
function ensureActionsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS onsite_audit_actions (
          id BIGSERIAL PRIMARY KEY,
          domain TEXT NOT NULL,
          item_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          note TEXT NOT NULL DEFAULT '',
          user_name TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (domain, item_id)
        )
      `)
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

/** Upsert one manual-action status for a domain; returns the updated row. */
export async function setAction(opts: {
  domain: string;
  itemId: string;
  status: ActionStatus;
  note: string;
  user: string;
}): Promise<AuditAction> {
  await ensureActionsTable();
  const { rows } = await pool.query(
    `INSERT INTO onsite_audit_actions (domain, item_id, status, note, user_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (domain, item_id) DO UPDATE
       SET status = EXCLUDED.status,
           note = EXCLUDED.note,
           user_name = EXCLUDED.user_name,
           updated_at = now()
     RETURNING domain AS "domain", item_id AS "itemId", status, note,
               user_name AS "userName", updated_at AS "updatedAt"`,
    [opts.domain, opts.itemId, opts.status, opts.note, opts.user]
  );
  return rows[0] as AuditAction;
}

/** All saved manual-action rows for a domain. */
export async function getActions(domain: string): Promise<AuditAction[]> {
  await ensureActionsTable();
  const { rows } = await pool.query(
    `SELECT domain, item_id AS "itemId", status, note,
            user_name AS "userName", updated_at AS "updatedAt"
     FROM onsite_audit_actions WHERE domain = $1`,
    [domain]
  );
  return rows as AuditAction[];
}
