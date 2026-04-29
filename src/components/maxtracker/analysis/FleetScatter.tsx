"use client";

import { useState } from "react";
import type {
  ActivityMetric,
  FleetAnalysisData,
  FleetRow,
} from "@/lib/queries";
import styles from "./FleetScatter.module.css";

// ═══════════════════════════════════════════════════════════════
//  FleetScatter · scatter plot 2 métricas
//  ─────────────────────────────────────────────────────────────
//  Cada vehículo es un punto en el plano X/Y. Cuatro cuadrantes
//  divididos por la cruz de promedios · permite leer rápido:
//
//    ┌──────────────┬──────────────┐
//    │  X bajo,     │  X alto,     │
//    │  Y alto      │  Y alto      │  ← cuadrante a vigilar
//    │  (sospecha)  │  (intenso)   │     si Y es métrica negativa
//    ├──────────────┼──────────────┤
//    │  X bajo,     │  X alto,     │
//    │  Y bajo      │  Y bajo      │
//    │  (inactivo)  │  (eficiente) │
//    └──────────────┴──────────────┘
//
//  Etiquetas automáticas para los 5 outliers más alejados del
//  centro (distancia euclidea normalizada).
// ═══════════════════════════════════════════════════════════════

interface Props {
  dataX: FleetAnalysisData;
  dataY: FleetAnalysisData;
  invertY?: boolean;
  formatValue: (v: number, m: ActivityMetric) => string;
}

interface Point {
  row: FleetRow;
  x: number;
  y: number;
  dist: number; // distance from center · for outlier ranking
  isAnomaly: boolean;
}

export function FleetScatter({
  dataX,
  dataY,
  invertY = false,
  formatValue,
}: Props) {
  const [hover, setHover] = useState<{
    point: Point;
    cx: number;
    cy: number;
  } | null>(null);

  // Build map assetId → (x, y) values
  const xByAsset = new Map<string, number>();
  for (const r of dataX.rows) xByAsset.set(r.assetId, r.total);
  const yByAsset = new Map<string, number>();
  for (const r of dataY.rows) yByAsset.set(r.assetId, r.total);

  // Anomalies (any of the two metrics)
  const anomalyIds = new Set<string>();
  for (const a of dataX.anomalies) anomalyIds.add(a.assetId);
  for (const a of dataY.anomalies) anomalyIds.add(a.assetId);

  // Use rows from X (master) but require both X and Y to plot
  const points: Point[] = [];
  for (const r of dataX.rows) {
    const x = xByAsset.get(r.assetId) ?? 0;
    const y = yByAsset.get(r.assetId) ?? 0;
    points.push({
      row: r,
      x,
      y,
      dist: 0,
      isAnomaly: anomalyIds.has(r.assetId),
    });
  }

  if (points.length === 0) {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h2 className={styles.title}>Scatter</h2>
        </header>
        <div className={styles.empty}>
          Sin vehículos para los filtros aplicados.
        </div>
      </div>
    );
  }

  // Scales
  const maxX = Math.max(0.001, ...points.map((p) => p.x));
  const maxY = Math.max(0.001, ...points.map((p) => p.y));
  const avgX =
    points.reduce((acc, p) => acc + p.x, 0) / Math.max(1, points.length);
  const avgY =
    points.reduce((acc, p) => acc + p.y, 0) / Math.max(1, points.length);

  // Compute distance for outlier ranking · normalized to [0,1]² space
  for (const p of points) {
    const nx = p.x / maxX;
    const ny = p.y / maxY;
    const ax = avgX / maxX;
    const ay = avgY / maxY;
    p.dist = Math.sqrt((nx - ax) ** 2 + (ny - ay) ** 2);
  }

  // Top 5 outliers
  const outliers = [...points]
    .sort((a, b) => b.dist - a.dist)
    .slice(0, 5);

  // SVG dims
  const W = 600;
  const H = 380;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 44;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  function px(value: number) {
    return padL + (value / maxX) * innerW;
  }
  function py(value: number) {
    if (invertY) {
      return padT + (value / maxY) * innerH;
    }
    return padT + innerH - (value / maxY) * innerH;
  }

  // Tick generation · 4 ticks por eje
  const xTicks = makeTicks(maxX, 4);
  const yTicks = makeTicks(maxY, 4);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Correlación · {dataX.metricLabel} × {dataY.metricLabel}
          </h2>
          <p className={styles.sub}>
            {points.length}{" "}
            {points.length === 1 ? "vehículo" : "vehículos"} · cruz =
            promedio · más a la derecha = más{" "}
            {dataX.metricLabel.toLowerCase()} · más{" "}
            {invertY ? "abajo" : "arriba"} = más{" "}
            {dataY.metricLabel.toLowerCase()}
            {invertY && (
              <>
                {" "}<strong className={styles.invertHint}>· eje Y invertido</strong>
              </>
            )}
          </p>
        </div>
      </header>

      <div className={styles.plotWrap}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Axes background */}
          <rect
            x={padL}
            y={padT}
            width={innerW}
            height={innerH}
            className={styles.plotBg}
          />

          {/* Grid lines (subtle) */}
          {xTicks.map((t) => (
            <line
              key={`gx-${t}`}
              x1={px(t)}
              x2={px(t)}
              y1={padT}
              y2={padT + innerH}
              className={styles.gridLine}
            />
          ))}
          {yTicks.map((t) => (
            <line
              key={`gy-${t}`}
              x1={padL}
              x2={padL + innerW}
              y1={py(t)}
              y2={py(t)}
              className={styles.gridLine}
            />
          ))}

          {/* Cross of averages */}
          <line
            x1={px(avgX)}
            x2={px(avgX)}
            y1={padT}
            y2={padT + innerH}
            className={styles.avgLine}
          />
          <line
            x1={padL}
            x2={padL + innerW}
            y1={py(avgY)}
            y2={py(avgY)}
            className={styles.avgLine}
          />

          {/* Axis lines */}
          <line
            x1={padL}
            x2={padL}
            y1={padT}
            y2={padT + innerH}
            className={styles.axisLine}
          />
          <line
            x1={padL}
            x2={padL + innerW}
            y1={padT + innerH}
            y2={padT + innerH}
            className={styles.axisLine}
          />

          {/* Y axis ticks */}
          {yTicks.map((t) => (
            <g key={`yt-${t}`}>
              <line
                x1={padL - 3}
                x2={padL}
                y1={py(t)}
                y2={py(t)}
                className={styles.axisLine}
              />
              <text
                x={padL - 6}
                y={py(t)}
                className={styles.axisLabel}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {compactNum(t)}
              </text>
            </g>
          ))}

          {/* X axis ticks */}
          {xTicks.map((t) => (
            <g key={`xt-${t}`}>
              <line
                x1={px(t)}
                x2={px(t)}
                y1={padT + innerH}
                y2={padT + innerH + 3}
                className={styles.axisLine}
              />
              <text
                x={px(t)}
                y={padT + innerH + 14}
                className={styles.axisLabel}
                textAnchor="middle"
              >
                {compactNum(t)}
              </text>
            </g>
          ))}

          {/* Points · non-anomaly first, anomalies on top */}
          {points
            .filter((p) => !p.isAnomaly)
            .map((p) => (
              <circle
                key={p.row.assetId}
                cx={px(p.x)}
                cy={py(p.y)}
                r={3}
                className={styles.point}
                onMouseEnter={(e) =>
                  setHover({ point: p, cx: e.clientX, cy: e.clientY })
                }
                onMouseMove={(e) =>
                  setHover((prev) =>
                    prev ? { ...prev, cx: e.clientX, cy: e.clientY } : null,
                  )
                }
                onMouseLeave={() => setHover(null)}
              />
            ))}
          {points
            .filter((p) => p.isAnomaly)
            .map((p) => (
              <circle
                key={p.row.assetId}
                cx={px(p.x)}
                cy={py(p.y)}
                r={4.5}
                className={styles.pointAnomaly}
                onMouseEnter={(e) =>
                  setHover({ point: p, cx: e.clientX, cy: e.clientY })
                }
                onMouseMove={(e) =>
                  setHover((prev) =>
                    prev ? { ...prev, cx: e.clientX, cy: e.clientY } : null,
                  )
                }
                onMouseLeave={() => setHover(null)}
              />
            ))}

          {/* Outlier labels */}
          {outliers.map((p) => {
            const cx = px(p.x);
            const cy = py(p.y);
            const labelX = cx + 6;
            const labelY = cy - 4;
            return (
              <text
                key={`lbl-${p.row.assetId}`}
                x={labelX}
                y={labelY}
                className={styles.outlierLabel}
                textAnchor="start"
              >
                {p.row.assetName}
              </text>
            );
          })}

          {/* Axis titles */}
          <text
            x={padL + innerW / 2}
            y={H - 8}
            className={styles.axisTitle}
            textAnchor="middle"
          >
            {dataX.metricLabel} →
          </text>
          <text
            x={-(padT + innerH / 2)}
            y={14}
            className={styles.axisTitle}
            textAnchor="middle"
            transform="rotate(-90)"
          >
            {invertY ? "↓" : "↑"} {dataY.metricLabel}
            {invertY ? " (0 arriba)" : ""}
          </text>

          {/* Quadrant labels · esquinas internas, sutiles */}
          <text
            x={padL + 6}
            y={padT + 12}
            className={styles.quadLabel}
            textAnchor="start"
          >
            ← {dataX.metricLabel.toLowerCase()} · {invertY ? "↓" : "↑"}{" "}
            {dataY.metricLabel.toLowerCase()}
          </text>
          <text
            x={padL + innerW - 6}
            y={padT + 12}
            className={styles.quadLabel}
            textAnchor="end"
          >
            {dataX.metricLabel.toLowerCase()} → · {invertY ? "↓" : "↑"}{" "}
            {dataY.metricLabel.toLowerCase()}
          </text>
          <text
            x={padL + 6}
            y={padT + innerH - 6}
            className={styles.quadLabel}
            textAnchor="start"
          >
            ← {dataX.metricLabel.toLowerCase()} · {invertY ? "↑" : "↓"}{" "}
            {dataY.metricLabel.toLowerCase()}
          </text>
          <text
            x={padL + innerW - 6}
            y={padT + innerH - 6}
            className={styles.quadLabel}
            textAnchor="end"
          >
            {dataX.metricLabel.toLowerCase()} → · {invertY ? "↑" : "↓"}{" "}
            {dataY.metricLabel.toLowerCase()}
          </text>

          {/* Average labels · sobre la cruz */}
          <text
            x={px(avgX) + 5}
            y={padT + 24}
            className={styles.avgLabel}
            textAnchor="start"
          >
            x̄ {compactNum(avgX)}
          </text>
          <text
            x={padL + innerW - 4}
            y={py(avgY) - 4}
            className={styles.avgLabel}
            textAnchor="end"
          >
            ȳ {compactNum(avgY)}
          </text>
        </svg>

        {hover && (
          <div
            className={styles.tooltip}
            style={{ left: hover.cx + 12, top: hover.cy + 12 }}
          >
            <div className={styles.tooltipName}>{hover.point.row.assetName}</div>
            {hover.point.row.assetPlate && (
              <div className={styles.tooltipPlate}>
                {hover.point.row.assetPlate}
              </div>
            )}
            <div className={styles.tooltipMetric}>
              <span className={styles.tooltipLabel}>{dataX.metricLabel}</span>
              <span className={styles.tooltipValue}>
                {formatValue(hover.point.x, dataX.metric)}
              </span>
            </div>
            <div className={styles.tooltipMetric}>
              <span className={styles.tooltipLabel}>{dataY.metricLabel}</span>
              <span className={styles.tooltipValue}>
                {formatValue(hover.point.y, dataY.metric)}
              </span>
            </div>
            {hover.point.isAnomaly && (
              <div className={styles.tooltipAnomaly}>⚠ Anomalía detectada</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function makeTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const step = max / count;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(step * i);
  }
  return ticks;
}

function compactNum(v: number): string {
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1_000)}k`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  if (v >= 10) return Math.round(v).toString();
  return v.toFixed(1);
}
