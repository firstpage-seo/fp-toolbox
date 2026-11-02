import { NextResponse } from "next/server";
import { currentUsername } from "@/lib/auth";
import { logUsage } from "@/lib/usage";
import { listOutputs, getOutput } from "@/lib/outputs";
import { getActions } from "@/lib/onsite-audit/actions";
import { startAuditJob, getAuditJob } from "@/lib/onsite-audit/jobs";

/**
 * POST  /api/tools/onsite-audit             body {url} -> start a job -> {jobId, progress}
 * GET   /api/tools/onsite-audit?jobId=X     -> {progress, result?}
 * GET   /api/tools/onsite-audit?outputId=N  -> {output} (a past saved run)
 * GET   /api/tools/onsite-audit             -> {history: [...]} (saved runs for this user)
 *
 * The audit runs in the background (job registry) because a full-site crawl +
 * external collection can exceed a single request. Poll GET until progress.status
 * is "done" or "error", then read the result. Every completed run is persisted.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const url = String(body.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid http(s) url is required" }, { status: 400 });
  }
  const user = (await currentUsername()) || "unknown";
  const { jobId, progress } = startAuditJob(url, user);
  await logUsage({
    user,
    toolSlug: "onsite-audit",
    action: "run",
    durationMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    costUsd: 0,
  }).catch(() => undefined);
  return NextResponse.json({ jobId, progress });
}

export async function GET(request: Request) {
  const user = (await currentUsername()) || "unknown";
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const outputId = searchParams.get("outputId");

  if (outputId) {
    const id = Number.parseInt(outputId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid outputId" }, { status: 400 });
    }
    const output = await getOutput(id);
    if (!output) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const out = output.output as { domain?: string };
    const actions = out.domain ? await getActions(out.domain) : [];
    return NextResponse.json({ output: output.output, actions });
  }

  if (jobId) {
    const job = getAuditJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.progress.status === "done" && job.result) {
      return NextResponse.json({ progress: job.progress, result: job.result });
    }
    return NextResponse.json({ progress: job.progress });
  }

  // No params -> history of saved runs for this user.
  const runs = await listOutputs(user, "onsite-audit");
  const history = runs.map((r) => {
    const out = (r.output ?? {}) as { domain?: string; summary?: { passed: number; failed: number; warned: number; manual: number } };
    return {
      id: r.id,
      domain: out.domain ?? "",
      createdAt: r.createdAt,
      summary: out.summary ?? null,
    };
  });
  return NextResponse.json({ history });
}
