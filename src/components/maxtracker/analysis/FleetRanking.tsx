"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  ActivityMetric,
  AnalysisGranularity,
  FleetAnalysisData,
  FleetRow,
} from "@/lib/queries";
import styles from "./FleetRanking.module.css";

// ═══════════════════════════════════════════════════════════════
//  FleetRanking · vista de barras horizontales ordenadas
//  ─────────────────────────────────────────────────────────────
//  Anatomía Tufte:
//    · Barras de tinta plena · sin gradientes ni decoración
//    · Línea vertical en cada fila marcando el promedio · anchor
//      visual para detectar outliers (gap = anomalía)
//    · Sin grid lines · solo la barra y el dato
//    · Anomalías marcadas con borde rojo en la barra
//
//  Vehículos ya vienen ordenados por total desc desde el server.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: FleetAnalysisData;
  formatValue: (v: number, m: ActivityMetric) => string;
  onDrill?: (date: string, drillTo: AnalysisGranularity) => void;
}

const REVERSE_SIGN_METRICS: ActivityMetric[] = [
  "speedingCount",
  "highEventCount",
];

export function FleetRanking({ data, formatValue }: Props) {
  const [showAll, setShowAll] = useState(false);

  const rows = data.rows;
  const visibleRows = showAll ? rows : rows.slice(0, 30);
  const max = Math.max(0, ...rows.map((r) => r.total));
  const avg = rows.length > 0
    ? data.metric === "maxSpeedKmh"
      ? max
      : data.total / rows.length
    : 0;

  const anomalyById = new Map(
    data.anomalies.map((a) => [a.assetId, a]),
  );

  const isReverse = REVERSE_SIGN_METRICS.includes(data.metric);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Ranking · {data.metricLabel}
          </h2>
          <p className={styles.sub}>
            {rows.length} {rows.length === 1 ? "vehículo" : "vehículos"} ·
            ordenados de mayor a menor · línea vertical = promedio
          </p>
        </div>
        <div className={styles.scaleNote}>
          <div className={styles.scaleItem}>
            <span className={styles.scaleSwatch} data-kind="bar" />
            <span>Valor del período</span>
          </div>
          <div className={styles.scaleItem}>
            <span className={styles.scaleSwatch} data-kind="avg" />
            <span>Promedio · {formatValue(avg, data.metric)}</span>
          </div>
          {data.anomalies.length > 0 && (
            <div className={styles.scaleItem}>
              <span className={styles.scaleSwatch} data-kind="anomaly" />
              <span>Anomalía</span>
            </div>
          )}
        </div>
      </header>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          Sin vehículos para los filtros aplicados.
        </div>
      ) : (
        <ol className={styles.list}>
          {visibleRows.map((row, idx) => {
            const anomaly = anomalyById.get(row.assetId);
            const widthPct = max > 0 ? (row.total / max) * 100 : 0;
            const avgPct = max > 0 ? (avg / max) * 100 : 0;
            return (
              <li key={row.assetId} className={styles.row}>
                <span className={styles.rank}>{idx + 1}</span>
                <div className={styles.assetCell}>
                  <Link
                    href={`/gestion/vehiculos/${row.assetId}`}
                    className={styles.assetLink}
                  >
                    {row.assetName}
                  </Link>
                  {row.assetPlate && (
                    <span className={styles.plate}>{row.assetPlate}</span>
                  )}
                </div>
                <div className={styles.barWrap}>
                  <div className={styles.barTrack}>
                    <div
                      className={`${styles.barFill} ${
                        anomaly
                          ? anomaly.direction === "high"
                            ? isReverse
                              ? styles.barAnomalyBad
                              : styles.barAnomalyHigh
                            : isReverse
                              ? styles.barAnomalyGood
                              : styles.barAnomalyLow
                          : ""
                      }`}
                      style={{ width: `${widthPct}%` }}
                      title={
                        anomaly
                          ? `Anomalía · z-score ${anomaly.zScore > 0 ? "+" : ""}${anomaly.zScore.toFixed(2)}`
                          : undefined
                      }
                    />
                    {avgPct > 0 && avgPct <= 100 && (
                      <div
                        className={styles.avgMarker}
                        style={{ left: `${avgPct}%` }}
                      />
                    )}
                  </div>
                </div>
                <span className={styles.valueCell}>
                  {formatValue(row.total, data.metric)}
                </span>
                {anomaly && (
                  <span
                    className={`${styles.anomalyBadge} ${
                      anomaly.severity === "critical"
                        ? styles.anomalyBadgeCritical
                        : styles.anomalyBadgeWarning
                    }`}
                    title={`Promedio histórico: ${formatValue(anomaly.historicalMean, data.metric)} · σ: ${formatValue(anomaly.historicalStd, data.metric)}`}
                  >
                    {anomaly.direction === "high" ? "▲" : "▼"} z=
                    {anomaly.zScore > 0 ? "+" : ""}
                    {anomaly.zScore.toFixed(1)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
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
