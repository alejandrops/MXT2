"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  AlertTriangle,
  Crown,
  Minus,
  Users,
} from "lucide-react";
import type {
  ActivityMetric,
  AnomalyRow,
  FleetAnalysisData,
} from "@/lib/queries";
import styles from "./AnalysisKpiStrip.module.css";

// ═══════════════════════════════════════════════════════════════
//  AnalysisKpiStrip · 4 tiles superiores
//  ─────────────────────────────────────────────────────────────
//  Resumen ejecutivo del período seleccionado:
//    1. Total flota (con delta vs período anterior)
//    2. Top vehículo (nombre + valor + barra contextual)
//    3. Promedio por vehículo (con delta · derivado de total/N)
//    4. Anomalías detectadas (count + lista resumida)
//
//  Las métricas reverse-sign (speedingCount, highEventCount) tienen
//  semantics invertida: subir es malo, bajar es bueno.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: FleetAnalysisData;
  formatValue: (v: number, metric: ActivityMetric) => string;
}

const REVERSE_SIGN_METRICS: ActivityMetric[] = [
  "speedingCount",
  "highEventCount",
];

export function AnalysisKpiStrip({ data, formatValue }: Props) {
  const isReverse = REVERSE_SIGN_METRICS.includes(data.metric);
  const top = data.rows[0] ?? null;
  const fleetSize = data.rows.length;
  const avgValue = fleetSize > 0 ? data.total / fleetSize : 0;
  const avgPrev =
    data.previousTotal !== null && fleetSize > 0
      ? data.previousTotal / fleetSize
      : null;
  const avgDelta = pct(avgValue, avgPrev);

  return (
    <div className={styles.strip}>
      {/* Tile 1 · Total flota */}
      <Tile
        icon={<Activity size={13} />}
        label="Total flota"
        primary={formatValue(data.total, data.metric)}
        delta={data.deltaPct}
        deltaPrevious={
          data.previousTotal !== null
            ? formatValue(data.previousTotal, data.metric)
            : null
        }
        isReverse={isReverse}
      />

      {/* Tile 2 · Top vehículo */}
      <Tile
        icon={<Crown size={13} />}
        label="Top vehículo"
        primary={top ? top.assetName : "—"}
        secondary={top ? formatValue(top.total, data.metric) : null}
        bar={
          top
            ? { value: top.total, max: data.total, label: "del total flota" }
            : null
        }
      />

      {/* Tile 3 · Promedio */}
      <Tile
        icon={<Users size={13} />}
        label="Promedio por vehículo"
        primary={formatValue(avgValue, data.metric)}
        secondary={
          fleetSize > 0
            ? `${fleetSize} ${fleetSize === 1 ? "vehículo" : "vehículos"}`
            : null
        }
        delta={avgDelta}
        deltaPrevious={
          avgPrev !== null ? formatValue(avgPrev, data.metric) : null
        }
        isReverse={isReverse}
      />

      {/* Tile 4 · Anomalías */}
      <AnomalyTile
        anomalies={data.anomalies}
        metric={data.metric}
        formatValue={formatValue}
        granularity={data.granularity}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Generic Tile
// ═══════════════════════════════════════════════════════════════

interface TileProps {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string | null;
  delta?: number | null;
  deltaPrevious?: string | null;
  isReverse?: boolean;
  bar?: { value: number; max: number; label: string } | null;
}

function Tile({
  icon,
  label,
  primary,
  secondary,
  delta,
  deltaPrevious,
  isReverse,
  bar,
}: TileProps) {
  return (
    <div className={styles.tile}>
      <header className={styles.tileHeader}>
        <span className={styles.tileIcon}>{icon}</span>
        <span className={styles.tileLabel}>{label}</span>
      </header>
      <div className={styles.tilePrimary}>{primary}</div>
      {secondary && <div className={styles.tileSecondary}>{secondary}</div>}
      {delta !== undefined && delta !== null && (
        <DeltaInline
          delta={delta}
          previous={deltaPrevious ?? null}
          isReverse={isReverse}
        />
      )}
      {bar && (
        <div className={styles.bar}>
          <div
            className={styles.barFill}
            style={{
              width: `${Math.min(100, (bar.value / bar.max) * 100)}%`,
            }}
          />
          <span className={styles.barLabel}>
            {Math.round((bar.value / bar.max) * 100)}% {bar.label}
          </span>
        </div>
      )}
    </div>
  );
}

function DeltaInline({
  delta,
  previous,
  isReverse,
}: {
  delta: number;
  previous: string | null;
  isReverse?: boolean;
}) {
  const trend =
    delta > 0.02 ? "up" : delta < -0.02 ? "down" : "flat";
  const sentiment =
    isReverse && trend === "up"
      ? styles.deltaBad
      : isReverse && trend === "down"
        ? styles.deltaGood
        : trend === "up"
          ? styles.deltaUp
          : trend === "down"
            ? styles.deltaDown
            : styles.deltaFlat;
  const Icon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <div className={`${styles.delta} ${sentiment}`}>
      <Icon size={11} />
      <span className={styles.deltaPct}>
        {(delta * 100 >= 0 ? "+" : "") + (delta * 100).toFixed(1)}%
      </span>
      {previous && (
        <span className={styles.deltaPrev}>vs {previous}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Anomaly Tile · variante con lista
// ═══════════════════════════════════════════════════════════════

function AnomalyTile({
  anomalies,
  metric,
  formatValue,
  granularity,
}: {
  anomalies: AnomalyRow[];
  metric: ActivityMetric;
  formatValue: (v: number, m: ActivityMetric) => string;
  granularity: FleetAnalysisData["granularity"];
}) {
  const noHistory =
    granularity === "year-weeks" || granularity === "year-months";
  const critical = anomalies.filter((a) => a.severity === "critical").length;
  const top3 = anomalies.slice(0, 3);

  return (
    <div className={`${styles.tile} ${styles.tileAnomaly}`}>
      <header className={styles.tileHeader}>
        <span className={styles.tileIcon}>
          <AlertTriangle
            size={13}
            className={
              critical > 0
                ? styles.iconCritical
                : anomalies.length > 0
                  ? styles.iconWarning
                  : ""
            }
          />
        </span>
        <span className={styles.tileLabel}>Anomalías detectadas</span>
      </header>

      {noHistory ? (
        <div className={styles.tilePrimary}>—</div>
      ) : (
        <>
          <div className={styles.tilePrimary}>{anomalies.length}</div>
          <div className={styles.tileSecondary}>
            {anomalies.length === 0
              ? "Comportamiento normal"
              : `${critical} críticas · ${anomalies.length - critical} warnings`}
          </div>
          {top3.length > 0 && (
            <ul className={styles.anomalyList}>
              {top3.map((a) => (
                <li key={a.assetId} className={styles.anomalyItem}>
                  <span
                    className={`${styles.anomalyDir} ${
                      a.direction === "high"
                        ? styles.anomalyHigh
                        : styles.anomalyLow
                    }`}
                  >
                    {a.direction === "high" ? "▲" : "▼"}
                  </span>
                  <span className={styles.anomalyName}>{a.assetName}</span>
                  <span className={styles.anomalyZ}>
                    z={a.zScore > 0 ? "+" : ""}
                    {a.zScore.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {noHistory && (
        <div className={styles.tileSecondary}>
          No aplica en vista anual
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function pct(cur: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return (cur - prev) / prev;
}
