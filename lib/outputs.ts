import { pool } from "./db";

export interface ToolOutput {
  id: number;
  userName: string;
  toolSlug: string;
  brief: Record<string, unknown>;
  output: unknown;
  model: string;
  costUsd: number;
  createdAt: string;
}

async function ensureOutputsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tool_outputs (
      id BIGSERIAL PRIMARY KEY,
      user_name TEXT NOT NULL,
      tool_slug TEXT NOT NULL,
      brief JSONB NOT NULL,
      output JSONB NOT NULL,
      model TEXT NOT NULL DEFAULT '',
      cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_tool_outputs_user_slug ON tool_outputs (user_name, tool_slug, id DESC)`
  );
}

/** Persist a generated output so it survives refresh and can be refined. */
export async function saveOutput(opts: {
  user: string;
  toolSlug: string;
  brief: Record<string, unknown>;
  output: unknown;
  model: string;
  costUsd: number;
}): Promise<number> {
  await ensureOutputsTable();
  const { rows } = await pool.query(
    `INSERT INTO tool_outputs (user_name, tool_slug, brief, output, model, cost_usd)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [opts.user, opts.toolSlug, JSON.stringify(opts.brief), JSON.stringify(opts.output), opts.model, opts.costUsd]
  );
  return Number(rows[0].id);
}

/** Recent outputs for one user + tool, newest first. */
export async function listOutputs(user: string, toolSlug: string): Promise<ToolOutput[]> {
  await ensureOutputsTable();
  const { rows } = await pool.query(
    `SELECT id, user_name AS "userName", tool_slug AS "toolSlug", brief, output, model,
            cost_usd AS "costUsd", created_at AS "createdAt"
     FROM tool_outputs WHERE user_name = $1 AND tool_slug = $2
     ORDER BY id DESC LIMIT 20`,
    [user, toolSlug]
  );
  return rows as ToolOutput[];
}

export async function getOutput(id: number): Promise<ToolOutput | null> {
  await ensureOutputsTable();
  const { rows } = await pool.query(
    `SELECT id, user_name AS "userName", tool_slug AS "toolSlug", brief, output, model,
            cost_usd AS "costUsd", created_at AS "createdAt"
     FROM tool_outputs WHERE id = $1`,
    [id]
  );
  return (rows[0] as ToolOutput) ?? null;
}
