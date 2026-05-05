"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  type ActivityMetric,
  type AnalysisGranularity,
  type DriversAnalysisData,
  type FleetCell,
  type DriverAnomalyRow,
  type ScopeFilters,
} from "@/lib/queries";
import { MetricSelector } from "@/components/maxtracker/activity/MetricSelector";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { ExportMenu, granularityToPeriod } from "@/components/maxtracker/ui";
import { downloadCsv, csvNum, csvFilename as csvFn } from "@/lib/utils/csv";
import { exportReportesXlsx } from "@/lib/excel/client";
import styles from "./DriversDistributionView.module.css";

// ═══════════════════════════════════════════════════════════════
//  ActivityViewSwitcher · tabla numérica · misma data que Análisis
//  ─────────────────────────────────────────────────────────────
//  Anatomía:
//    · Toolbar · navigator + métrica + export CSV
//    · ScopeFilters · grupos / tipos / choferes / search
//    · Tabla densa · 1 fila por vehículo, N cols según granularidad
//      con valores numéricos + heatmap por celda
//    · Footer · totales por columna
//
//  Para granularidades anuales (year-weeks · 53 cols), la tabla
//  scrollea horizontal · header sticky.
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/actividad/evolucion";

interface Props {
  data: DriversAnalysisData;
}

export function DriversDistributionView({ data }: Props) {
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

    params.set("g", g); // S3-L4.3 · siempre persistir granularity

    const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
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
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const isAnchorToday = data.anchorIso === todayIso;

  // Compute per-column max for heatmap intensity
  const maxByCol = new Array(data.colCount).fill(0) as number[];
  for (const r of data.rows) {
    for (const c of r.cells) {
      if (c.value > (maxByCol[c.col] ?? 0)) maxByCol[c.col] = c.value;
    }
  }

  // Anomalías indexadas por personId · para columnas Δ% y z
  const anomalyById = new Map(
    data.anomalies.map((a) => [a.personId, a]),
  );
  const isReverseMetric =
    data.metric === "speedingCount" || data.metric === "highEventCount";

  // Max total para escalar sparklines (cells/total scope)
  const maxRowMax = data.rows.reduce((m, r) => {
    for (const c of r.cells) if (c.value > m) m = c.value;
    return m;
  }, 0);

  function bucket(value: number, colMax: number): 0 | 1 | 2 | 3 | 4 {
    if (value <= 0 || colMax <= 0) return 0;
    const r = value / colMax;
    if (r < 0.25) return 1;
    if (r < 0.5) return 2;
    if (r < 0.75) return 3;
    return 4;
  }

  function exportCsv() {
    const sep = ";";
    const cols = data.colLabels.length === data.colCount
      ? data.colLabels.map((l) => l.label)
      : Array.from({ length: data.colCount }, (_, i) => {
          const lbl = data.colLabels.find((l) => l.col === i);
          return lbl?.label ?? `Col ${i + 1}`;
        });
    const rows: string[] = [];
    rows.push(
      ["Conductor", "Vehíc.", "Δ%", "z-score", ...cols, "Total"]
        .map(csvEsc)
        .join(sep),
    );
    for (const r of data.rows) {
      const anomaly = anomalyById.get(r.personId);
      const cells: string[] = [
        csvEsc(r.personName),
        String(r.vehiclesUsed),
        r.previousDeltaPct === null
          ? ""
          : (r.previousDeltaPct * 100).toFixed(1).replace(".", ","),
        anomaly ? anomaly.zScore.toFixed(2).replace(".", ",") : "",
      ];
      for (let i = 0; i < data.colCount; i++) {
        const c = r.cells.find((x) => x.col === i);
        cells.push(formatCsv(c?.value ?? 0, data.metric));
      }
      cells.push(formatCsv(r.total, data.metric));
      rows.push(cells.join(sep));
    }
    // Footer total per column
    const footCells: string[] = ["Total flota", "", "", ""];
    for (let i = 0; i < data.colCount; i++) {
      let sum = 0;
      let max = 0;
      for (const r of data.rows) {
        const c = r.cells.find((x) => x.col === i);
        if (!c) continue;
        sum += c.value;
        if (c.value > max) max = c.value;
      }
      footCells.push(
        formatCsv(data.metric === "maxSpeedKmh" ? max : sum, data.metric),
      );
    }
    footCells.push(formatCsv(data.total, data.metric));
    rows.push(footCells.join(sep));

    const bom = "\uFEFF";
    const blob = new Blob([bom + rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename(data);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Excel export (L10) ──────────────────────────────────────
  async function exportXlsx() {
    const cols =
      data.colLabels.length === data.colCount
        ? data.colLabels.map((l) => l.label)
        : Array.from({ length: data.colCount }, (_, i) => {
            const lbl = data.colLabels.find((l) => l.col === i);
            return lbl?.label ?? `Col ${i + 1}`;
          });

    const columns: { header: string; width?: number; format?: "int" | "decimal1" | "text" }[] = [
      { header: "Conductor", width: 28 },
      { header: "Vehículos", width: 10, format: "int" },
      { header: "Δ %", width: 10, format: "decimal1" },
      { header: "z-score", width: 10, format: "decimal1" },
    ];
    for (const c of cols) {
      columns.push({ header: c, width: 14, format: "decimal1" });
    }
    columns.push({ header: "Total", width: 14, format: "decimal1" });

    const rows = data.rows.map((r) => {
      const anomaly = anomalyById.get(r.personId);
      const cells: (string | number | null)[] = [
        r.personName,
        r.vehiclesUsed,
        r.previousDeltaPct === null ? null : r.previousDeltaPct * 100,
        anomaly ? anomaly.zScore : null,
      ];
      for (let i = 0; i < data.colCount; i++) {
        const c = r.cells.find((x) => x.col === i);
        cells.push(c?.value ?? 0);
      }
      cells.push(r.total);
      return cells;
    });

    // Footer · Total flota
    const footCells: (string | number | null)[] = ["Total flota", "", null, null];
    for (let i = 0; i < data.colCount; i++) {
      let sum = 0;
      let max = 0;
      for (const r of data.rows) {
        const c = r.cells.find((x) => x.col === i);
        if (!c) continue;
        sum += c.value;
        if (c.value > max) max = c.value;
      }
      footCells.push(data.metric === "maxSpeedKmh" ? max : sum);
    }
    footCells.push(data.total);
    rows.push(footCells);

    await exportReportesXlsx({
      subject: `Reporte conductores · ${data.granularity} · ${data.anchorIso}`,
      sheetName: `conductores_${data.granularity}_${data.anchorIso}`,
      columns,
      rows,
    });
  }

  return (
    <>
      {/* ── Toolbar · navigator + metric + export ───────────── */}
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
        <ExportMenu
          onExportCsv={exportCsv}
          onExportXlsx={exportXlsx}
          printPeriod={granularityToPeriod(data.granularity)}
        />
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
              <th className={`${styles.th} ${styles.thSticky}`}>Conductor</th>
              <th
                className={`${styles.th} ${styles.alignCenter}`}
                title="Vehículos manejados en el período"
              >
                Vehíc.
              </th>
              <th className={`${styles.th} ${styles.alignRight}`} title="Variación vs período anterior">
                Δ%
              </th>
              <th
                className={`${styles.th} ${styles.alignCenter}`}
                title="Z-score · qué tan anómalo es vs los últimos 6 períodos"
              >
                z
              </th>
              {Array.from({ length: data.colCount }).map((_, i) => {
                const lbl = data.colLabels.find((l) => l.col === i);
                return (
                  <th
                    key={`h-${i}`}
                    className={`${styles.th} ${styles.alignRight} ${
                      lbl?.isWeekend ? styles.thWeekend : ""
                    } ${lbl?.isToday ? styles.thToday : ""}`}
                  >
                    {lbl?.label ?? ""}
                  </th>
                );
              })}
              <th className={`${styles.th} ${styles.thTrend}`}>Tendencia</th>
              <th
                className={`${styles.th} ${styles.alignRight} ${styles.thTotal}`}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.colCount + 5} className={styles.empty}>
                  Sin conductores con actividad para los filtros aplicados.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => {
                const anomaly = anomalyById.get(row.personId);
                return (
                  <tr key={row.personId} className={styles.row}>
                    <td className={`${styles.td} ${styles.tdSticky}`}>
                      <Link
                        href={`/objeto/conductor/${row.personId}`}
                        className={styles.assetLink}
                      >
                        {row.personName}
                      </Link>
                    </td>
                    <td className={`${styles.td} ${styles.alignCenter}`}>
                      <span className={styles.vehBadge}>
                        {row.vehiclesUsed}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.alignRight}`}>
                      <DeltaCell
                        deltaPct={row.previousDeltaPct}
                        previousFmt={
                          row.previousTotal !== null
                            ? formatValue(row.previousTotal, data.metric)
                            : null
                        }
                        isReverse={isReverseMetric}
                      />
                    </td>
                    <td className={`${styles.td} ${styles.alignCenter}`}>
                      <ZCell anomaly={anomaly ?? null} />
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
                  let sum = 0;
                  let max = 0;
                  for (const r of data.rows) {
                    const c = r.cells.find((x) => x.col === i);
                    if (!c) continue;
                    sum += c.value;
                    if (c.value > max) max = c.value;
                  }
                  const v = data.metric === "maxSpeedKmh" ? max : sum;
                  return (
                    <td
                      key={`f-${i}`}
                      className={`${styles.tdFoot} ${styles.alignRight}`}
                    >
                      <strong>{formatValue(v, data.metric)}</strong>
                    </td>
                  );
                })}
                <td className={`${styles.tdFoot} ${styles.tdTrend}`} />
                <td
                  className={`${styles.tdFoot} ${styles.tdTotal} ${styles.alignRight}`}
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
//  Format helpers
// ═══════════════════════════════════════════════════════════════

function formatValue(v: number, metric: ActivityMetric): string {
  if (metric === "distanceKm" || metric === "fuelLiters") {
    return v.toLocaleString("es-AR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: v % 1 === 0 ? 0 : 1,
    });
  }
  if (metric === "maxSpeedKmh") {
    return Math.round(v).toLocaleString("es-AR");
  }
  if (metric === "activeMin" || metric === "idleMin") {
    return formatMinutes(v);
  }
  return Math.round(v).toLocaleString("es-AR");
}

function formatMinutes(min: number): string {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function csvEsc(s: string): string {
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatCsv(v: number, metric: ActivityMetric): string {
  if (metric === "distanceKm" || metric === "fuelLiters") {
    return v.toFixed(1).replace(".", ",");
  }
  return String(Math.round(v));
}

function csvFilename(data: DriversAnalysisData): string {
  const stamp = data.anchorIso.replace(/-/g, "");
  return `reporte-conductores-${data.metric}-${data.granularity}-${stamp}.csv`;
}

// ═══════════════════════════════════════════════════════════════
//  DeltaCell · variación vs período anterior
// ═══════════════════════════════════════════════════════════════

function DeltaCell({
  deltaPct,
  previousFmt,
  isReverse,
}: {
  deltaPct: number | null;
  previousFmt: string | null;
  isReverse: boolean;
}) {
  if (deltaPct === null) {
    return <span className={styles.deltaNa}>—</span>;
  }
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
//  ZCell · indicador de anomalía
// ═══════════════════════════════════════════════════════════════

function ZCell({ anomaly }: { anomaly: DriverAnomalyRow | null }) {
  if (!anomaly) {
    return <span className={styles.zEmpty}>—</span>;
  }
  const cls =
    anomaly.severity === "critical"
      ? styles.zChipCritical
      : styles.zChipWarning;
  const dir = anomaly.direction === "high" ? "▲" : "▼";
  return (
    <span
      className={`${styles.zChip} ${cls}`}
      title={`Promedio histórico: ${anomaly.historicalMean.toFixed(0)} · σ: ${anomaly.historicalStd.toFixed(1)}`}
    >
      {dir}
      {anomaly.zScore > 0 ? "+" : ""}
      {anomaly.zScore.toFixed(1)}
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
  if (cells.length === 0 || max <= 0) {
    return <span className={styles.sparkEmpty}>—</span>;
  }
  const W = 80;
  const H = 18;
  const denom = cells.length > 1 ? cells.length - 1 : 1;
  const pts = cells.map((c, i) => ({
    x: (i / denom) * W,
    y: H - (c.value / max) * H,
  }));
  const linePath = `M ${pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L ")}`;
  const areaPath = `${linePath} L ${W},${H} L 0,${H} Z`;
  return (
    <svg
      className={`${styles.spark} ${isAnomaly ? styles.sparkAnomaly : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={areaPath} className={styles.sparkArea} />
      <path d={linePath} className={styles.sparkLine} />
    </svg>
  );
}
