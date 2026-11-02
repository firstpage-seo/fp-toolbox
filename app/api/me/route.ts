import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/**
 * GET /api/me — current session identity (fp_session in SSO mode, fp-auth
 * legacy). Powers NavBar auth state client-side; no personal data beyond the
 * identity itself.
 */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({
    loggedIn: Boolean(user),
    username: user?.email ?? null,
    isAdmin: user?.isAdmin ?? false,
  });
}