"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TrendPoint {
  date: string;
  count: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-40 w-full border border-border bg-card px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(42 17% 76%)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "hsl(30 9% 20%)" }}
            axisLine={{ stroke: "hsl(30 9% 40%)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(30 9% 20%)" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(42 24% 92%)",
              border: "1px solid hsl(30 9% 40%)",
              borderRadius: 2,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#a3271f"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#a3271f", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}