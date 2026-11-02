import { NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { runLlmTool } from "@/lib/tool-api";
import { resolveRefine, listUserOutputs } from "@/lib/tool-runtime";
import type { RefineInput } from "@/lib/generator";

export interface FaqInput {
  question: string;
  answer: string;
}

export interface FaqItem extends FaqInput {
  paraphrase: string;
}

const MAX_FAQS = 100;

export async function GET() {
  const outputs = await listUserOutputs("faq-paraphrase");
  if (!outputs) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ outputs });
}

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

export async function POST(request: Request) {
  const body = await request.json();
  const raw: unknown = body.faqs;
  const tone = String(body.tone || "brand-safe, professional").slice(0, 200);
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "faqs must be a non-empty array" }, { status: 400 });
  }
  if (raw.length > MAX_FAQS) {
    return NextResponse.json({ error: `Up to ${MAX_FAQS} FAQs per run` }, { status: 400 });
  }
  const faqs: FaqInput[] = [];
  for (const item of raw) {
    const rec = (item ?? {}) as Record<string, unknown>;
    const question = String(rec.question ?? "").trim();
    const answer = String(rec.answer ?? "").trim();
    if (!question || !answer) {
      return NextResponse.json({ error: "Every FAQ needs a non-empty question and answer" }, { status: 400 });
    }
    faqs.push({ question, answer });
  }

  let refine: RefineInput | undefined;
  try {
    refine = await resolveRefine(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }

  const result = await runLlmTool({
    toolSlug: "faq-paraphrase",
    brief: { faqs, tone, clientName: `${faqs.length} FAQ items` },
    refine,
    generate: async (b, r) => {
      const inputFaqs = (b.faqs as FaqInput[]) ?? faqs;
      const system =
        "You are the content editor at First Page Digital, a Hong Kong SEO agency. " +
        "Paraphrase FAQ answers so they read naturally, stay factually identical, and fit the given brand tone. " +
        "Do not change meaning, figures, or instructions. Remove filler, tighten wording, and make it friendly and clear. " +
        "Output STRICT JSON only: {\"items\":[{\"question\": string, \"paraphrase\": string}]} — one item per input FAQ, with the question reused verbatim.";
      let user = `Brand tone: ${b.tone}\n\n## FAQs\n` +
        inputFaqs.map((f, i) => `${i + 1}. Question: ${f.question}\n   Answer: ${f.answer}`).join("\n\n");
      if (r) {
        user += `\n\n## Previous Version\n${JSON.stringify(r.previous)}\n\n## Refine Instruction\n${r.instruction}\n\nRevise ONLY what the instruction asks. Keep everything else identical. Output the same JSON shape as before.`;
      }
      const res = await complete({ system, user });
      const parsed = parseJson<{ items: { question: string; paraphrase: string }[] }>(res.text);
      const items: FaqItem[] = inputFaqs.map((f, i) => {
        const hit = parsed.items?.find(
          (o) => o.question?.trim().toLowerCase() === f.question.trim().toLowerCase()
        );
        return {
          question: f.question,
          answer: f.answer,
          paraphrase: (hit?.paraphrase ?? parsed.items?.[i]?.paraphrase ?? "").trim(),
        };
      });
      return {
        output: items,
        model: res.model,
        costUsd: res.costUsd,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
      };
    },
  });

  return NextResponse.json({
    items: result.output,
    outputId: result.outputId,
    meta: { model: result.model, costUsd: result.costUsd },
  });
}