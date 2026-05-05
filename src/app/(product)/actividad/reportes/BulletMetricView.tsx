"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  type ActivityMetric,
  type AnalysisGranularity,
  type FleetMultiMetricData,
  type ScopeFilters,
} from "@/lib/queries";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { ExportMenu, granularityToPeriod } from "@/components/maxtracker/ui";
import { downloadCsv, csvNum, csvFilename } from "@/lib/utils/csv";
import { exportReportesXlsx } from "@/lib/excel/client";
import styles from "./BulletMetricView.module.css";

// ═══════════════════════════════════════════════════════════════
//  BulletMetricView · S3-L4 · vehículos × métricas (visual)
//  ─────────────────────────────────────────────────────────────
//  Variante VISUAL del MultiMetricView · misma data, misma estructura
//  de tabla, pero cada celda tiene una micro-barra que escala como
//  porcentaje del max de la columna.
//
//  Color contextual:
//   · métricas "más es mejor" (km, horas, viajes, fuel) · neutro
//   · métricas "más es peor" (idle, eventos, excesos, vmax) ·
//     barra warn cuando el vehículo está en el top 25% de esa métrica
//
//  Tufte-friendly · data-ink ratio alto · color solo en anomalías.
//  Reemplaza el "ranking de 1 sola métrica" del modo visual previo
//  en /actividad/resumen?modo=visual.
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/actividad/resumen";

const COLS: { key: ActivityMetric; label: string; short: string; reverse: boolean; unit: string }[] = [
  { key: "distanceKm", label: "Distancia", short: "Km", reverse: false, unit: "km" },
  { key: "activeMin", label: "Horas activas", short: "Horas", reverse: false, unit: "h" },
  { key: "idleMin", label: "Ralentí", short: "Idle", reverse: true, unit: "h" },
  { key: "tripCount", label: "Viajes", short: "Viajes", reverse: false, unit: "" },
  { key: "eventCount", label: "Eventos", short: "Eventos", reverse: true, unit: "" },
  { key: "speedingCount", label: "Excesos", short: "Excesos", reverse: true, unit: "" },
  { key: "maxSpeedKmh", label: "Vel. máx", short: "Vmax", reverse: true, unit: "km/h" },
  { key: "fuelLiters", label: "Combustible", short: "Fuel", reverse: false, unit: "L" },
];

interface Props {
  data: FleetMultiMetricData;
}

export function BulletMetricView({ data }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    scope?: ScopeFilters;
    mode?: "distribution" | "fleet-multi";
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? data.granularity;
    const d = over.d === null ? null : over.d ?? data.anchorIso;
    const scope = over.scope ?? data.appliedScope;

    if (g !== "month-days") params.set("g", g);

    const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
    if (d && d !== todayIso) params.set("d", d);
    if (scope.groupIds?.length) params.set("grp", scope.groupIds.join(","));
    if (scope.vehicleTypes?.length) params.set("type", scope.vehicleTypes.join(","));
    if (scope.personIds?.length) params.set("driver", scope.personIds.join(","));
    if (scope.search) params.set("q", scope.search);

    // S3-L4.2 · BulletMetricView vive SOLO en modo visual (en /resumen).
    // Setear modo=visual siempre para que cualquier navegación
    // (cambio de fecha, granularidad, scope) preserve el modo y no
    // caiga en tabla por default.
    params.set("modo", "visual");

    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  function nav(over: Parameters<typeof buildHref>[0]) {
    startTransition(() => router.push(buildHref(over)));
  }

  function setScope(scope: ScopeFilters) {
    nav({ scope });
  }

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const isAnchorToday = data.anchorIso === todayIso;

  function exportCsv() {
    const headers: string[] = ["Vehículo", "Patente", "Grupo"];
    for (const c of COLS) {
      headers.push(c.label);
      headers.push(`Δ% ${c.short}`);
    }
    const rows = data.rows.map((r) => {
      const cells: string[] = [
        r.assetName,
        r.assetPlate ?? "",
        r.groupName ?? "",
      ];
      for (const c of COLS) {
        const cell = r.metrics[c.key];
        cells.push(formatCsv(cell.value, c.key));
        cells.push(cell.deltaPct === null ? "" : csvNum(cell.deltaPct * 100));
      }
      return cells;
    });
    // Footer
    const footCells: string[] = ["Total flota", "", ""];
    for (const c of COLS) {
      const t = data.totals[c.key];
      footCells.push(formatCsv(t.value, c.key));
      footCells.push(t.deltaPct === null ? "" : csvNum(t.deltaPct * 100));
    }
    rows.push(footCells);

    downloadCsv({
      filename: csvFilename(`reporte-multimetrica-${data.granularity}-${data.anchorIso}`),
      headers,
      rows,
    });
  }

  // ── Excel export (L10) ──────────────────────────────────────
  async function exportXlsx() {
    const columns: { header: string; width?: number; format?: "int" | "decimal1" | "text" }[] = [
      { header: "Vehículo", width: 28 },
      { header: "Patente", width: 12 },
      { header: "Grupo", width: 20 },
    ];
    for (const c of COLS) {
      columns.push({ header: c.label, width: 14, format: "decimal1" });
      columns.push({ header: `Δ% ${c.short}`, width: 10, format: "decimal1" });
    }

    const rows = data.rows.map((r) => {
      const cells: (string | number | null)[] = [
        r.assetName,
        r.assetPlate ?? "",
        r.groupName ?? "",
      ];
      for (const c of COLS) {
        const cell = r.metrics[c.key];
        cells.push(cell.value);
        cells.push(cell.deltaPct === null ? null : cell.deltaPct * 100);
      }
      return cells;
    });

    // Footer total flota
    const footCells: (string | number | null)[] = ["Total flota", "", ""];
    for (const c of COLS) {
      const t = data.totals[c.key];
      footCells.push(t.value);
      footCells.push(t.deltaPct === null ? null : t.deltaPct * 100);
    }
    rows.push(footCells);

    await exportReportesXlsx({
      subject: `Reporte multi-métrica · ${data.granularity} · ${data.anchorIso}`,
      sheetName: `multimetrica_${data.granularity}_${data.anchorIso}`,
      columns,
      rows,
    });
  }

  const printPeriod = granularityToPeriod(data.granularity);

  // ── S3-L4 · Calcular max por columna y threshold de anomalía ──
  // Maxes para escalar las barras como porcentaje del max de la columna.
  // Threshold = top 25% para métricas reverse · pinta la barra warn
  // cuando el vehículo está entre los peores de su métrica.
  const colMaxes = new Map<ActivityMetric, number>();
  const colThresholds = new Map<ActivityMetric, number>();
  for (const c of COLS) {
    let max = 0;
    const values: number[] = [];
    for (const row of data.rows) {
      const v = row.metrics[c.key]?.value ?? 0;
      if (v > max) max = v;
      if (v > 0) values.push(v);
    }
    colMaxes.set(c.key, max);
    if (c.reverse && values.length > 0) {
      values.sort((a, b) => b - a);
      const idx = Math.floor(values.length * 0.25);
      const t = values[idx] ?? values[0] ?? 0;
      colThresholds.set(c.key, t);
    }
  }

  return (
    <>
      {/* Toolbar · navigator + export */}
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
        <ExportMenu
          onExportCsv={exportCsv}
          onExportXlsx={exportXlsx}
          printPeriod={printPeriod}
        />
      </div>

      {/* Filtros */}
      <ScopeFiltersBar
        scope={data.appliedScope}
        available={data.scope}
        rowCount={data.rows.length}
        onChange={setScope}
      />

      {/* Period summary */}
      <div className={styles.summary}>
        <span className={styles.summaryLabel}>Multi-métrica · vehículos</span>
        <span className={styles.summaryValue}>{data.periodLabel}</span>
        <span className={styles.summaryDot}>·</span>
        <span className={styles.summaryLabel}>{data.periodSubLabel}</span>
        <span className={styles.summaryDot}>·</span>
        <span className={styles.summaryLabel}>
          {data.rows.length} {data.rows.length === 1 ? "vehículo" : "vehículos"}
        </span>
      </div>

      {/* Tabla */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.thSticky}`}>Vehículo</th>
              <th className={styles.th}>Patente</th>
              <th className={styles.th}>Grupo</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`${styles.th} ${styles.alignRight}`}
                  title={c.label}
                >
                  {c.short}
                  {c.unit && (
                    <span className={styles.thUnit}> ({c.unit})</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 3} className={styles.empty}>
                  Sin vehículos para los filtros aplicados.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
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
                  {COLS.map((c) => {
                    const cell = row.metrics[c.key];
                    const value = cell.value;
                    const max = colMaxes.get(c.key) ?? 0;
                    const pct = max > 0 ? (value / max) * 100 : 0;
                    const threshold = colThresholds.get(c.key);
                    const isAnomaly =
                      c.reverse &&
                      threshold !== undefined &&
                      value >= threshold &&
                      value > 0;
                    return (
                      <td
                        key={c.key}
                        className={`${styles.td} ${styles.tdMetric}`}
                      >
                        <div className={styles.bulletWrap}>
                          <div className={styles.bulletTrack}>
                            <div
                              className={`${styles.bulletBar} ${isAnomaly ? styles.bulletWarn : ""}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className={styles.bulletValue}>
                            <span className={styles.metricValue}>
                              {formatValue(value, c.key)}
                            </span>
                            <DeltaInline
                              deltaPct={cell.deltaPct}
                              isReverse={c.reverse}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
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
                {COLS.map((c) => {
                  const t = data.totals[c.key];
                  return (
                    <td
                      key={c.key}
                      className={`${styles.tdFoot} ${styles.tdMetric}`}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "baseline",
                          gap: 6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <strong className={styles.metricValue}>
                          {formatValue(t.value, c.key)}
                        </strong>
                        <DeltaInline
                          deltaPct={t.deltaPct}
                          isReverse={c.reverse}
                        />
                      </span>
                    </td>
                  );
                })}
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

function DeltaInline({
  deltaPct,
  isReverse,
}: {
  deltaPct: number | null;
  isReverse: boolean;
}) {
  if (deltaPct === null) {
    return <span className={styles.deltaNa}>—</span>;
  }
  const trend =
    deltaPct > 0.02 ? "up" : deltaPct < -0.02 ? "down" : "flat";

  // Semántica unificada · verde = bueno · rojo = malo · gris = sin cambio.
  // Para métricas "más es mejor" (km, horas) · subir = bueno.
  // Para métricas "menos es mejor" (eventos, idle) · bajar = bueno.
  const isGood =
    (trend === "up" && !isReverse) || (trend === "down" && isReverse);
  const isBad =
    (trend === "up" && isReverse) || (trend === "down" && !isReverse);
  const cls = isGood
    ? styles.deltaGood
    : isBad
      ? styles.deltaBad
      : styles.deltaFlat;
  const Icon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const txt =
    (deltaPct * 100 >= 0 ? "+" : "") + (deltaPct * 100).toFixed(0) + "%";
  return (
    <span className={`${styles.delta} ${cls}`}>
      <Icon size={9} />
      <span>{txt}</span>
    </span>
  );
}

function formatValue(v: number, metric: ActivityMetric): string {
  if (metric === "distanceKm" || metric === "fuelLiters") {
    return v.toLocaleString("es-AR", {
      maximumFractionDigits: v >= 100 ? 0 : 1,
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
