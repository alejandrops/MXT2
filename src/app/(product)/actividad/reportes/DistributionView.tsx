"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  type ActivityMetric,
  type AnalysisGranularity,
  type AnomalyRow,
  type FleetAnalysisData,
  type FleetCell,
  type ScopeFilters,
} from "@/lib/queries";
import { MetricSelector } from "@/components/maxtracker/activity/MetricSelector";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { ExportMenu, granularityToPeriod } from "@/components/maxtracker/ui";
import { downloadCsv, csvNum, csvFilename } from "@/lib/utils/csv";
import styles from "./DistributionView.module.css";

// ═══════════════════════════════════════════════════════════════
//  DistributionView · vehículos × tiempo · pivot table
//  ─────────────────────────────────────────────────────────────
//  Refactor L1.Z:
//    · Reemplaza botón "Imprimible mensual" + "Exportar CSV" con
//      <ExportMenu> unificado · CSV directo + Imprimir/PDF cuando
//      hay imprimible para la granularidad actual
//    · Fusiona columnas Δ% y z en una sola columna "Variación"
//      · si hay anomalía (z-score significativo) muestra chip rojo
//        con z + Δ% inline
//      · si no hay anomalía muestra solo Δ% gris
//    · Usa downloadCsv util compartido
//
//  Anatomía:
//    · Toolbar · navigator + métrica + ExportMenu
//    · ScopeFilters · grupos / tipos / choferes / search
//    · Tabla densa · 1 fila por vehículo, N cols según granularidad
//      con valores numéricos + heatmap por celda
//    · Footer · totales por columna
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/actividad/reportes";

interface Props {
  data: FleetAnalysisData;
}

export function DistributionView({ data }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    m?: ActivityMetric;
    scope?: ScopeFilters;
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? data.granularity;
    const d = over.d === null ? null : over.d ?? data.anchorIso;
    const m = over.m ?? data.metric;
    const scope = over.scope ?? data.appliedScope;

    if (g !== "year-weeks") params.set("g", g);

    const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayIso = `${todayLocal.getUTCFullYear()}-${String(
      todayLocal.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
    if (d && d !== todayIso) params.set("d", d);
    if (m !== "distanceKm") params.set("m", m);
    if (scope.groupIds?.length) params.set("grp", scope.groupIds.join(","));
    if (scope.vehicleTypes?.length)
      params.set("type", scope.vehicleTypes.join(","));
    if (scope.personIds?.length)
      params.set("driver", scope.personIds.join(","));
    if (scope.search) params.set("q", scope.search);

    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  function nav(over: Parameters<typeof buildHref>[0]) {
    startTransition(() => router.push(buildHref(over)));
  }

  function setMetric(m: ActivityMetric) {
    nav({ m });
  }
  function setScope(scope: ScopeFilters) {
    nav({ scope });
  }
  function handleDrill(date: string, drillTo: AnalysisGranularity) {
    nav({ g: drillTo, d: date });
  }

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(
    todayLocal.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const isAnchorToday = data.anchorIso === todayIso;

  // ── Heatmap intensity buckets ────────────────────────────────
  const maxByCol: Record<number, number> = {};
  for (let c = 0; c < data.colCount; c++) {
    maxByCol[c] = 0;
  }
  for (const row of data.rows) {
    for (const cell of row.cells) {
      const cur = maxByCol[cell.col] ?? 0;
      if (cell.value > cur) maxByCol[cell.col] = cell.value;
    }
  }
  const maxRowMax = Math.max(0, ...data.rows.flatMap((r) => r.cells.map((c) => c.value)));

  // ── Anomalías por assetId · O(1) lookup ──────────────────────
  const anomaliesByAsset = new Map<string, AnomalyRow>();
  for (const a of data.anomalies) {
    anomaliesByAsset.set(a.assetId, a);
  }

  const isReverseMetric =
    data.metric === "eventCount" ||
    data.metric === "highEventCount" ||
    data.metric === "speedingCount" ||
    data.metric === "idleMin";

  // ── CSV export · usando util compartido ──────────────────────
  function exportCsv() {
    const headers = ["Vehículo", "Patente", "Grupo", "Δ%", "z"];
    for (let i = 0; i < data.colCount; i++) {
      const lbl = data.colLabels.find((l) => l.col === i);
      headers.push(lbl?.label ?? `Col ${i + 1}`);
    }
    headers.push("Total");

    const rows = data.rows.map((row) => {
      const anomaly = anomaliesByAsset.get(row.assetId);
      const cells: string[] = [
        row.assetName,
        row.assetPlate ?? "",
        row.groupName ?? "",
        row.previousDeltaPct === null
          ? ""
          : csvNum(row.previousDeltaPct * 100),
        anomaly ? csvNum(anomaly.zScore) : "",
      ];
      for (let i = 0; i < data.colCount; i++) {
        const c = row.cells.find((x) => x.col === i);
        cells.push(c ? formatCsv(c.value, data.metric) : "0");
      }
      cells.push(formatCsv(row.total, data.metric));
      return cells;
    });

    downloadCsv({
      filename: csvFilename(`reporte-${data.granularity}-${data.anchorIso}`),
      headers,
      rows,
    });
  }

  const printPeriod = granularityToPeriod(data.granularity);

  return (
    <>
      {/* ── Toolbar · navigator + métrica + ExportMenu ─────────── */}
      <div className={styles.toolbar}>
        <PeriodNavigator
          granularity={data.granularity}
          prevAnchor={data.prevAnchorIso}
          nextAnchor={data.nextAnchorIso}
          isToday={isAnchorToday}
          onChangeGranularity={(g) => nav({ g })}
          onChangeAnchor={(d) => nav({ d })}
        />
        <div className={styles.toolbarSpacer} />
        <MetricSelector value={data.metric} onChange={setMetric} />
        <ExportMenu onExportCsv={exportCsv} printPeriod={printPeriod} />
      </div>

      {/* ── Scope filters ──────────────────────────────────── */}
      <ScopeFiltersBar
        scope={data.appliedScope}
        available={data.scope}
        rowCount={data.rows.length}
        onChange={setScope}
      />

      {/* ── Period summary ─────────────────────────────────── */}
      <div className={styles.summary}>
        <span className={styles.summaryLabel}>{data.metricLabel}</span>
        <span className={styles.summaryValue}>{data.periodLabel}</span>
        <span className={styles.summaryDot}>·</span>
        <span className={styles.summaryLabel}>{data.periodSubLabel}</span>
        <span className={styles.summaryDot}>·</span>
        <span className={styles.summaryLabel}>Total</span>
        <span className={`${styles.summaryValue} ${styles.summaryTotal}`}>
          {formatValue(data.total, data.metric)}
        </span>
      </div>

      {/* ── Pivot table ────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.thSticky}`}>Vehículo</th>
              <th className={styles.th}>Patente</th>
              <th className={styles.th}>Grupo</th>
              <th
                className={`${styles.th} ${styles.alignRight}`}
                title="Variación vs período anterior · chip rojo si hay anomalía estadística"
              >
                Variación
              </th>
              {Array.from({ length: data.colCount }).map((_, i) => {
                const lbl = data.colLabels.find((l) => l.col === i);
                return (
                  <th
                    key={`h-${i}`}
                    className={`${styles.th} ${styles.alignRight} ${
                      lbl?.isWeekend ? styles.thWeekend : ""
                    } ${lbl?.isToday ? styles.thToday : ""}`}
                    title={lbl?.label}
                  >
                    {lbl?.label ?? i + 1}
                  </th>
                );
              })}
              <th className={`${styles.th} ${styles.alignCenter}`}>
                Tendencia
              </th>
              <th className={`${styles.th} ${styles.alignRight}`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.colCount + 6} className={styles.empty}>
                  Sin vehículos para los filtros aplicados.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => {
                const anomaly = anomaliesByAsset.get(row.assetId);
                return (
                  <tr key={row.assetId} className={styles.row}>
                    <td className={`${styles.td} ${styles.tdSticky}`}>
                      <Link
                        href={`/objeto/vehiculo/${row.assetId}`}
                        className={styles.assetLink}
                      >
                        {row.assetName}
                      </Link>
                    </td>
                    <td className={styles.td}>
                      {row.assetPlate ? (
                        <span className={styles.plate}>{row.assetPlate}</span>
                      ) : (
                        <span className={styles.dim}>—</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      {row.groupName ? (
                        <span className={styles.group}>{row.groupName}</span>
                      ) : (
                        <span className={styles.dim}>—</span>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.alignRight}`}>
                      <VariationCell
                        deltaPct={row.previousDeltaPct}
                        previousFmt={
                          row.previousTotal !== null
                            ? formatValue(row.previousTotal, data.metric)
                            : null
                        }
                        anomaly={anomaly ?? null}
                        isReverse={isReverseMetric}
                      />
                    </td>
                    {Array.from({ length: data.colCount }).map((_, i) => {
                      const c = row.cells.find((x) => x.col === i);
                      const v = c?.value ?? 0;
                      const colMax = maxByCol[i] ?? 0;
                      const intensity = bucket(v, colMax);
                      const interactive = c?.drillTo != null;
                      return (
                        <td
                          key={`c-${i}`}
                          className={`${styles.td} ${styles.tdValue} ${
                            c?.isWeekend ? styles.tdWeekend : ""
                          } ${c?.isToday ? styles.tdToday : ""} ${
                            interactive ? styles.tdInteractive : ""
                          }`}
                          data-intensity={intensity}
                          onClick={
                            interactive && c?.drillDate && c?.drillTo
                              ? () => handleDrill(c.drillDate!, c.drillTo!)
                              : undefined
                          }
                          title={c?.fullLabel}
                        >
                          {v === 0 ? (
                            <span className={styles.zero}>—</span>
                          ) : (
                            formatValue(v, data.metric)
                          )}
                        </td>
                      );
                    })}
                    <td className={`${styles.td} ${styles.tdTrend}`}>
                      <RowSparkline
                        cells={row.cells}
                        max={maxRowMax}
                        isAnomaly={!!anomaly}
                      />
                    </td>
                    <td
                      className={`${styles.td} ${styles.tdTotal} ${styles.alignRight}`}
                    >
                      <strong>{formatValue(row.total, data.metric)}</strong>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot>
              <tr className={styles.footRow}>
                <td className={`${styles.tdFoot} ${styles.tdSticky}`}>
                  <strong>Total flota</strong>
                </td>
                <td className={styles.tdFoot} />
                <td className={styles.tdFoot} />
                <td className={styles.tdFoot} />
                {Array.from({ length: data.colCount }).map((_, i) => {
                  const colTotal = data.rows.reduce((acc, r) => {
                    const cell = r.cells.find((x) => x.col === i);
                    return acc + (cell?.value ?? 0);
                  }, 0);
                  return (
                    <td
                      key={`ft-${i}`}
                      className={`${styles.tdFoot} ${styles.alignRight}`}
                    >
                      {colTotal === 0
                        ? "—"
                        : formatValue(colTotal, data.metric)}
                    </td>
                  );
                })}
                <td className={styles.tdFoot} />
                <td
                  className={`${styles.tdFoot} ${styles.alignRight} ${styles.tdTotal}`}
                >
                  <strong>{formatValue(data.total, data.metric)}</strong>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function formatValue(v: number, metric: ActivityMetric): string {
  if (metric === "distanceKm" || metric === "fuelLiters") {
    return v.toLocaleString("es-AR", {
      maximumFractionDigits: v >= 100 ? 0 : 1,
    });
  }
  if (metric === "maxSpeedKmh") return Math.round(v).toLocaleString("es-AR");
  if (metric === "activeMin" || metric === "idleMin") return formatMinutes(v);
  return Math.round(v).toLocaleString("es-AR");
}

function formatMinutes(min: number): string {
  if (min <= 0) return "0h";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatCsv(v: number, metric: ActivityMetric): string {
  if (metric === "distanceKm" || metric === "fuelLiters") {
    return v.toFixed(1).replace(".", ",");
  }
  return String(Math.round(v));
}

function bucket(v: number, max: number): number {
  if (max <= 0 || v <= 0) return 0;
  const ratio = v / max;
  if (ratio < 0.15) return 1;
  if (ratio < 0.35) return 2;
  if (ratio < 0.6) return 3;
  if (ratio < 0.85) return 4;
  return 5;
}

// ═══════════════════════════════════════════════════════════════
//  VariationCell · fusiona Δ% y z-score en una sola insignia
//  ─────────────────────────────────────────────────────────────
//  · sin anomalía · solo Δ% en gris (variación normal de período)
//  · con anomalía · chip rojo/naranja con z + Δ% (variación
//    estadísticamente significativa)
// ═══════════════════════════════════════════════════════════════

function VariationCell({
  deltaPct,
  previousFmt,
  anomaly,
  isReverse,
}: {
  deltaPct: number | null;
  previousFmt: string | null;
  anomaly: AnomalyRow | null;
  isReverse: boolean;
}) {
  if (deltaPct === null && !anomaly) {
    return <span className={styles.deltaNa}>—</span>;
  }

  // Caso anomalía · chip destacado con z + Δ% · reusa estilos zChip
  if (anomaly) {
    const cls =
      anomaly.severity === "critical"
        ? styles.zChipCritical
        : styles.zChipWarning;
    const dir = anomaly.direction === "high" ? "▲" : "▼";
    const pctTxt =
      deltaPct === null
        ? ""
        : ` · ${(deltaPct * 100 >= 0 ? "+" : "") + (deltaPct * 100).toFixed(0)}%`;
    return (
      <span
        className={`${styles.zChip} ${cls}`}
        title={`Anomalía · z=${anomaly.zScore.toFixed(1)} · promedio histórico ${anomaly.historicalMean.toFixed(0)} · σ ${anomaly.historicalStd.toFixed(1)}${previousFmt ? ` · anterior ${previousFmt}` : ""}`}
      >
        {dir}
        z={anomaly.zScore > 0 ? "+" : ""}
        {anomaly.zScore.toFixed(1)}
        {pctTxt}
      </span>
    );
  }

  // Caso normal · solo Δ%
  if (deltaPct === null) return <span className={styles.deltaNa}>—</span>;
  const trend =
    deltaPct > 0.02 ? "up" : deltaPct < -0.02 ? "down" : "flat";
  const sentimentClass =
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
  const pctTxt =
    (deltaPct * 100 >= 0 ? "+" : "") + (deltaPct * 100).toFixed(0) + "%";
  return (
    <span
      className={`${styles.deltaChip} ${sentimentClass}`}
      title={previousFmt ? `Anterior: ${previousFmt}` : undefined}
    >
      <Icon size={10} />
      <span>{pctTxt}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  RowSparkline · mini line chart inline
// ═══════════════════════════════════════════════════════════════

function RowSparkline({
  cells,
  max,
  isAnomaly,
}: {
  cells: FleetCell[];
  max: number;
  isAnomaly: boolean;
}) {
  // Defensa contra NaN/Infinity (post-U1c).
  //
  // Con scope OWN_ACCOUNT, una cuenta sin trips/datos en el período
  // puede tener todos los `cells.value` en 0 → max=0 → división por
  // cero → "NaN" literal en el atributo points del polyline → SVG
  // tira un error de runtime y rompe el árbol React.
  //
  // `max <= 0` solo NO alcanza porque NaN <= 0 evalúa a false en JS.
  // Hay que verificar finitude explícitamente.
  if (cells.length === 0 || !Number.isFinite(max) || max <= 0) {
    return <span className={styles.dim}>—</span>;
  }
  const w = 80;
  const h = 14;
  const stepX = w / Math.max(1, cells.length - 1);
  const points = cells
    .map((c, i) => {
      const x = i * stepX;
      // Defensa secundaria · si algún cell.value viene undefined/NaN
      // por algún glitch de datos, lo tratamos como 0 (línea al
      // bottom) en vez de propagar NaN al SVG.
      const v = Number.isFinite(c.value) ? c.value : 0;
      const y = h - (v / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className={styles.sparkline}
    >
      <polyline
        fill="none"
        stroke={isAnomaly ? "var(--red)" : "var(--blu)"}
        strokeWidth="1.2"
        points={points}
      />
    </svg>
  );
}
