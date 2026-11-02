/** Authentication through firstpage-mcp, with AUTH_USERS as the legacy fallback. */

import { cookies } from "next/headers";

export const MCP_DEFAULT_URL = "https://mcp.firstpage.com.hk";
const MCP_TIMEOUT_MS = 15_000;

export interface CredentialOk {
  ok: true;
  email: string;
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
      session_token?: string | null;
      expires_at?: string | null;
      message?: string;
    };
    if (body.ok) {
      return {
        ok: true,
        email: body.email ?? username,
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
    sessionToken: null,
    expiresAt: null,
  };
}

// ---- session validation ----------------------------------------------------

export interface SessionUser {
  email: string;
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
      const body = (await res.json()) as { ok?: boolean; email?: string };
      if (body.ok && typeof body.email === "string" && body.email) {
        user = { email: body.email };
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
  return { email };
}

/** Current user's email ("" when not logged in) — fp_session in SSO, fp-auth in legacy mode. */
export async function currentUsername(): Promise<string> {
  return (await getSessionUser())?.email ?? "";
}

// ---- legacy AUTH_USERS ---------------------------------------

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

/** AUTH_USERS names only. */
function legacyUsernames(): string[] {
  return (process.env.AUTH_USERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => part.split(":")[0].trim());
}
