"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { LeadTrendPoint } from "@/lib/dashboard";

interface LeadTrendChartProps {
  data: LeadTrendPoint[];
}

/** Daily lead volume over the last 30 days — design-ref HubSpot leads chart. */
export default function LeadTrendChart({ data }: LeadTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="leadArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.55 0.14 152 / 0.3)" />
            <stop offset="100%" stopColor="oklch(0.55 0.14 152 / 0)" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#787878" }}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11, fill: "#787878" }} allowDecimals={false} />
        <Tooltip
          formatter={(value) => [String(value), "Leads"]}
          labelFormatter={(label) => String(label)}
        />
        <Area
          type="monotone"
          dataKey="leads"
          name="Leads"
          stroke="oklch(0.55 0.14 152)"
          strokeWidth={2.5}
          fill="url(#leadArea)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
