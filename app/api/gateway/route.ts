import { NextResponse } from "next/server";
import { createTeam } from "@/lib/gateway/db";
import { getTeamsView } from "@/lib/gateway/service";
import { currentUsername, isAdminUser, isKnownUser } from "@/lib/auth";

/**
 * GET /api/gateway — the logged-in user's role-scoped view.
 * Admin: all teams + keys. Champion: own team's keys. Member: own key only.
 */
export async function GET() {
  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const view = await getTeamsView(username);
    return NextResponse.json(view);
  } catch (err) {
    console.error("gateway getTeamsView failed:", err);
    return NextResponse.json({ error: "Gateway unavailable — check database and OPENROUTER_MANAGEMENT_KEY" }, { status: 500 });
  }
}

/** POST /api/gateway — create a team (admin only). */
export async function POST(request: Request) {
  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdminUser(username))) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const champion = String(body.champion ?? "").trim();
  const defaultLimit = Number(process.env.GATEWAY_TEAM_LIMIT_USD) || 30;
  const creditUsd = Number(body.creditUsd ?? defaultLimit);
  const maxKeys = Number(body.maxKeys ?? 1);
  if (!name || !champion) {
    return NextResponse.json({ error: "name and champion are required" }, { status: 400 });
  }
  if (!(await isKnownUser(champion))) {
    return NextResponse.json({ error: `champion "${champion}" is not a known user` }, { status: 400 });
  }
  if (!Number.isFinite(creditUsd) || creditUsd <= 0) {
    return NextResponse.json({ error: "creditUsd must be a positive number" }, { status: 400 });
  }
  if (!Number.isInteger(maxKeys) || maxKeys < 1) {
    return NextResponse.json({ error: "maxKeys must be an integer ≥ 1" }, { status: 400 });
  }

  try {
    const team = await createTeam({ name, champion, creditUsd, maxKeys });
    return NextResponse.json({ team }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Team name already exists" }, { status: 409 });
    }
    console.error("gateway createTeam failed:", err);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
