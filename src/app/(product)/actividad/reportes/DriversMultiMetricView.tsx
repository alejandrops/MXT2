"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, User } from "lucide-react";
import {
  type ActivityMetric,
  type AnalysisGranularity,
  type DriversMultiMetricData,
  type ScopeFilters,
} from "@/lib/queries";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { ExportMenu, granularityToPeriod } from "@/components/maxtracker/ui";
import styles from "./DriversMultiMetricView.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriversMultiMetricView · personas × métricas
//  ─────────────────────────────────────────────────────────────
//  Vista análoga a MultiMetricView pero indexada por persona.
//  Solo aparecen personas que manejaron al menos un vehículo en
//  el período (con scope filter aplicado).
//
//  Métricas (7): distancia, horas, viajes, eventos, excesos,
//  high-events, vel máx · NO incluye idle ni fuel (son métricas
//  del vehículo, no del chofer).
//
//  Columna extra "Vehículos" muestra cuántos vehículos distintos
//  manejó la persona en el período.
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/actividad/reportes";

const COLS: { key: ActivityMetric; label: string; short: string; reverse: boolean; unit: string }[] = [
  { key: "distanceKm", label: "Distancia", short: "Km", reverse: false, unit: "km" },
  { key: "activeMin", label: "Horas activas", short: "Horas", reverse: false, unit: "h" },
  { key: "tripCount", label: "Viajes", short: "Viajes", reverse: false, unit: "" },
  { key: "eventCount", label: "Eventos", short: "Eventos", reverse: true, unit: "" },
  { key: "speedingCount", label: "Excesos vel.", short: "Excesos", reverse: true, unit: "" },
  { key: "highEventCount", label: "Eventos críticos", short: "Críticos", reverse: true, unit: "" },
  { key: "maxSpeedKmh", label: "Vel. máx", short: "Vmax", reverse: true, unit: "km/h" },
];

interface Props {
  data: DriversMultiMetricData;
}

export function DriversMultiMetricView({ data }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    scope?: ScopeFilters;
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
    params.set("mode", "drivers-multi");

    return `${BASE_PATH}?${params.toString()}`;
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
    const sep = ";";
    const header = ["Conductor", "Vehículos"];
    for (const c of COLS) {
      header.push(c.label);
      header.push(`Δ% ${c.short}`);
    }
    const rows: string[] = [header.map(csvEsc).join(sep)];
    for (const r of data.rows) {
      const cells: string[] = [
        csvEsc(r.personName),
        String(r.vehiclesUsed),
      ];
      for (const c of COLS) {
        const cell = r.metrics[c.key];
        cells.push(formatCsv(cell.value, c.key));
        cells.push(
          cell.deltaPct === null
            ? ""
            : (cell.deltaPct * 100).toFixed(1).replace(".", ","),
        );
      }
      rows.push(cells.join(sep));
    }
    // Footer
    const footCells: string[] = ["Total flota", ""];
    for (const c of COLS) {
      const t = data.totals[c.key];
      footCells.push(formatCsv(t.value, c.key));
      footCells.push(
        t.deltaPct === null
          ? ""
          : (t.deltaPct * 100).toFixed(1).replace(".", ","),
      );
    }
    rows.push(footCells.join(sep));

    const bom = "\uFEFF";
    const blob = new Blob([bom + rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = data.anchorIso.replace(/-/g, "");
    a.download = `reporte-conductores-${data.granularity}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Toolbar */}
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
          printPeriod={granularityToPeriod(data.granularity)}
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
        <span className={styles.summaryLabel}>Multi-métrica · conductores</span>
        <span className={styles.summaryValue}>{data.periodLabel}</span>
        <span className={styles.summaryDot}>·</span>
        <span className={styles.summaryLabel}>{data.periodSubLabel}</span>
        <span className={styles.summaryDot}>·</span>
        <span className={styles.summaryLabel}>
          {data.rows.length}{" "}
          {data.rows.length === 1 ? "conductor" : "conductores"}
        </span>
      </div>

      {/* Tabla */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.thSticky}`}>Conductor</th>
              <th className={`${styles.th} ${styles.alignCenter}`} title="Vehículos manejados">
                Vehíc.
              </th>
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
                <td colSpan={COLS.length + 2} className={styles.empty}>
                  Sin conductores con actividad en el período.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.personId} className={styles.row}>
                  <td className={`${styles.td} ${styles.tdSticky}`}>
                    <Link
                      href={`/objeto/conductor/${row.personId}`}
                      className={styles.personLink}
                    >
                      <User size={11} className={styles.personIcon} />
                      <span>{row.personName}</span>
                    </Link>
                  </td>
                  <td className={`${styles.td} ${styles.alignCenter}`}>
                    <span className={styles.vehBadge}>{row.vehiclesUsed}</span>
                  </td>
                  {COLS.map((c) => {
                    const cell = row.metrics[c.key];
                    return (
                      <td
                        key={c.key}
                        className={`${styles.td} ${styles.tdMetric}`}
                      >
                        <span className={styles.metricValue}>
                          {formatValue(cell.value, c.key)}
                        </span>
                        <DeltaInline
                          deltaPct={cell.deltaPct}
                          isReverse={c.reverse}
                        />
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
                {COLS.map((c) => {
                  const t = data.totals[c.key];
                  return (
                    <td
                      key={c.key}
                      className={`${styles.tdFoot} ${styles.tdMetric}`}
                    >
                      <strong className={styles.metricValue}>
                        {formatValue(t.value, c.key)}
                      </strong>
                      <DeltaInline
                        deltaPct={t.deltaPct}
                        isReverse={c.reverse}
                      />
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
  const cls =
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

function csvEsc(s: string): string {
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
