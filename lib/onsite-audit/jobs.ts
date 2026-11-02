// Onsite SEO Audit — in-memory job registry for long-running audits.
//
// A crawl of dozens of pages can't fit in a single HTTP request, so the API
// creates a job (POST), polls progress (GET), and fetches the result (GET) once
// status is "done". Single-instance assumption (same as uptime-scheduler):
// jobs live in this process's memory only — but every completed run is
// persisted to `tool_outputs` (compact result) so the history survives restarts.

import { runAudit } from "./engine";
import { saveOutput } from "@/lib/outputs";
import type { AuditProgress, AuditResult } from "./types";

interface Job {
  target: string;
  progress: AuditProgress;
  result: AuditResult | null;
  error: string | null;
  outputId: number | null;
}

const jobs = new Map<string, Job>();
let counter = 0;

function newJobId(): string {
  counter += 1;
  return `audit-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** Compact shape persisted to tool_outputs (crawl detail omitted; page only renders sections). */
export function compactResult(r: AuditResult): Record<string, unknown> {
  return {
    target: r.target,
    domain: r.domain,
    jobId: r.jobId,
    sections: r.sections,
    summary: r.summary,
    manualActions: r.manualActions,
    llmSummary: r.llmSummary,
    generatedAt: r.generatedAt,
    crawlStats: {
      pages: r.crawl.pages.length,
      indexed: r.crawl.indexed,
      byStatus: r.crawl.byStatus,
      capped: r.crawl.capped,
    },
  };
}

/** Start an audit in the background; persist the compact result on completion. */
export function startAuditJob(target: string, user: string): { jobId: string; progress: AuditProgress } {
  const jobId = newJobId();
  const base: AuditProgress = {
    jobId,
    status: "queued",
    phase: "Queued",
    pagesCrawled: 0,
    pagesTotal: 0,
    message: "Job queued.",
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(jobId, { target, progress: base, result: null, error: null, outputId: null });

  void runAudit(target, jobId, {
    onProgress: (p) => {
      const job = jobs.get(jobId);
      if (job) {
        job.progress = p;
        job.progress.status = p.status;
      }
    },
  })
    .then((result) => {
      const job = jobs.get(jobId);
      if (!job) return;
      job.result = result;
      job.progress = {
        ...job.progress,
        status: "done",
        phase: "Done",
        pagesCrawled: result.crawl.pages.length,
        pagesTotal: result.crawl.pages.length,
        message: `Audit complete (${result.summary.failed} issues, ${result.summary.manual} manual steps).`,
        updatedAt: Date.now(),
      };
      // Persist the run so history survives restarts.
      saveOutput({
        user,
        toolSlug: "onsite-audit",
        brief: { url: target },
        output: compactResult(result),
        model: "",
        costUsd: 0,
      })
        .then((id) => {
          job.outputId = id;
          job.progress = { ...job.progress, message: `Audit complete — saved as run #${id}.` };
        })
        .catch((err) => console.error("onsite-audit saveOutput failed:", err));
    })
    .catch((err) => {
      const job = jobs.get(jobId);
      if (!job) return;
      job.error = err instanceof Error ? err.message : String(err);
      job.progress = {
        ...job.progress,
        status: "error",
        phase: "Error",
        message: job.error,
        updatedAt: Date.now(),
      };
    });

  return { jobId, progress: base };
}

export function getAuditJob(jobId: string): Job | null {
  return jobs.get(jobId) ?? null;
}
