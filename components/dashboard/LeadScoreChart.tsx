"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface LeadScoreDatum {
  name: string;
  value: number;
}

const COLORS: Record<string, string> = {
  "Good leads": "oklch(0.55 0.14 152)",
  Spam: "oklch(0.62 0.2 22 / 0.75)",
};

interface LeadScoreChartProps {
  data: LeadScoreDatum[];
}

/** Good-vs-spam donut with a centered share label — design-ref HubSpot leads donut. */
export default function LeadScoreChart({ data }: LeadScoreChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        No leads in this period yet.
      </p>
    );
  }
  const goodPct = Math.round(((data.find((d) => d.name === "Good leads")?.value ?? 0) / total) * 100);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={82}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={COLORS[d.name] ?? "#787878"} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [String(value), ""]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-[30px] font-extrabold text-navy leading-none">{goodPct}%</div>
          <div className="text-[11px] text-muted">good leads</div>
        </div>
      </div>
    </div>
  );
}
