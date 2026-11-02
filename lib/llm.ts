const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731";

export interface CompletionResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  model: string;
}

// ponytail: prices per 1M tokens, update from OpenRouter dashboard when the key is live.
const INPUT_PRICE = 0.3;
const OUTPUT_PRICE = 0.6;

export async function complete(opts: {
  system: string;
  user: string;
  model?: string;
  /** Abort the fetch after this long (default 90s). Card-style callers pass a shorter bound. */
  timeoutMs?: number;
  /**
   * OpenRouter reasoning control. `false` sends `reasoning: {enabled: false}` —
   * flash models otherwise spend thousands of hidden tokens thinking, which
   * tripled+ the latency of the dashboard AI-plans call (measured 2026-09).
   * Leave undefined for the model default.
   */
  reasoningEnabled?: boolean;
}): Promise<CompletionResult> {
  const model = opts.model || DEFAULT_MODEL;
  const apiKey = process.env.OPENROUTER_API || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API not configured");
  }
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.reasoningEnabled === false ? { reasoning: { enabled: false } } : {}),
    }),
    // Timebox the call — without this, a hung OpenRouter request spins the
    // dashboard's AI-plans suspense zone forever (reported as infinite loading).
    signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  const text = data.choices?.[0]?.message?.content ?? "";
  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const costUsd = (promptTokens / 1e6) * INPUT_PRICE + (completionTokens / 1e6) * OUTPUT_PRICE;
  return { text, promptTokens, completionTokens, costUsd, model };
}