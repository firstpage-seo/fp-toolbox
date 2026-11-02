import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets pass through (files with an extension: images, manifest, etc.)
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || /\.[a-z0-9]+$/i.test(pathname)) {
    return NextResponse.next();
  }

  // API routes handle their own auth
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Gate on the session being VALID (validated against mcp /admin/api/session
  // with a 60s cache inside getSessionUser): the fp_session cookie in SSO
  // mode, the legacy fp-auth cookie otherwise. Fetch errors degrade to
  // unauthenticated. request cookies are passed explicitly because
  // next/headers cookies() is unavailable in the proxy.
  const cookieValue = process.env.FP_MCP_INTERNAL_KEY
    ? request.cookies.get("fp_session")?.value
    : request.cookies.get("fp-auth")?.value;
  const isLoggedIn = Boolean(await getSessionUser(cookieValue));

  // Public paths
  if (pathname === "/toolbox" || pathname === "/login") {
    if (isLoggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Not logged in → toolbox
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/toolbox", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Static files never hit the auth gate — includes all public icons/manifest/logo
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|android-chrome-192x192.png|android-chrome-512x512.png|site.webmanifest|logo.png|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};