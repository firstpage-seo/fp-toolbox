import { pool } from "./db";

export interface UsageEvent {
  user: string;
  toolSlug: string;
  action: string;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

// ponytail: CREATE TABLE IF NOT EXISTS on first use, no migration framework.
export async function ensureUsageTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usage_events (
      id BIGSERIAL PRIMARY KEY,
      user_name TEXT NOT NULL,
      tool_slug TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'run',
      duration_ms INTEGER NOT NULL DEFAULT 0,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function logUsage(e: UsageEvent): Promise<void> {
  try {
    await ensureUsageTable();
    await pool.query(
      `INSERT INTO usage_events (user_name, tool_slug, action, duration_ms, prompt_tokens, completion_tokens, cost_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [e.user, e.toolSlug, e.action, e.durationMs, e.promptTokens, e.completionTokens, e.costUsd]
    );
  } catch (err) {
    // ponytail: never break the tool because metrics failed
    console.error("logUsage failed:", err);
  }
}

export interface UsageStats {
  totalRuns: number;
  activeUsers: number;
  totalCostUsd: number;
  perTool: { tool_slug: string; runs: number; cost_usd: number }[];
}

/**
 * Usage stats, optionally windowed to the last N days. No arg = all-time
 * (usage page); the dashboard passes a window for its range picker.
 */
export async function getUsageStats(days?: number): Promise<UsageStats> {
  try {
    await ensureUsageTable();
    // days is a caller-provided integer — no injection surface.
    const windowFilter =
      days !== undefined
        ? `WHERE created_at > now() - make_interval(days => ${Math.max(1, Math.floor(days))})`
        : "";
    const [{ rows: totals }, { rows: perTool }] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS runs, COUNT(DISTINCT user_name)::int AS users,
                COALESCE(SUM(cost_usd),0)::float AS cost
         FROM usage_events ${windowFilter}`
      ),
      pool.query(
        `SELECT tool_slug, COUNT(*)::int AS runs, COALESCE(SUM(cost_usd),0)::float AS cost_usd
         FROM usage_events ${windowFilter} GROUP BY tool_slug ORDER BY runs DESC`
      ),
    ]);
    return {
      totalRuns: totals[0].runs,
      activeUsers: totals[0].users,
      totalCostUsd: totals[0].cost,
      perTool,
    };
  } catch (err) {
    console.error("getUsageStats failed:", err);
    return { totalRuns: 0, activeUsers: 0, totalCostUsd: 0, perTool: [] };
  }
}
