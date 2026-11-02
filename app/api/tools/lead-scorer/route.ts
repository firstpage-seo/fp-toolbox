import { NextResponse } from "next/server";
import { getRecentLeads } from "@/lib/hubspot";
import { scoreLead } from "@/lib/hubspot";
import { runQuery } from "@/lib/tool-api";

const LABEL_ORDER = { hot: 0, warm: 1, cold: 2 } as const;

export async function POST(request: Request) {
  const body = await request.json();
  const days = Math.min(30, Math.max(1, Number(body.days) || 7));
  try {
    const { data } = await runQuery({
      toolSlug: "lead-scorer",
      fetch: async () => {
        const leads = await getRecentLeads(days);
        const scored = await Promise.all(
          leads.map(async (l) => {
            const s = await scoreLead(l.email, l.website);
            return {
              id: l.id,
              name: l.name,
              email: l.email,
              website: l.website,
              createdAt: l.createdAt,
              score: s.score,
              label: s.label,
              reasons: s.reasons,
            };
          })
        );
        scored.sort(
          (a, b) =>
            LABEL_ORDER[a.label] - LABEL_ORDER[b.label] ||
            b.score - a.score
        );
        const counts = { hot: 0, warm: 0, cold: 0 };
        for (const l of scored) counts[l.label]++;
        return { days, total: scored.length, counts, leads: scored.slice(0, 100) };
      },
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
