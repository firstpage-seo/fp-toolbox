import { NextResponse } from "next/server";
import { currentUsername } from "@/lib/auth";
import { setAction, getActions, ACTION_STATUSES, type ActionStatus } from "@/lib/onsite-audit/actions";

/**
 * POST /api/tools/onsite-audit/actions   body {domain, itemId, status, note} -> upsert -> {actions}
 * GET  /api/tools/onsite-audit/actions?domain=X -> {actions}
 *
 * Manual-action tracking is keyed by client domain (shared across users), so
 * progress survives re-runs of the same site.
 */
export async function POST(request: Request) {
  const user = (await currentUsername()) || "unknown";
  const body = await request.json().catch(() => ({}));
  const domain = String(body.domain || "").trim().toLowerCase();
  const itemId = String(body.itemId || "").trim();
  const status = String(body.status || "").trim() as ActionStatus;
  const note = String(body.note || "").trim();

  if (!domain || !itemId) {
    return NextResponse.json({ error: "domain and itemId are required" }, { status: 400 });
  }
  if (!ACTION_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ACTION_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }
  try {
    await setAction({ domain, itemId, status, note, user });
    const actions = await getActions(domain);
    return NextResponse.json({ actions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = String(searchParams.get("domain") || "").trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ error: "domain query param is required" }, { status: 400 });
  }
  try {
    const actions = await getActions(domain);
    return NextResponse.json({ actions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
