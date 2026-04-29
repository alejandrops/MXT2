"use client";

import { useState } from "react";
import type {
  ActivityMetric,
  FleetAnalysisData,
  FleetRow,
} from "@/lib/queries";
import styles from "./FleetBoxPlot.module.css";

// ═══════════════════════════════════════════════════════════════
//  FleetBoxPlot · box plot horizontal por grupo
//  ─────────────────────────────────────────────────────────────
//  Cada grupo de vehículos es una "caja" con su distribución:
//    · línea = mediana (Q2)
//    · caja  = Q1 a Q3 (IQR)
//    · whiskers = 1.5 × IQR
//    · outliers = puntos fuera de whiskers (con etiqueta)
//
//  Detecta heterogeneidad operativa · grupos con cajas anchas
//  tienen alta varianza · candidatos a investigar.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: FleetAnalysisData;
  formatValue: (v: number, m: ActivityMetric) => string;
}

interface GroupStats {
  name: string;
  values: { row: FleetRow; v: number }[];
  q1: number;
  q2: number;
  q3: number;
  whiskerLow: number;
  whiskerHigh: number;
  outliers: { row: FleetRow; v: number }[];
}

export function FleetBoxPlot({ data, formatValue }: Props) {
  const [hover, setHover] = useState<{
    name: string;
    cx: number;
    cy: number;
  } | null>(null);

  // Agrupar rows por groupName (los sin grupo van a "Sin grupo")
  const groupMap = new Map<string, { row: FleetRow; v: number }[]>();
  for (const r of data.rows) {
    const key = r.groupName ?? "Sin grupo";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push({ row: r, v: r.total });
  }

  if (groupMap.size === 0) {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h2 className={styles.title}>Box plot</h2>
        </header>
        <div className={styles.empty}>
          Sin datos para los filtros aplicados.
        </div>
      </div>
    );
  }

  // Calcular stats por grupo
  const stats: GroupStats[] = [];
  for (const [name, items] of groupMap.entries()) {
    if (items.length === 0) continue;
    const sorted = [...items].sort((a, b) => a.v - b.v);
    const q1 = quantile(sorted.map((s) => s.v), 0.25);
    const q2 = quantile(sorted.map((s) => s.v), 0.5);
    const q3 = quantile(sorted.map((s) => s.v), 0.75);
    const iqr = q3 - q1;
    const whiskerLowTarget = q1 - 1.5 * iqr;
    const whiskerHighTarget = q3 + 1.5 * iqr;
    const inWhiskers = sorted.filter(
      (s) => s.v >= whiskerLowTarget && s.v <= whiskerHighTarget,
    );
    const whiskerLow =
      inWhiskers.length > 0 ? inWhiskers[0]!.v : sorted[0]!.v;
    const whiskerHigh =
      inWhiskers.length > 0 ? inWhiskers[inWhiskers.length - 1]!.v : sorted[sorted.length - 1]!.v;
    const outliers = sorted.filter(
      (s) => s.v < whiskerLow || s.v > whiskerHigh,
    );
    stats.push({ name, values: sorted, q1, q2, q3, whiskerLow, whiskerHigh, outliers });
  }
  // Sort por mediana desc
  stats.sort((a, b) => b.q2 - a.q2);

  const globalMax = Math.max(0.001, ...data.rows.map((r) => r.total));
  const globalMin = Math.min(0, ...data.rows.map((r) => r.total));

  // SVG
  const W = 720;
  const padL = 180;
  const padR = 24;
  const padT = 24;
  const padB = 36;
  const innerW = W - padL - padR;
  const ROW_H = 36;
  const H = padT + stats.length * ROW_H + padB;

  function px(v: number) {
    return padL + ((v - globalMin) / (globalMax - globalMin)) * innerW;
  }

  // X ticks
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(
    (f) => globalMin + f * (globalMax - globalMin),
  );

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Distribución por grupo · {data.metricLabel}
          </h2>
          <p className={styles.sub}>
            {stats.length}{" "}
            {stats.length === 1 ? "grupo" : "grupos"} · caja = Q1 a Q3 ·
            línea central = mediana · whiskers = 1.5 × IQR · puntos = outliers
          </p>
        </div>
      </header>

      <div className={styles.svgWrap}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
          {/* Grid */}
          {xTicks.map((t, i) => (
            <line
              key={`gx-${i}`}
              x1={px(t)}
              x2={px(t)}
              y1={padT}
              y2={padT + stats.length * ROW_H}
              className={styles.grid}
            />
          ))}

          {/* X axis */}
          <line
            x1={padL}
            x2={padL + innerW}
            y1={padT + stats.length * ROW_H}
            y2={padT + stats.length * ROW_H}
            className={styles.axis}
          />
          {xTicks.map((t, i) => (
            <text
              key={`tx-${i}`}
              x={px(t)}
              y={padT + stats.length * ROW_H + 16}
              textAnchor="middle"
              className={styles.axisLabel}
            >
              {compactNum(t)}
            </text>
          ))}

          {/* Boxes */}
          {stats.map((g, i) => {
            const cy = padT + i * ROW_H + ROW_H / 2;
            const boxTop = cy - 8;
            const boxH = 16;
            return (
              <g key={g.name}>
                {/* Group label */}
                <text
                  x={padL - 8}
                  y={cy}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className={styles.groupLabel}
                >
                  {g.name}
                </text>
                <text
                  x={padL - 8}
                  y={cy + 11}
                  textAnchor="end"
                  className={styles.groupCount}
                >
                  n={g.values.length}
                </text>

                {/* Whisker line */}
                <line
                  x1={px(g.whiskerLow)}
                  x2={px(g.whiskerHigh)}
                  y1={cy}
                  y2={cy}
                  className={styles.whisker}
                />
                {/* Whisker caps */}
                <line
                  x1={px(g.whiskerLow)}
                  x2={px(g.whiskerLow)}
                  y1={cy - 5}
                  y2={cy + 5}
                  className={styles.whisker}
                />
                <line
                  x1={px(g.whiskerHigh)}
                  x2={px(g.whiskerHigh)}
                  y1={cy - 5}
                  y2={cy + 5}
                  className={styles.whisker}
                />
                {/* Box */}
                <rect
                  x={px(g.q1)}
                  y={boxTop}
                  width={Math.max(2, px(g.q3) - px(g.q1))}
                  height={boxH}
                  className={styles.box}
                />
                {/* Median */}
                <line
                  x1={px(g.q2)}
                  x2={px(g.q2)}
                  y1={boxTop}
                  y2={boxTop + boxH}
                  className={styles.median}
                />
                {/* Outliers */}
                {g.outliers.map((o) => (
                  <circle
                    key={o.row.assetId}
                    cx={px(o.v)}
                    cy={cy}
                    r={3}
                    className={styles.outlier}
                    onMouseEnter={(e) =>
                      setHover({
                        name: `${o.row.assetName} · ${formatValue(o.v, data.metric)}`,
                        cx: e.clientX,
                        cy: e.clientY,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {hover && (
          <div
            className={styles.tooltip}
            style={{ left: hover.cx + 12, top: hover.cy + 12 }}
          >
            {hover.name}
          </div>
        )}
      </div>
    </div>
  );
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base]! + rest * (sorted[base + 1]! - sorted[base]!);
  }
  return sorted[base]!;
}

function compactNum(v: number): string {
  if (v === 0) return "0";
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 1_000)}k`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return Math.round(v).toString();
}
