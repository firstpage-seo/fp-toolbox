import { NextResponse } from "next/server";
import { currentUsername } from "@/lib/auth";
import {
  updateTeamLimits,
  GatewayConflictError,
  GatewayForbiddenError,
  GatewayNotFoundError,
} from "@/lib/gateway/service";

/** PATCH /api/gateway/teams/[id] — adjust team credit pool / key count (admin only). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teamId = Number(id);
  if (!Number.isInteger(teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: { creditUsd?: number; maxKeys?: number } = {};
  if (body.creditUsd !== undefined) {
    const v = Number(body.creditUsd);
    if (!Number.isFinite(v) || v <= 0) {
      return NextResponse.json({ error: "creditUsd must be a positive number" }, { status: 400 });
    }
    patch.creditUsd = v;
  }
  if (body.maxKeys !== undefined) {
    const v = Number(body.maxKeys);
    if (!Number.isInteger(v) || v < 1) {
      return NextResponse.json({ error: "maxKeys must be an integer ≥ 1" }, { status: 400 });
    }
    patch.maxKeys = v;
  }

  try {
    const team = await updateTeamLimits(username, teamId, patch);
    return NextResponse.json({ team });
  } catch (err) {
    if (err instanceof GatewayForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof GatewayNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof GatewayConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("gateway updateTeamLimits failed:", err);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
}
