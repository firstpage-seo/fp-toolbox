// Shared server-side helpers for tool API routes.
//
// Data tools: runQuery() — cookie user attribution + logUsage + tolerant errors.
// LLM tools: runLlmTool() — like lib/tool-runtime.ts's runTool but WITHOUT the
// hard-coded PSI/Ahrefs enrichment (each LLM tool supplies its own data via the
// generate() closure). Persists output + logs usage, returns outputId.
// Picker lists: getGscSites() / getGa4Properties() — the full client portfolio,
// memoized 1h via lib/cache.ts (752 GSC sites / 1000+ GA4 properties).

import { currentUsername } from "./auth";
import { logUsage } from "./usage";
import { saveOutput } from "./outputs";
import { cached } from "./cache";
import { mcpCall } from "./mcp";
import type { RefineInput } from "./generator";

// ---- portfolio pickers ------------------------------------------------------

export interface GscSite {
  siteUrl: string;
  displayName: string;
}

export interface Ga4Property {
  propertyId: string;
  displayName: string;
}

interface McpListItem {
  external_id?: string;
  display_name?: string;
}

function toGscSites(raw: unknown): GscSite[] {
  if (!Array.isArray(raw)) return [];
  const sites: GscSite[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const rec = (item ?? {}) as McpListItem;
    const siteUrl = String(rec.external_id ?? rec.display_name ?? "").trim();
    if (!siteUrl || seen.has(siteUrl)) continue;
    seen.add(siteUrl);
    sites.push({ siteUrl, displayName: String(rec.display_name ?? siteUrl).trim() });
  }
  return sites;
}

/** All accessible GSC sites — memoized 1h; [] on failure so pickers degrade. */
export async function getGscSites(): Promise<GscSite[]> {
  try {
    return await cached("tool-options:gsc-sites", async () =>
      toGscSites(await mcpCall("gsc_list_sites", {}))
    );
  } catch (err) {
    console.error("getGscSites failed:", err);
    return [];
  }
}

function toGa4Properties(raw: unknown): Ga4Property[] {
  if (!Array.isArray(raw)) return [];
  const props: Ga4Property[] = [];
  for (const item of raw) {
    const rec = (item ?? {}) as McpListItem;
    const externalId = String(rec.external_id ?? "").trim();
    const match = /^properties\/(\d+)$/.exec(externalId);
    if (!match) continue;
    props.push({
      propertyId: match[1],
      displayName: String(rec.display_name ?? externalId).trim(),
    });
  }
  return props;
}

/** All accessible GA4 properties (bare numeric ids) — memoized 1h; [] on failure. */
export async function getGa4Properties(): Promise<Ga4Property[]> {
  try {
    return await cached("tool-options:ga4-properties", async () =>
      toGa4Properties(await mcpCall("ga4_list_properties", {}))
    );
  } catch (err) {
    console.error("getGa4Properties failed:", err);
    return [];
  }
}

// ---- run paths --------------------------------------------------------------

export interface RunQueryResult {
  data: unknown;
  durationMs: number;
}

/**
 * Data-tool run path: attribute to the session user (fp_session in SSO, fp-auth
 * legacy), execute, log usage (0 tokens/cost). Rethrows so routes can map
 * errors to 4xx/5xx responses.
 */
export async function runQuery(opts: {
  toolSlug: string;
  action?: string;
  fetch: () => Promise<unknown>;
}): Promise<RunQueryResult> {
  const user = (await currentUsername()) || "unknown";
  const started = Date.now();
  try {
    const data = await opts.fetch();
    await logUsage({
      user,
      toolSlug: opts.toolSlug,
      action: opts.action ?? "run",
      durationMs: Date.now() - started,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
    });
    return { data, durationMs: Date.now() - started };
  } catch (err) {
    // Tolerant: still record the failed attempt so usage stats stay truthful.
    await logUsage({
      user,
      toolSlug: opts.toolSlug,
      action: opts.action ?? "run",
      durationMs: Date.now() - started,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
    }).catch(() => undefined);
    throw err;
  }
}

export interface ToolLlmResult {
  output: unknown;
  model: string;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
  outputId: number;
}

/** What a generate() closure must return — outputId is added by runLlmTool. */
export type ToolLlmGenerate = Omit<ToolLlmResult, "outputId">;

/**
 * LLM-tool run path (no automatic enrichment): attribute to the cookie user,
 * generate, log usage, persist output for history/refine. Each tool gathers its
 * own data inside the generate() closure and returns tokens/cost from lib/llm.
 */
export async function runLlmTool(opts: {
  toolSlug: string;
  brief: Record<string, unknown>;
  refine?: RefineInput;
  generate: (
    brief: Record<string, unknown>,
    refine?: RefineInput
  ) => Promise<ToolLlmGenerate>;
}): Promise<ToolLlmResult> {
  const user = (await currentUsername()) || "unknown";
  const started = Date.now();
  const result = await opts.generate(opts.brief, opts.refine);
  await logUsage({
    user,
    toolSlug: opts.toolSlug,
    action: opts.refine ? "refine" : "generate",
    durationMs: Date.now() - started,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    costUsd: result.costUsd,
  });
  const outputId = await saveOutput({
    user,
    toolSlug: opts.toolSlug,
    brief: opts.brief,
    output: result.output,
    model: result.model,
    costUsd: result.costUsd,
  });
  return { ...result, outputId };
}
