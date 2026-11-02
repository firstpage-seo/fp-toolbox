import { NextResponse } from "next/server";
import { currentUsername } from "@/lib/auth";
import {
  revokeKey,
  updateKeyLimit,
  GatewayConflictError,
  GatewayForbiddenError,
  GatewayNotFoundError,
} from "@/lib/gateway/service";

/** DELETE /api/gateway/keys/[id] — revoke a key (champion of its team or admin). */
export async function DELETE(
  _request: Request,
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

  try {
    await revokeKey(username, keyId);
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
    console.error("gateway revokeKey failed:", err);
    return NextResponse.json({ error: "Failed to revoke key" }, { status: 502 });
  }
}

/** PATCH /api/gateway/keys/[id] — adjust an issued key's monthly limit. Body: { limitUsd }. */
export async function PATCH(
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
  const limitUsd = Number(body.limitUsd ?? NaN);

  try {
    await updateKeyLimit(username, keyId, limitUsd);
    return NextResponse.json({ ok: true, limitUsd });
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
    console.error("gateway updateKeyLimit failed:", err);
    return NextResponse.json({ error: "Failed to update key limit" }, { status: 502 });
  }
}
