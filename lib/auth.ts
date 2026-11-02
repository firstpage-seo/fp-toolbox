/**
 * Auth: SSO against firstpage-mcp when the internal key is configured,
 * legacy AUTH_USERS/ADMIN_USERS fallback when it is not.
 *
 * ── Verbatim contract (firstpage-mcp /admin/api/*, Bearer FP_MCP_INTERNAL_KEY) ──
 * POST {FP_MCP_URL}/admin/api/authenticate  body: {"email": "...", "password": "..."}
 *   success: 200 {"ok": true, "email": "...", "is_admin": bool,
 *                 "session_token": "<itsdangerous-signed payload or null>",
 *                 "expires_at": "ISO8601"}
 *   failure: 200 {"ok": false, "message": "..."}  — wrong creds / unverified account
 *   authn:   401 {"detail": "unauthorized"}       — missing/wrong internal key
 * GET {FP_MCP_URL}/admin/api/session (cookie `fp_session` → Cookie header)
 *   ok+valid cookie: 200 {"ok": true, "email": "...", "is_admin": bool}
 *   no/invalid/expired cookie: 200 {"ok": false}
 *   authn: 401 {"detail": "unauthorized"}  — missing/wrong internal key
 * ────────────────────────────────────────────────────────────────────────────────
 *
 * FP_MCP_INTERNAL_KEY set  → identity is the mcp user email. Login rejects with
 *   the mcp failure message; network/HTTP errors are thrown (login → 502) and
 *   NEVER silently fall back to AUTH_USERS. Champion/member names are verified
 *   against the mcp users list (is_verified), admin = mcp is_admin OR ADMIN_USERS.
 * FP_MCP_INTERNAL_KEY unset → legacy AUTH_USERS / ADMIN_USERS behaviour.
 */

import { cookies } from "next/headers";

export const MCP_DEFAULT_URL = "https://mcp.firstpage.com.hk";
const MCP_TIMEOUT_MS = 15_000;
/** Known-user list cache: module-level Map, 60s TTL (see getMcpUsersCached). */
const USERS_TTL_MS = 60_000;

export interface CredentialOk {
  ok: true;
  email: string;
  isAdmin: boolean;
  /** Itdangerous-signed session payload accepted by mcp's get_session_user(). */
  sessionToken: string | null;
  /** ISO8601 expiry of session_token (cookie maxAge is capped at 8h). */
  expiresAt: string | null;
}

export interface CredentialRejected {
  ok: false;
  /** Plumbed from mcp's authenticate message (wrong creds / unverified). */
  message: string;
}

export type CredentialCheck = CredentialOk | CredentialRejected;

interface McpUser {
  email: string;
  is_verified: boolean;
  is_admin: boolean;
}

function mcpInternalKey(): string | undefined {
  return process.env.FP_MCP_INTERNAL_KEY;
}

/** Any non-200 from mcp /admin/api/* throws — callers surface it as a 502. */
async function mcpFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = mcpInternalKey();
  const res = await fetch(
    `${(process.env.FP_MCP_URL || MCP_DEFAULT_URL).replace(/\/+$/, "")}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(MCP_TIMEOUT_MS),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`firstpage-mcp ${path} failed: HTTP ${res.status}`);
  }
  return res;
}

// ---- credential validation ------------------------------------------------

/**
 * Validate email+password. Resolves {ok:true,...} on success, {ok:false,
 * message} on rejection (message mirrors mcp's login failure), and THROWS on
 * mcp network/HTTP errors when the internal key is configured — the caller
 * turns that into a 502 (never silent fallback).
 */
export async function validateCredentials(
  username: string,
  password: string
): Promise<CredentialCheck> {
  if (mcpInternalKey()) {
    const res = await mcpFetch("/admin/api/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username, password }),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      email?: string;
      is_admin?: boolean;
      session_token?: string | null;
      expires_at?: string | null;
      message?: string;
    };
    if (body.ok) {
      return {
        ok: true,
        email: body.email ?? username,
        isAdmin: Boolean(body.is_admin),
        sessionToken: body.session_token ?? null,
        expiresAt: body.expires_at ?? null,
      };
    }
    return {
      ok: false,
      message:
        typeof body.message === "string" && body.message
          ? body.message
          : "Invalid credentials",
    };
  }

  // Legacy AUTH_USERS fallback (key unset).
  const valid = legacyValidateCredentials(username, password);
  if (!valid) return { ok: false, message: "Invalid credentials" };
  return {
    ok: true,
    email: username,
    isAdmin: legacyIsAdminUser(username),
    sessionToken: null,
    expiresAt: null,
  };
}

// ---- known users / admins (cached mcp user list) ---------------------------

let usersCache: { fetchedAt: number; users: McpUser[] } | null = null;

async function fetchMcpUsers(): Promise<McpUser[]> {
  const res = await mcpFetch("/admin/api/users");
  const body = (await res.json()) as { users?: McpUser[] };
  return Array.isArray(body.users) ? body.users : [];
}

/**
 * Module-level user list with a 60s TTL. Errors are not cached (a failing mcp
 * surfaces on every call instead of being masked until the TTL expires).
 */
async function getMcpUsersCached(): Promise<McpUser[]> {
  const now = Date.now();
  if (usersCache && now - usersCache.fetchedAt < USERS_TTL_MS) {
    return usersCache.users;
  }
  const users = await fetchMcpUsers();
  usersCache = { fetchedAt: now, users };
  return users;
}

/** True when the email is a known user (present AND verified in mcp, or in AUTH_USERS). */
export async function isKnownUser(email?: string): Promise<boolean> {
  if (!email) return false;
  if (mcpInternalKey()) {
    const users = await getMcpUsersCached();
    return users.some((u) => u.email === email && Boolean(u.is_verified));
  }
  return legacyUsernames().includes(email);
}

/**
 * True when the email is a gateway admin: mcp users is_admin OR ADMIN_USERS
 * (comma-separated emails) — ADMIN_USERS applies in both modes.
 */
export async function isAdminUser(email?: string): Promise<boolean> {
  if (!email) return false;
  if (mcpInternalKey()) {
    const users = await getMcpUsersCached();
    if (users.some((u) => u.email === email && Boolean(u.is_admin))) return true;
  }
  return legacyIsAdminUser(email);
}

// ---- session validation ----------------------------------------------------

export interface SessionUser {
  email: string;
  isAdmin: boolean;
}

const SESSION_TTL_MS = 60_000;
let sessionCache: {
  cookie: string;
  fetchedAt: number;
  user: SessionUser | null;
} | null = null;

/**
 * Current identity from the shared `fp_session` cookie (SSO mode), validated
 * against mcp's GET /admin/api/session. Legacy mode (key unset) validates the
 * `fp-auth` cookie value against AUTH_USERS instead — same contract.
 *
 * Pass `cookieValue` to validate an explicit value (proxy.ts reads request
 * cookies directly; next/headers `cookies()` is unavailable there). Fetch
 * errors log and degrade to `null` — proxy and routes treat them as
 * unauthenticated and NEVER throw. Results are cached per cookie value for
 * SESSION_TTL_MS; an expired/cleared cookie falls through to a fresh check.
 */
export async function getSessionUser(cookieValue?: string): Promise<SessionUser | null> {
  if (mcpInternalKey()) {
    const cookie = cookieValue ?? (await cookies()).get("fp_session")?.value;
    if (!cookie) return null;
    const now = Date.now();
    if (sessionCache && sessionCache.cookie === cookie && now - sessionCache.fetchedAt < SESSION_TTL_MS) {
      return sessionCache.user;
    }
    let user: SessionUser | null = null;
    try {
      const res = await mcpFetch("/admin/api/session", {
        headers: { Cookie: `fp_session=${cookie}` },
      });
      const body = (await res.json()) as { ok?: boolean; email?: string; is_admin?: boolean };
      if (body.ok && typeof body.email === "string" && body.email) {
        user = { email: body.email, isAdmin: Boolean(body.is_admin) };
      }
    } catch (err) {
      // mcp unreachable / wrong internal key / HTTP error — degrade, don't throw.
      console.error("getSessionUser: fp_session validation failed:", err);
    }
    sessionCache = { cookie, fetchedAt: now, user };
    return user;
  }

  // Legacy AUTH_USERS fallback: identity is the fp-auth cookie value.
  const email = cookieValue ?? (await cookies()).get("fp-auth")?.value;
  if (!email || !legacyUsernames().includes(email)) return null;
  return { email, isAdmin: legacyIsAdminUser(email) };
}

/** Current user's email ("" when not logged in) — fp_session in SSO, fp-auth in legacy mode. */
export async function currentUsername(): Promise<string> {
  return (await getSessionUser())?.email ?? "";
}

// ---- legacy AUTH_USERS / ADMIN_USERS ---------------------------------------

/** Username/password from AUTH_USERS env: comma-separated name:password pairs. */
function legacyValidateCredentials(username: string, password: string): boolean {
  return (process.env.AUTH_USERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((part) => {
      const [name, ...rest] = part.split(":");
      return name.trim() === username && rest.join(":").trim() === password;
    });
}

/**
 * True when the username is listed in ADMIN_USERS (comma-separated usernames —
 * now email values). Gateway central admins manage every team's keys + create
 * teams; ordinary logged-in users see nothing (only champions/admins use the
 * gateway pages).
 */
function legacyIsAdminUser(username: string): boolean {
  return (process.env.ADMIN_USERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(username);
}

/** AUTH_USERS names only. */
function legacyUsernames(): string[] {
  return (process.env.AUTH_USERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => part.split(":")[0].trim());
}
