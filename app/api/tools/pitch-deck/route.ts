import { NextResponse } from "next/server";
import { generateDeck } from "@/lib/generator";
import { runTool, resolveRefine, listUserOutputs } from "@/lib/tool-runtime";

function parseBrief(body: Record<string, unknown>) {
  return {
    clientName: String(body.clientName || ""),
    industry: String(body.industry || ""),
    objective: String(body.objective || ""),
    targetMarket: String(body.targetMarket || ""),
    budget: String(body.budget || ""),
    website: String(body.website || ""),
    notes: String(body.notes || ""),
  };
}

export async function GET() {
  const outputs = await listUserOutputs("pitch-deck");
  if (!outputs) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ outputs });
}

export async function POST(request: Request) {
  const body = await request.json();
  const brief = parseBrief(body);
  if (!brief.clientName || !brief.industry || !brief.objective) {
    return NextResponse.json({ error: "clientName, industry and objective are required" }, { status: 400 });
  }

  let refine;
  try {
    refine = await resolveRefine(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }

  const result = await runTool({
    toolSlug: "pitch-deck",
    brief,
    refine,
    generate: async (b, data, r) => {
      const res = await generateDeck(b, data, r);
      return {
        output: res.deck,
        model: res.model,
        costUsd: res.costUsd,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
      };
    },
  });

  return NextResponse.json({
    deck: result.output,
    outputId: result.outputId,
    meta: { model: result.model, costUsd: result.costUsd },
  });
}
