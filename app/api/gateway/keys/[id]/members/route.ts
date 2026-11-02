import { NextResponse } from "next/server";
import { currentUsername } from "@/lib/auth";
import {
  assignMember,
  removeMember,
  GatewayConflictError,
  GatewayForbiddenError,
  GatewayNotFoundError,
} from "@/lib/gateway/service";

/** POST /api/gateway/keys/[id]/members — bind a user to a key (max 2 per key). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const keyId = Number(id);
  if (!Number.isInteger(keyId)) {
    return NextResponse.json({ error: "Invalid key id" }, { status: 400 });
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
  const memberUsername = String(body.username ?? "").trim();
  if (!memberUsername) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  try {
    await assignMember(username, keyId, memberUsername);
    return NextResponse.json({ ok: true });
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
    console.error("gateway assignMember failed:", err);
    return NextResponse.json({ error: "Failed to assign member" }, { status: 500 });
  }
}

/** DELETE /api/gateway/keys/[id]/members?username=... — unbind a user. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const keyId = Number(id);
  if (!Number.isInteger(keyId)) {
    return NextResponse.json({ error: "Invalid key id" }, { status: 400 });
  }

  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const memberUsername = String(new URL(request.url).searchParams.get("username") ?? "").trim();
  if (!memberUsername) {
    return NextResponse.json({ error: "username query param is required" }, { status: 400 });
  }

  try {
    await removeMember(username, keyId, memberUsername);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GatewayForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof GatewayNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("gateway removeMember failed:", err);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
