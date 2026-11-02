/**
 * Gateway business layer: role resolution (admin / champion / member),
 * quota-validated key operations, and the role-scoped read view for the UI.
 *
 * Roles:
 * - admin (mcp is_admin or ADMIN_USERS email): every team, every key; adjusts
 *   team credit pool + key-count limit.
 * - champion (team.champion — an mcp user email): own team's keys,
 *   issue/revoke/assign within max_keys and the credit pool.
 * - member (bound via deepseek_key_members): sees only the key(s) bound to them.
 *
 * Quota rules (enforced here):
 * - active keys per team ≤ team.max_keys
 * - sum of active keys' limits ≤ team.credit_usd (each key's own limit is
 *   enforced exactly by OpenRouter's per-key limit — 403 hard block)
 * - each key binds 1–2 members; a user can only be bound to one active key.
 */
import {
  type GatewayKey,
  type GatewayTeam,
  addKeyMember,
  createKeyRecord,
  getTeamById,
  getTeamsByChampion,
  listAllKeys,
  listKeyMembers,
  listKeysByTeam,
  listKeysForUser,
  listRecentAlerts,
  listSnapshots,
  listTeams,
  removeKeyMember,
  setKeyLimit,
  setKeyStatus,
  updateTeamLimits as dbUpdateTeamLimits,
} from "./db";
import { type OpenRouterKey, createKey, deleteKey, getModelPricing, listKeys, queryAnalytics, updateKey } from "./openrouter";
import { isAdminUser, isKnownUser } from "../auth";
import { cached } from "../cache";

export class GatewayForbiddenError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class GatewayNotFoundError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class GatewayConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type GatewayRole = "admin" | "champion" | "member" | "none";

/** Resolve the caller's role and the teams they may act on. */
export async function resolveRole(username: string): Promise<{
  role: GatewayRole;
  teams: GatewayTeam[];
}> {
  if (await isAdminUser(username)) {
    return { role: "admin", teams: await listTeams() };
  }
  const championTeams = await getTeamsByChampion(username);
  if (championTeams.length > 0) {
    return { role: "champion", teams: championTeams };
  }
  const memberKeys = await listKeysForUser(username);
  if (memberKeys.length > 0) {
    const teams = await listTeams();
    const teamIds = new Set(memberKeys.map((k) => k.teamId));
    return { role: "member", teams: teams.filter((t) => teamIds.has(t.id)) };
  }
  return { role: "none", teams: [] };
}

// ---- views ------------------------------------------------------------------

export interface KeyUsageSnapshot {
  capturedAt: string;
  usageUsd: number;
  limitUsd: number;
}

export interface KeyView extends GatewayKey {
  /**
   * Live effective spend for the month: credits + BYOK when
   * include_byok_in_limit is true, credits only otherwise — matches the
   * OpenRouter dashboard's usage bar (null when unknown).
   */
  usageUsd: number | null;
  /** Live credits spend for the month (null when no live key). */
  creditUsageUsd: number | null;
  /** Live BYOK spend for the month (null when no live key). */
  byokUsageUsd: number | null;
  /** Per-key BYOK savings vs OpenRouter list price (null when unknown). */
  savingsUsd: number | null;
  members: string[];
  snapshots: KeyUsageSnapshot[];
}

export interface TeamView extends GatewayTeam {
  keys: KeyView[];
  /** Sum of effective usage across the team's visible keys. */
  totalUsageUsd: number;
  /** Sum of non-null creditUsageUsd across the team's visible keys. */
  totalCreditUsageUsd: number;
  /** Sum of non-null byokUsageUsd across the team's visible keys. */
  totalByokUsageUsd: number;
  /** Sum of non-null savingsUsd across the team's visible keys. */
  totalSavingsUsd: number;
}

export interface SavingsEstimate {
  /** Estimated USD saved this month vs OpenRouter list price. */
  usd: number;
  /** Savings as a % of list cost (0–100). */
  percent: number;
}

export interface TeamsView {
  role: GatewayRole;
  teams: TeamView[];
  alerts: { teamId: number; keyId: number; level: string; usageUsd: number; sentAt: string }[];
  /** Global BYOK savings vs OpenRouter list price; null when not computable. */
  savings: SavingsEstimate | null;
  /** Set when the view could not be fully computed (DB/OpenRouter down). */
  error?: string;
}

/**
 * Role-scoped read view. Admin sees all teams/keys; champion sees own team's
 * keys; member sees only the keys bound to them (with their team's context).
 */
export async function getTeamsView(username: string): Promise<TeamsView> {
  const { role, teams } = await resolveRole(username);
  if (role === "none") return { role, teams: [], alerts: [], savings: null };

  // One OpenRouter call for live usage (map by hash); admin/champion see every
  // key, members only their own. Savings estimate is one more analytics query,
  // fired in parallel — both run exactly once per view, not per team/key.
  const [usageByHash, savings] = await Promise.all([
    listKeys()
      .then((ks) => new Map(ks.map((k) => [k.hash, k])))
      .catch((err) => {
        console.error("gateway listKeys failed:", err);
        return new Map<string, OpenRouterKey>();
      }),
    computeGlobalSavingsEstimate(),
  ]);

  const teamViews: TeamView[] = await Promise.all(
    teams.map(async (team) => {
      const allKeys = await listKeysByTeam(team.id);
      const visibleKeys =
        role === "member"
          ? allKeys.filter((k) => k.status === "active") // member filter below
          : allKeys;

      let memberKeyIds = new Set<number>();
      if (role === "member") {
        const myKeys = await listKeysForUser(username);
        memberKeyIds = new Set(myKeys.map((k) => k.id));
      }

      const keys: (KeyView | null)[] = await Promise.all(
        visibleKeys.map(async (k) => {
          if (role === "member" && !memberKeyIds.has(k.id)) return null;
          const live = k.status === "active" ? usageByHash.get(k.hash) : undefined;
          const members = (await listKeyMembers(k.id)).map((m) => m.username);
          const snapshots = (await listSnapshots(k.id, 30)).slice(0, 7).map((s) => ({
            capturedAt: s.capturedAt,
            usageUsd: s.usageUsd,
            limitUsd: s.limitUsd,
          }));
          return {
            ...k,
            usageUsd: effectiveUsageUsd(live),
            creditUsageUsd: live ? live.usageMonthly : null,
            byokUsageUsd: live ? live.byokUsageMonthly : null,
            savingsUsd: null,
            members,
            snapshots,
          } satisfies KeyView;
        })
      );

      const filtered = keys.filter((k): k is KeyView => k !== null);
      return {
        ...team,
        keys: filtered,
        totalUsageUsd: filtered.reduce((s, k) => s + (k.usageUsd ?? 0), 0),
        totalCreditUsageUsd: filtered.reduce((s, k) => s + (k.creditUsageUsd ?? 0), 0),
        totalByokUsageUsd: filtered.reduce((s, k) => s + (k.byokUsageUsd ?? 0), 0),
        totalSavingsUsd: filtered.reduce((s, k) => s + (k.savingsUsd ?? 0), 0),
      };
    })
  );

  const alerts =
    role === "admin" || role === "champion"
      ? (await listRecentAlerts(30)).filter((a) => teams.some((t) => t.id === a.teamId))
      : [];

  return {
    role,
    teams: teamViews,
    alerts: alerts.map((a) => ({
      teamId: a.teamId,
      keyId: a.keyId,
      level: a.level,
      usageUsd: a.usageUsd,
      sentAt: a.sentAt,
    })),
    savings,
  };
}

/** Effective spend vs the key's limit: follows include_byok_in_limit. */
function effectiveUsageUsd(live: OpenRouterKey | undefined): number | null {
  if (!live) return null;
  return live.includeByokInLimit ? live.usageMonthly + live.byokUsageMonthly : live.usageMonthly;
}

/**
 * Global savings estimate for the current calendar month: what the org's
 * BYOK-routed usage would have cost at OpenRouter list price, minus actual
 * BYOK spend (the ~30% Alibaba discount). Uses analytics `byok_usage` (same
 * dataset as the token counts) — never mixed with key-level
 * byok_usage_monthly, which measures a different spend slice.
 * Memoized 1h; returns null on any failure (never blocks the view).
 */
async function computeGlobalSavingsEstimate(): Promise<SavingsEstimate | null> {
  try {
    return await cached("gateway:savings:month", async () => {
      const now = new Date();
      const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const endDate = now.toISOString().slice(0, 10);
      const [rows, pricing] = await Promise.all([
        queryAnalytics({
          metrics: ["tokens_prompt", "tokens_completion", "byok_usage"],
          dimensions: ["model"],
          granularity: "month",
          startDate,
          endDate,
        }),
        getModelPricing(),
      ]);

      let listCost = 0;
      let byok = 0;
      for (const row of rows) {
        const byokUsage = Number(row.byok_usage ?? 0);
        if (byokUsage <= 0) continue;
        const price = lookupModelPricing(pricing, String(row.model ?? ""));
        if (!price) continue; // unknown pricing — skip, never guess
        listCost +=
          (Number(row.tokens_prompt ?? 0) / 1e6) * price.input +
          (Number(row.tokens_completion ?? 0) / 1e6) * price.output;
        byok += byokUsage;
      }
      if (listCost <= 0) return null;
      const usd = listCost - byok;
      return { usd, percent: (usd / listCost) * 100 };
    });
  } catch {
    return null;
  }
}

/**
 * Exact model-id match, then a dated-variant fallback: analytics reports
 * `deepseek/deepseek-v4-flash-20260731` while the models list has the same
 * model as `deepseek/deepseek-v4-flash-0731` (date → MMDD).
 */
function lookupModelPricing(
  pricing: Record<string, { input: number; output: number }>,
  modelId: string
): { input: number; output: number } | null {
  if (pricing[modelId]) return pricing[modelId];
  const m = modelId.match(/^(.+)-(\d{8})$/);
  if (m) {
    const short = `${m[1]}-${m[2].slice(4)}`;
    if (pricing[short]) return pricing[short];
  }
  return null;
}

// ---- key operations ---------------------------------------------------------

export interface IssuedKey {
  /** Plaintext sub-key — show exactly once, never persist. */
  key: string;
  label: string;
}

/**
 * Issue a fresh sub-key for a team. Validates max_keys, the credit pool
 * (sum of active keys' limits + new limit ≤ team.credit_usd) and member count
 * (≤ 2, each with no other active key).
 */
export async function issueKey(
  username: string,
  teamId: number,
  opts: { limitUsd: number; members?: string[] }
): Promise<IssuedKey> {
  const team = await requireTeam(teamId);
  await requireManage(username, team);

  const limitUsd = Number(opts.limitUsd);
  if (!Number.isFinite(limitUsd) || limitUsd <= 0) {
    throw new GatewayConflictError("limitUsd must be a positive number");
  }

  const members = (opts.members ?? []).map((m) => m.trim()).filter(Boolean).slice(0, 2);
  const activeKeys = (await listKeysByTeam(team.id)).filter((k) => k.status === "active");

  if (activeKeys.length >= team.maxKeys) {
    throw new GatewayConflictError(
      `Team "${team.name}" has reached its key limit (${team.maxKeys}) — ask an admin to raise it`
    );
  }
  const usedCredit = activeKeys.reduce((s, k) => s + k.limitUsd, 0);
  if (usedCredit + limitUsd > team.creditUsd) {
    throw new GatewayConflictError(
      `Credit limit exceeded: $${usedCredit.toFixed(2)} already allocated of $${team.creditUsd.toFixed(2)} — raise the team credit or lower the key limit`
    );
  }
  for (const member of members) {
    if (!(await isKnownUser(member))) {
      throw new GatewayConflictError(`"${member}" is not a known user`);
    }
    const existing = await listKeysForUser(member);
    if (existing.some((k) => k.status === "active")) {
      throw new GatewayConflictError(`"${member}" already has an active key`);
    }
  }

  const { key, keyRow } = await createKey({
    name: `fp-${team.name}-${activeKeys.length + 1}`,
    limitUsd,
  });
  try {
    const record = await createKeyRecord({
      teamId: team.id,
      hash: keyRow.hash,
      label: `fp-${team.name}-${activeKeys.length + 1}`,
      limitUsd,
      createdBy: username,
    });
    for (const member of members) {
      await addKeyMember({ keyId: record.id, username: member, assignedBy: username });
    }
    return { key, label: record.label };
  } catch (err) {
    // Remote key exists but local persist failed — delete it so no
    // untracked, limited key remains live on OpenRouter.
    await deleteKey(keyRow.hash).catch((cleanupErr) => {
      console.error(
        `gateway: orphan key ${keyRow.hash.slice(0, 8)} cleanup failed — delete manually:`,
        cleanupErr
      );
    });
    throw err;
  }
}

/** Bind a user to an existing key (1–2 members, one active key per user). */
export async function assignMember(
  username: string,
  keyId: number,
  memberUsername: string
): Promise<void> {
  const key = await requireKey(keyId);
  const team = await requireTeam(key.teamId);
  await requireManage(username, team);

  if (key.status !== "active") {
    throw new GatewayConflictError("Key is not active");
  }
  const current = await listKeyMembers(key.id);
  if (current.length >= 2) {
    throw new GatewayConflictError("Key already has 2 members — revoke or remove one first");
  }
  if (current.some((m) => m.username === memberUsername)) {
    throw new GatewayConflictError(`"${memberUsername}" is already bound to this key`);
  }
  if (!(await isKnownUser(memberUsername))) {
    throw new GatewayConflictError(`"${memberUsername}" is not a known user`);
  }
  const existing = await listKeysForUser(memberUsername);
  if (existing.some((k) => k.status === "active")) {
    throw new GatewayConflictError(`"${memberUsername}" already has an active key`);
  }
  await addKeyMember({ keyId: key.id, username: memberUsername, assignedBy: username });
}

export async function removeMember(
  username: string,
  keyId: number,
  memberUsername: string
): Promise<void> {
  const key = await requireKey(keyId);
  const team = await requireTeam(key.teamId);
  await requireManage(username, team);
  await removeKeyMember(key.id, memberUsername);
}

/** Revoke a key (OpenRouter + local status). Members stay as history. */
export async function revokeKey(username: string, keyId: number): Promise<void> {
  const key = await requireKey(keyId);
  const team = await requireTeam(key.teamId);
  await requireManage(username, team);

  if (key.status === "active") {
    try {
      await deleteKey(key.hash);
    } catch {
      // Remote delete failed — the key is still live on OpenRouter. Keep
      // local status "active" so the UI (and poller) keeps tracking it
      // instead of silently lying that it is revoked.
      throw new GatewayConflictError(
        `OpenRouter refused to delete the key (it may still work). Nothing changed — retry or delete it in the OpenRouter dashboard.`
      );
    }
    await setKeyStatus(key.id, "revoked");
  }
}

/**
 * Adjust an issued key's monthly limit (champion of its team or admin).
 * Re-validates the team credit pool: sum of active keys' limits (incl. the
 * new value) must stay ≤ team credit. Pushes the new limit to OpenRouter
 * first (the real enforcement), then mirrors it locally.
 */
export async function updateKeyLimit(
  username: string,
  keyId: number,
  limitUsd: number
): Promise<void> {
  const key = await requireKey(keyId);
  const team = await requireTeam(key.teamId);
  await requireManage(username, team);

  if (!Number.isFinite(limitUsd) || limitUsd <= 0) {
    throw new GatewayConflictError("limitUsd must be a positive number");
  }
  if (key.status !== "active") {
    throw new GatewayConflictError("Cannot adjust a revoked key");
  }

  const activeKeys = (await listKeysByTeam(team.id)).filter((k) => k.status === "active");
  const used = activeKeys.reduce((s, k) => s + (k.id === key.id ? 0 : k.limitUsd), 0);
  if (used + limitUsd > team.creditUsd) {
    throw new GatewayConflictError(
      `Credit limit exceeded: $${used.toFixed(2)} already allocated of $${team.creditUsd.toFixed(2)} — raise the team credit or lower this key's limit`
    );
  }

  try {
    await updateKey(key.hash, { limit: limitUsd });
  } catch {
    // Remote update failed — the live limit on OpenRouter is unchanged. Do NOT
    // update the local record, so the UI keeps showing the true enforced limit.
    throw new GatewayConflictError(
      `OpenRouter refused to update the key limit (it is unchanged). Retry or change it in the OpenRouter dashboard.`
    );
  }
  await setKeyLimit(key.id, limitUsd);
}

/** Admin-only: adjust team credit pool and/or key-count limit. */
export async function updateTeamLimits(
  username: string,
  teamId: number,
  patch: { creditUsd?: number; maxKeys?: number }
): Promise<GatewayTeam> {
  if (!(await isAdminUser(username))) {
    throw new GatewayForbiddenError("Only admins can adjust team limits");
  }
  const team = await requireTeam(teamId);
  const activeKeys = (await listKeysByTeam(team.id)).filter((k) => k.status === "active");

  if (patch.creditUsd !== undefined) {
    const used = activeKeys.reduce((s, k) => s + k.limitUsd, 0);
    if (patch.creditUsd < used) {
      throw new GatewayConflictError(
        `credit_usd cannot be below the $${used.toFixed(2)} already allocated across active keys`
      );
    }
  }
  if (patch.maxKeys !== undefined) {
    if (patch.maxKeys < activeKeys.length) {
      throw new GatewayConflictError(
        `max_keys cannot be below the ${activeKeys.length} active keys`
      );
    }
  }
  return dbUpdateTeamLimits(team.id, patch);
}

// ---- guards -----------------------------------------------------------------

async function requireTeam(teamId: number): Promise<GatewayTeam> {
  const team = await getTeamById(teamId);
  if (!team) throw new GatewayNotFoundError("Team not found");
  return team;
}

async function requireKey(keyId: number): Promise<GatewayKey> {
  const key = (await listAllKeys()).find((k) => k.id === keyId);
  if (!key) throw new GatewayNotFoundError("Key not found");
  return key;
}

async function requireManage(username: string, team: GatewayTeam): Promise<void> {
  if ((await isAdminUser(username)) || team.champion === username) return;
  throw new GatewayForbiddenError("You can only manage your own team's keys");
}
