"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  ActivityMetric,
  FleetAnalysisData,
  FleetRow,
} from "@/lib/queries";
import styles from "./FleetSmallMultiples.module.css";

// ═══════════════════════════════════════════════════════════════
//  FleetSmallMultiples · grilla de mini-line charts
//  ─────────────────────────────────────────────────────────────
//  Idea Tufte clásica: pequeñas réplicas idénticas que permiten
//  comparar 30+ series sin colapsar.
//
//  Reglas:
//    · Misma escala Y (max global) · comparación válida entre cards
//    · Línea horizontal del promedio del vehículo · referencia
//    · Sin grilla · solo el path
//    · Marca de pico (max) · puntito sutil
//    · Fill leve bajo la curva para dar peso visual
//    · Anomalías marcadas con borde rojo en la card
//    · Click en card va al perfil del vehículo
//
//  Default top 30 · botón para ver todos.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: FleetAnalysisData;
  formatValue: (v: number, m: ActivityMetric) => string;
}

const REVERSE_SIGN_METRICS: ActivityMetric[] = [
  "speedingCount",
  "highEventCount",
];

export function FleetSmallMultiples({ data, formatValue }: Props) {
  const [showAll, setShowAll] = useState(false);

  const rows = data.rows;
  const visibleRows = showAll ? rows : rows.slice(0, 30);

  // Escala Y compartida · max de todas las celdas
  const maxY = data.rows.reduce((m, r) => {
    for (const c of r.cells) if (c.value > m) m = c.value;
    return m;
  }, 0);

  const isReverse = REVERSE_SIGN_METRICS.includes(data.metric);
  const anomalyById = new Map(data.anomalies.map((a) => [a.assetId, a]));

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Small multiples · {data.metricLabel}
          </h2>
          <p className={styles.sub}>
            {rows.length}{" "}
            {rows.length === 1 ? "vehículo" : "vehículos"} · misma escala
            vertical · línea punteada = promedio del vehículo · borde rojo
            = anomalía
          </p>
        </div>
        <div className={styles.scaleNote}>
          <span className={styles.scaleLabel}>Escala Y</span>
          <span className={styles.scaleValue}>
            0 → {formatValue(maxY, data.metric)}
          </span>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          Sin vehículos para los filtros aplicados.
        </div>
      ) : (
        <div className={styles.grid}>
          {visibleRows.map((row) => {
            const anomaly = anomalyById.get(row.assetId);
            const anomalyClass = anomaly
              ? anomaly.direction === "high"
                ? isReverse
                  ? styles.cardAnomalyBad
                  : styles.cardAnomalyHigh
                : isReverse
                  ? styles.cardAnomalyGood
                  : styles.cardAnomalyLow
              : "";
            return (
              <Link
                key={row.assetId}
                href={`/objeto/vehiculo/${row.assetId}`}
                className={`${styles.card} ${anomalyClass}`}
              >
                <header className={styles.cardHeader}>
                  <span className={styles.cardName} title={row.assetName}>
                    {row.assetName}
                  </span>
                  {row.assetPlate && (
                    <span className={styles.cardPlate}>
                      {row.assetPlate}
                    </span>
                  )}
                </header>
                <Spark
                  row={row}
                  maxY={maxY}
                  formatValue={(v) => formatValue(v, data.metric)}
                />
                <footer className={styles.cardFooter}>
                  <span className={styles.cardTotal}>
                    {formatValue(row.total, data.metric)}
                  </span>
                  {anomaly && (
                    <span
                      className={`${styles.zBadge} ${
                        anomaly.severity === "critical"
                          ? styles.zBadgeCritical
                          : styles.zBadgeWarning
                      }`}
                    >
                      {anomaly.direction === "high" ? "▲" : "▼"} z=
                      {anomaly.zScore > 0 ? "+" : ""}
                      {anomaly.zScore.toFixed(1)}
                    </span>
                  )}
                </footer>
              </Link>
            );
          })}
        </div>
      )}

      {rows.length > 30 && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? `Mostrar solo top 30`
              : `Mostrar todos · ${rows.length}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Spark · mini line chart SVG
// ═══════════════════════════════════════════════════════════════

function Spark({
  row,
  maxY,
  formatValue,
}: {
  row: FleetRow;
  maxY: number;
  formatValue: (v: number) => string;
}) {
  const cells = row.cells;
  if (cells.length === 0 || maxY <= 0) {
    return <div className={styles.sparkEmpty}>—</div>;
  }

  const W = 100; // viewBox width units
  const H = 30; // viewBox height units
  const denom = cells.length > 1 ? cells.length - 1 : 1;

  // Build path · scale x by cells, y inverted
  const pts = cells.map((c, i) => ({
    x: (i / denom) * W,
    y: H - (c.value / maxY) * H,
  }));
  const linePath =
    pts.length > 0
      ? `M ${pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L ")}`
      : "";
  // Area path · cierra con la base
  const areaPath =
    pts.length > 0
      ? `${linePath} L ${W},${H} L 0,${H} Z`
      : "";

  // Average per row
  const avg = row.total / Math.max(1, cells.length);
  const avgY = H - (avg / maxY) * H;

  // Peak point
  const peakIdx = cells.reduce(
    (best, c, i) => (c.value > cells[best]!.value ? i : best),
    0,
  );
  const peak = pts[peakIdx];
  const peakValue = cells[peakIdx]?.value ?? 0;

  return (
    <div className={styles.sparkWrap}>
      <svg
        className={styles.spark}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-label={`Tendencia · pico ${formatValue(peakValue)}`}
      >
        {/* Area fill leve */}
        <path d={areaPath} className={styles.sparkArea} />
        {/* Línea de promedio · punteada */}
        <line
          x1={0}
          x2={W}
          y1={avgY}
          y2={avgY}
          className={styles.sparkAvg}
        />
        {/* Línea principal */}
        <path d={linePath} className={styles.sparkLine} />
        {/* Punto de pico */}
        {peak && (
          <circle
            cx={peak.x}
            cy={peak.y}
            r={1.4}
            className={styles.sparkPeak}
          />
        )}
      </svg>
    </div>
  );
}
