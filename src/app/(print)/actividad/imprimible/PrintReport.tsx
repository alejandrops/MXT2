"use client";

import { Printer } from "lucide-react";
import type {
  ActivityMetric,
  DriversMultiMetricData,
  FleetAnalysisData,
  FleetMultiMetricData,
} from "@/lib/queries";
import styles from "./PrintReport.module.css";

// ═══════════════════════════════════════════════════════════════
//  PrintReport · imprimible unificado · 3 períodos en 1 componente
//  ─────────────────────────────────────────────────────────────
//  Reemplaza:
//    /imprimible/semanal/WeeklyPrintReport.tsx
//    /imprimible/mensual/MonthlyPrintReport.tsx (estaba en repo)
//    /imprimible/anual/AnnualPrintReport.tsx
//
//  Layout idéntico para los 3 · solo cambia:
//    · período del header (semanal/mensual/anual)
//    · granularidad del bar chart (días/días/meses)
//    · escala numérica usada (compact en anual)
//
//  Estructura:
//    Página 1 · Header marca + 4 KPIs + bars + Top 5 + tabla
//    Página 2 (opcional) · Tabla de conductores
//
//  Tufte aplicado:
//    · sin sombras · sin gradients
//    · radius mínimo
//    · color solo en delta (color como excepción)
// ═══════════════════════════════════════════════════════════════

export type PrintPeriod = "semanal" | "mensual" | "anual";

const PERIOD_LABELS: Record<PrintPeriod, string> = {
  semanal: "Reporte Semanal",
  mensual: "Reporte Mensual",
  anual: "Reporte Anual",
};

const DELTA_LABELS: Record<PrintPeriod, string> = {
  semanal: "vs semana anterior",
  mensual: "vs mes anterior",
  anual: "vs año anterior",
};

const TREND_LABELS: Record<PrintPeriod, string> = {
  semanal: "Distancia por día",
  mensual: "Distancia por día",
  anual: "Distancia por mes",
};

const FLEET_COLS: { key: ActivityMetric; label: string }[] = [
  { key: "distanceKm", label: "Km" },
  { key: "activeMin", label: "Horas" },
  { key: "idleMin", label: "Idle" },
  { key: "tripCount", label: "Viajes" },
  { key: "eventCount", label: "Eventos" },
  { key: "speedingCount", label: "Excesos" },
  { key: "maxSpeedKmh", label: "Vmax" },
];

interface Props {
  period: PrintPeriod;
  analysis: FleetAnalysisData;
  fleetMulti: FleetMultiMetricData;
  driversMulti: DriversMultiMetricData;
}

export function PrintReport({
  period,
  analysis,
  fleetMulti,
  driversMulti,
}: Props) {
  function handlePrint() {
    window.print();
  }

  const totalKm = fleetMulti.totals.distanceKm.value;
  const totalKmDelta = fleetMulti.totals.distanceKm.deltaPct;
  const totalActive = fleetMulti.totals.activeMin.value;
  const totalEvents = fleetMulti.totals.eventCount.value;
  const totalEventsDelta = fleetMulti.totals.eventCount.deltaPct;
  const fleetSize = fleetMulti.rows.length;
  const activeFleet = fleetMulti.rows.filter(
    (r) => r.metrics.distanceKm.value > 0,
  ).length;

  const top5 = [...fleetMulti.rows]
    .sort((a, b) => b.metrics.distanceKm.value - a.metrics.distanceKm.value)
    .slice(0, 5);

  const totalPages = driversMulti.rows.length > 0 ? 2 : 1;
  const isAnnual = period === "anual";

  return (
    <div className={styles.report}>
      <div className={styles.floatActions}>
        <button type="button" className={styles.printBtn} onClick={handlePrint}>
          <Printer size={14} />
          <span>Imprimir / Guardar PDF</span>
        </button>
      </div>

      {/* ── Página 1 ──────────────────────────────────────── */}
      <section className={styles.page}>
        <header className={styles.docHeader}>
          <div className={styles.brand}>
            <span className={styles.brandWord}>maxtracker</span>
            <span className={styles.brandSubtitle}>Fleet IoT</span>
          </div>
          <div className={styles.docMeta}>
            <h1 className={styles.docTitle}>{PERIOD_LABELS[period]}</h1>
            <div className={styles.docPeriod}>{analysis.periodLabel}</div>
            <div className={styles.docSub}>{analysis.periodSubLabel}</div>
          </div>
        </header>

        <div className={styles.kpiGrid}>
          <KpiTile
            label="Distancia"
            value={fmt(totalKm, isAnnual)}
            unit="km"
            delta={totalKmDelta}
            deltaLabel={DELTA_LABELS[period]}
          />
          <KpiTile
            label="Horas activas"
            value={fmtH(totalActive)}
            unit="h"
          />
          <KpiTile
            label="Eventos"
            value={Math.round(totalEvents).toLocaleString("es-AR")}
            delta={totalEventsDelta}
            deltaLabel={DELTA_LABELS[period]}
            isReverse
          />
          <KpiTile
            label="Flota activa"
            value={`${activeFleet} / ${fleetSize}`}
            unit="vehíc."
          />
        </div>

        <div className={styles.dailyTrend}>
          <h3 className={styles.subTitle}>{TREND_LABELS[period]}</h3>
          <TrendBars trend={analysis.trend} />
        </div>

        <div className={styles.topSection}>
          <h3 className={styles.subTitle}>Top 5 · más km en el período</h3>
          <ol className={styles.topList}>
            {top5.map((r, i) => (
              <li key={r.assetId} className={styles.topItem}>
                <span className={styles.topIdx}>{i + 1}</span>
                <span className={styles.topName}>{r.assetName}</span>
                <span className={styles.topValue}>
                  {fmt(r.metrics.distanceKm.value, isAnnual)} km
                </span>
              </li>
            ))}
          </ol>
        </div>

        <h2 className={styles.sectionTitle}>Detalle por vehículo</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Vehículo</th>
              <th className={styles.th}>Patente</th>
              {FLEET_COLS.map((c) => (
                <th key={c.key} className={`${styles.th} ${styles.alignRight}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fleetMulti.rows.map((row) => (
              <tr key={row.assetId}>
                <td className={styles.td}>{row.assetName}</td>
                <td className={styles.td}>
                  <span className={styles.plate}>{row.assetPlate ?? "—"}</span>
                </td>
                {FLEET_COLS.map((c) => (
                  <td
                    key={c.key}
                    className={`${styles.td} ${styles.alignRight} ${styles.num}`}
                  >
                    {fmtMetric(row.metrics[c.key].value, c.key, isAnnual)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <footer className={styles.pageFooter}>
          <span>Maxtracker Fleet IoT</span>
          <span>
            Página 1 / {totalPages}
          </span>
        </footer>
      </section>

      {/* ── Página 2 · Conductores · opcional ─────────────── */}
      {driversMulti.rows.length > 0 && (
        <section className={styles.page}>
          <header className={styles.docHeaderSmall}>
            <span className={styles.brandWordSmall}>maxtracker</span>
            <span className={styles.docTitleSmall}>
              {PERIOD_LABELS[period]} · {analysis.periodLabel}
            </span>
          </header>

          <h2 className={styles.sectionTitle}>Detalle por conductor</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Conductor</th>
                <th className={`${styles.th} ${styles.alignCenter}`}>Vehíc.</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Km</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Horas</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Viajes</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Eventos</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Excesos</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Críticos</th>
              </tr>
            </thead>
            <tbody>
              {driversMulti.rows.map((row) => (
                <tr key={row.personId}>
                  <td className={styles.td}>{row.personName}</td>
                  <td className={`${styles.td} ${styles.alignCenter}`}>
                    {row.vehiclesUsed}
                  </td>
                  <td className={`${styles.td} ${styles.alignRight} ${styles.num}`}>
                    {fmtMetric(
                      row.metrics.distanceKm.value,
                      "distanceKm",
                      isAnnual,
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.alignRight} ${styles.num}`}>
                    {fmtMetric(
                      row.metrics.activeMin.value,
                      "activeMin",
                      isAnnual,
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.alignRight} ${styles.num}`}>
                    {Math.round(row.metrics.tripCount.value)}
                  </td>
                  <td className={`${styles.td} ${styles.alignRight} ${styles.num}`}>
                    {Math.round(row.metrics.eventCount.value)}
                  </td>
                  <td className={`${styles.td} ${styles.alignRight} ${styles.num}`}>
                    {Math.round(row.metrics.speedingCount.value)}
                  </td>
                  <td className={`${styles.td} ${styles.alignRight} ${styles.num}`}>
                    {Math.round(row.metrics.highEventCount.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <footer className={styles.pageFooter}>
            <span>Maxtracker Fleet IoT</span>
            <span>Página 2 / 2</span>
          </footer>
        </section>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

function KpiTile({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  isReverse = false,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  deltaLabel?: string;
  isReverse?: boolean;
}) {
  return (
    <div className={styles.kpiTile}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValueRow}>
        <span className={styles.kpiValue}>{value}</span>
        {unit && <span className={styles.kpiUnit}>{unit}</span>}
      </div>
      {delta !== undefined && delta !== null && (
        <div
          className={`${styles.kpiDelta} ${
            isReverse
              ? delta > 0
                ? styles.kpiBad
                : delta < 0
                  ? styles.kpiGood
                  : styles.kpiFlat
              : delta > 0
                ? styles.kpiUp
                : delta < 0
                  ? styles.kpiDown
                  : styles.kpiFlat
          }`}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "·"}{" "}
          {Math.abs(delta * 100).toFixed(0)}%{deltaLabel ? ` ${deltaLabel}` : ""}
        </div>
      )}
    </div>
  );
}

function TrendBars({
  trend,
}: {
  trend: { value: number; label: string }[];
}) {
  if (trend.length === 0) {
    return <div className={styles.empty}>Sin datos</div>;
  }
  const max = Math.max(0.001, ...trend.map((t) => t.value));
  const W = 720,
    H = 80,
    padL = 32,
    padR = 8,
    padT = 4,
    padB = 18;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const barW = (innerW / trend.length) * 0.7;
  const gap = (innerW / trend.length) * 0.3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.barsSvg}>
      {trend.map((t, i) => {
        const x = padL + i * (innerW / trend.length) + gap / 2;
        const h = (t.value / max) * innerH;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} className={styles.bar} />
            <text
              x={x + barW / 2}
              y={padT + innerH + 12}
              textAnchor="middle"
              className={styles.barLbl}
            >
              {t.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function fmt(v: number, isAnnual: boolean): string {
  if (isAnnual && v >= 10_000) {
    return `${(v / 1_000).toFixed(1)}k`;
  }
  return v.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtH(min: number): string {
  if (min <= 0) return "0";
  return Math.floor(min / 60).toLocaleString("es-AR");
}

function fmtMetric(
  v: number,
  m: ActivityMetric,
  isAnnual: boolean,
): string {
  if (m === "distanceKm" || m === "fuelLiters") {
    return fmt(v, isAnnual);
  }
  if (m === "maxSpeedKmh") return Math.round(v).toLocaleString("es-AR");
  if (m === "activeMin" || m === "idleMin") {
    if (v <= 0) return "0h";
    const h = Math.floor(v / 60);
    const mn = Math.round(v % 60);
    if (h === 0) return `${mn}m`;
    return mn === 0 ? `${h}h` : `${h}h${String(mn).padStart(2, "0")}`;
  }
  return Math.round(v).toLocaleString("es-AR");
}
