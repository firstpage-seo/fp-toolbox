import { currentUsername } from "./auth";
import { getOutput, listOutputs } from "./outputs";
import { getClientData } from "./client-data";
import { runLlmTool } from "./tool-api";
import type { ClientBrief, GenerationData, RefineInput } from "./generator";

export interface ToolGenerateResult {
  output: unknown;
  model: string;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
}

/** Load the previous output for a refine request — only the owner can refine their own. */
export async function resolveRefine(
  body: Record<string, unknown>
): Promise<RefineInput | undefined> {
  const refineOutputId = body.refineOutputId;
  const instruction = body.refineInstruction;
  if (!refineOutputId || typeof instruction !== "string" || !instruction.trim()) {
    return undefined;
  }
  const user = (await currentUsername()) || "unknown";
  const prev = await getOutput(Number(refineOutputId));
  if (!prev || prev.userName !== user) {
    throw new Error("Previous output not found");
  }
  return { instruction: instruction.trim(), previous: prev.output };
}

/**
 * Shared run path for the client-data tools (pitch-deck / proposal): enrich
 * with the full client-data snapshot (GSC + GA4 + PSI + Ahrefs via
 * getClientData — tolerant, matched to the portfolio, memoized 1h), then
 * delegate the run (generate → log usage → persist output) to runLlmTool so
 * the LLM-tool path has a single source of truth.
 * Returns the saved output id.
 */
export async function runTool(opts: {
  toolSlug: string;
  brief: ClientBrief;
  refine?: RefineInput;
  generate: (brief: ClientBrief, data: GenerationData, refine?: RefineInput) => Promise<ToolGenerateResult>;
}): Promise<ToolGenerateResult & { outputId: number }> {
  const client = opts.brief.website ? await getClientData(opts.brief.website) : null;
  const data: GenerationData = {
    psi: client?.psi ?? null,
    competitors: client?.ahrefs ?? null,
    gsc: client?.gsc ?? null,
    ga4: client?.ga4 ?? null,
    aiVisibility: client?.aiVisibility ?? null,
  };

  return runLlmTool({
    toolSlug: opts.toolSlug,
    brief: opts.brief as unknown as Record<string, unknown>,
    refine: opts.refine,
    generate: (b, r) => opts.generate(b as unknown as ClientBrief, data, r),
  });
}

/** List a user's saved outputs for a tool (GET handler). */
export async function listUserOutputs(toolSlug: string) {
  const user = await currentUsername();
  if (!user) return null;
  return listOutputs(user, toolSlug);
}
