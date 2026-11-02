import { NextResponse } from "next/server";
import { currentUsername } from "@/lib/auth";
import {
  issueKey,
  GatewayConflictError,
  GatewayForbiddenError,
  GatewayNotFoundError,
} from "@/lib/gateway/service";

/**
 * POST /api/gateway/teams/[id]/keys — issue a fresh sub-key for the team
 * (champion of the team or admin). Body: { limitUsd, members?: string[] }.
 * Validates max_keys + credit pool; returns the plaintext key exactly once.
 */
export async function POST(
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
  const limitUsd = Number(body.limitUsd ?? NaN);
  const members = Array.isArray(body.members)
    ? (body.members as unknown[]).map((m) => String(m))
    : [];

  try {
    const issued = await issueKey(username, teamId, { limitUsd, members });
    return NextResponse.json({
      key: issued.key, // plaintext — shown once, never stored
      label: issued.label,
      message: "Key issued. It is shown only once — copy it now.",
    });
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
    console.error("gateway issueKey failed:", err);
    return NextResponse.json(
      { error: "Failed to issue key — check OPENROUTER_MANAGEMENT_KEY" },
      { status: 502 }
    );
  }
}
