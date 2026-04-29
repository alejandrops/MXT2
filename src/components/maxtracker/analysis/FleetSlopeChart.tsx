"use client";

import { useState } from "react";
import type {
  ActivityMetric,
  FleetAnalysisData,
} from "@/lib/queries";
import styles from "./FleetSlopeChart.module.css";

// ═══════════════════════════════════════════════════════════════
//  FleetSlopeChart · slope chart Tufte
//  ─────────────────────────────────────────────────────────────
//  Compara cada vehículo entre el período anterior y el actual.
//  Cada vehículo es una línea recta entre 2 puntos:
//
//    Período anterior         Período actual
//    ────────                 ────────
//    ●────────────────────────●     paralela = sin cambio
//    ● ╲                            
//        ╲────────────────●         baja
//    ●─────────────────╱──●
//                  ╱           cruzan = cambio de ranking
//    ●─────╱──────────────●         sube
//
//  Outliers (top 5 por |delta|) tienen etiqueta con nombre y valores.
//  Resto van sin label · solo línea sutil.
//
//  Color por dirección · invertido para métricas reverse-sign.
// ═══════════════════════════════════════════════════════════════

const REVERSE_SIGN_METRICS: ActivityMetric[] = [
  "speedingCount",
  "highEventCount",
];

interface Props {
  data: FleetAnalysisData;
  formatValue: (v: number, m: ActivityMetric) => string;
}

export function FleetSlopeChart({ data, formatValue }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const isReverse = REVERSE_SIGN_METRICS.includes(data.metric);

  // Solo las filas con histórico tienen sentido en slope chart
  const rows = data.rows.filter((r) => r.previousTotal !== null);

  if (rows.length === 0) {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h2 className={styles.title}>Slope chart</h2>
        </header>
        <div className={styles.empty}>
          No hay histórico del período anterior para comparar.
        </div>
      </div>
    );
  }

  // Max para escala Y
  const maxValue = Math.max(
    ...rows.map((r) => Math.max(r.total, r.previousTotal ?? 0)),
  );

  // Outliers · top 5 por |delta|
  const withDelta = rows.map((r) => ({
    row: r,
    delta: r.total - (r.previousTotal ?? 0),
    absDelta: Math.abs(r.total - (r.previousTotal ?? 0)),
  }));
  const outliers = [...withDelta]
    .sort((a, b) => b.absDelta - a.absDelta)
    .slice(0, 5);
  const outlierIds = new Set(outliers.map((o) => o.row.assetId));

  // SVG dims
  const W = 700;
  const labelLeftW = 150;
  const labelRightW = 150;
  const padT = 36;
  const padB = 24;
  const innerW = W - labelLeftW - labelRightW;
  // Altura proporcional al número de filas con un mínimo
  const H = Math.max(380, 32 + rows.length * 12);
  const innerH = H - padT - padB;

  function py(value: number) {
    if (maxValue <= 0) return padT + innerH;
    return padT + innerH - (value / maxValue) * innerH;
  }

  const xLeft = labelLeftW;
  const xRight = labelLeftW + innerW;

  // Y ticks · 4 ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxValue);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Variación · {data.metricLabel}
          </h2>
          <p className={styles.sub}>
            {rows.length} {rows.length === 1 ? "vehículo" : "vehículos"} ·
            cada línea conecta el valor del período anterior con el actual ·
            etiquetas en los 5 mayores cambios{" "}
            {isReverse && (
              <strong className={styles.reverseHint}>
                · subir = peor (métrica negativa)
              </strong>
            )}
          </p>
        </div>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span
              className={`${styles.legendSwatch} ${
                isReverse ? styles.colorBad : styles.colorUp
              }`}
            />
            <span>{isReverse ? "Empeoró" : "Subió"}</span>
          </div>
          <div className={styles.legendItem}>
            <span
              className={`${styles.legendSwatch} ${
                isReverse ? styles.colorGood : styles.colorDown
              }`}
            />
            <span>{isReverse ? "Mejoró" : "Bajó"}</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.colorFlat}`} />
            <span>Sin cambio</span>
          </div>
        </div>
      </header>

      <div className={styles.svgWrap}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.svg}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Period column headers */}
          <text
            x={xLeft}
            y={padT - 16}
            textAnchor="middle"
            className={styles.periodLabel}
          >
            Período anterior
          </text>
          <text
            x={xRight}
            y={padT - 16}
            textAnchor="middle"
            className={styles.periodLabel}
          >
            {truncate(data.periodLabel, 24)}
          </text>

          {/* Y-axis grid (ticks horizontales sutiles) */}
          {yTicks.map((t) => (
            <line
              key={`g-${t}`}
              x1={xLeft}
              x2={xRight}
              y1={py(t)}
              y2={py(t)}
              className={styles.gridLine}
            />
          ))}

          {/* Vertical column lines */}
          <line
            x1={xLeft}
            x2={xLeft}
            y1={padT}
            y2={padT + innerH}
            className={styles.colLine}
          />
          <line
            x1={xRight}
            x2={xRight}
            y1={padT}
            y2={padT + innerH}
            className={styles.colLine}
          />

          {/* Slopes · render non-outliers first (background), outliers on top */}
          {rows
            .filter((r) => !outlierIds.has(r.assetId))
            .map((r) => (
              <SlopeLine
                key={r.assetId}
                assetId={r.assetId}
                yPrev={py(r.previousTotal ?? 0)}
                yNow={py(r.total)}
                xLeft={xLeft}
                xRight={xRight}
                delta={r.total - (r.previousTotal ?? 0)}
                isReverse={isReverse}
                isHover={hoverId === r.assetId}
                onHoverEnter={() => setHoverId(r.assetId)}
                onHoverLeave={() => setHoverId(null)}
                isOutlier={false}
              />
            ))}
          {rows
            .filter((r) => outlierIds.has(r.assetId))
            .map((r) => (
              <SlopeLine
                key={r.assetId}
                assetId={r.assetId}
                yPrev={py(r.previousTotal ?? 0)}
                yNow={py(r.total)}
                xLeft={xLeft}
                xRight={xRight}
                delta={r.total - (r.previousTotal ?? 0)}
                isReverse={isReverse}
                isHover={hoverId === r.assetId}
                onHoverEnter={() => setHoverId(r.assetId)}
                onHoverLeave={() => setHoverId(null)}
                isOutlier
              />
            ))}

          {/* Labels · solo outliers o el hovered */}
          {rows.map((r) => {
            const isOutlier = outlierIds.has(r.assetId);
            const isHover = hoverId === r.assetId;
            if (!isOutlier && !isHover) return null;
            const yPrev = py(r.previousTotal ?? 0);
            const yNow = py(r.total);
            return (
              <g key={`lbl-${r.assetId}`} className={styles.labels}>
                <text
                  x={xLeft - 8}
                  y={yPrev}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className={styles.labelLeft}
                >
                  <tspan className={styles.labelName}>{r.assetName}</tspan>
                  <tspan className={styles.labelValue}>
                    {"  "}
                    {formatValue(r.previousTotal ?? 0, data.metric)}
                  </tspan>
                </text>
                <text
                  x={xRight + 8}
                  y={yNow}
                  textAnchor="start"
                  dominantBaseline="middle"
                  className={styles.labelRight}
                >
                  <tspan className={styles.labelValue}>
                    {formatValue(r.total, data.metric)}
                    {"  "}
                  </tspan>
                  <tspan className={styles.labelName}>{r.assetName}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SlopeLine · una línea entre dos puntos
// ═══════════════════════════════════════════════════════════════

function SlopeLine({
  assetId,
  yPrev,
  yNow,
  xLeft,
  xRight,
  delta,
  isReverse,
  isHover,
  isOutlier,
  onHoverEnter,
  onHoverLeave,
}: {
  assetId: string;
  yPrev: number;
  yNow: number;
  xLeft: number;
  xRight: number;
  delta: number;
  isReverse: boolean;
  isHover: boolean;
  isOutlier: boolean;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}) {
  const trend =
    Math.abs(delta) < 0.001
      ? "flat"
      : delta > 0
        ? "up"
        : "down";

  const colorClass =
    isReverse && trend === "up"
      ? styles.colorBad
      : isReverse && trend === "down"
        ? styles.colorGood
        : trend === "up"
          ? styles.colorUp
          : trend === "down"
            ? styles.colorDown
            : styles.colorFlat;

  const groupClass = `${styles.slope} ${colorClass} ${
    isOutlier ? styles.outlier : ""
  } ${isHover ? styles.hover : ""}`;

  return (
    <g
      className={groupClass}
      data-asset={assetId}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <line
        x1={xLeft}
        x2={xRight}
        y1={yPrev}
        y2={yNow}
        className={styles.slopeLine}
      />
      <circle cx={xLeft} cy={yPrev} r={2.5} className={styles.slopeDot} />
      <circle cx={xRight} cy={yNow} r={2.5} className={styles.slopeDot} />
    </g>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
