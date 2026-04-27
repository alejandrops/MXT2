"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { TrendPoint } from "@/lib/queries";
import styles from "./TrendLine.module.css";

interface Props {
  points: TrendPoint[];
  label: string;
  formatValue: (v: number) => string;
}

export function TrendLine({ points, label, formatValue }: Props) {
  if (points.length === 0) {
    return <div className={styles.empty}>Sin datos para graficar.</div>;
  }

  // Recharts data shape
  const chartData = points.map((p) => ({
    x: p.label,
    y: p.value,
    iso: p.iso,
  }));

  // Reduce X-axis label density when there are many points
  const tickInterval =
    points.length > 30
      ? Math.floor(points.length / 8)
      : points.length > 12
        ? Math.floor(points.length / 6)
        : 0;

  return (
    <div className={styles.wrap}>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(0,0,0,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            interval={tickInterval}
            axisLine={{ stroke: "rgba(0,0,0,0.1)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(v) => abbreviate(v)}
          />
          <Tooltip
            contentStyle={{
              fontFamily:
                "var(--f, -apple-system, BlinkMacSystemFont, sans-serif)",
              fontSize: 11,
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 4,
              padding: "6px 10px",
            }}
            labelStyle={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}
            formatter={(v: number) => [formatValue(v), label]}
          />
          <Area
            type="monotone"
            dataKey="y"
            stroke="#2563eb"
            strokeWidth={1.5}
            fill="url(#trendFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function abbreviate(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  if (v % 1 === 0) return String(v);
  return v.toFixed(1);
}
