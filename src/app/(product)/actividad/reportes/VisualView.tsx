"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  type ActivityMetric,
  type AnalysisGranularity,
  type FleetAnalysisData,
  type ScopeFilters,
} from "@/lib/queries";
import { MetricSelector } from "@/components/maxtracker/activity/MetricSelector";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { FleetHeatmap } from "@/components/maxtracker/analysis/FleetHeatmap";
import { FleetRanking } from "@/components/maxtracker/analysis/FleetRanking";
import { FleetSmallMultiples } from "@/components/maxtracker/analysis/FleetSmallMultiples";
import { ExportMenu, granularityToPeriod } from "@/components/maxtracker/ui";
import { downloadCsv, csvNum, csvFilename } from "@/lib/utils/csv";
import styles from "./DistributionView.module.css";

// ═══════════════════════════════════════════════════════════════
//  VisualView · modo visual de Reportes (3 vistas)
//  ─────────────────────────────────────────────────────────────
//  Reusa la matriz FleetAnalysisData · misma data que el modo
//  tabla "vehicles × time" (DistributionView). La diferencia es
//  cómo se presenta:
//    · heatmap   · matriz cuadradas tipo GitHub (visual cualitativa)
//    · ranking   · barras horizontales ordenadas (cuantitativa)
//    · multiples · sparklines apiladas (forma temporal)
//
//  Al ser misma data, el toggle entre vistas es inmediato sin
//  refetch. El cambio entre modo Visual ↔ Tabla sí refetcha
//  porque cambia la query.
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/actividad/reportes";

interface Props {
  vista: "heatmap" | "ranking" | "multiples";
  data: FleetAnalysisData;
}

export function VisualView({ vista, data }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    m?: ActivityMetric;
    scope?: ScopeFilters;
  }): string {
    const params = new URLSearchParams();
    params.set("modo", "visual");
    params.set("vista", vista);
    const g = over.g ?? data.granularity;
    const d = over.d === null ? null : over.d ?? data.anchorIso;
    const m = over.m ?? data.metric;
    const scope = over.scope ?? data.appliedScope;

    if (g !== "month-days") params.set("g", g);

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

    return `${BASE_PATH}?${params.toString()}`;
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

  // CSV export · formato simple · vehículo + total + valores por bucket
  function exportCsv() {
    const headers = ["Vehículo", "Patente", "Grupo", "Total"];
    for (let i = 0; i < data.colCount; i++) {
      const lbl = data.colLabels.find((l) => l.col === i);
      headers.push(lbl?.label ?? `Col ${i + 1}`);
    }

    const rows = data.rows.map((row) => {
      const cells: string[] = [
        row.assetName,
        row.assetPlate ?? "",
        row.groupName ?? "",
        csvNum(row.total),
      ];
      for (let i = 0; i < data.colCount; i++) {
        const c = row.cells.find((x) => x.col === i);
        cells.push(c ? csvNum(c.value) : "0");
      }
      return cells;
    });

    downloadCsv({
      filename: csvFilename(`reporte-visual-${vista}-${data.granularity}-${data.anchorIso}`),
      headers,
      rows,
    });
  }

  const printPeriod = granularityToPeriod(data.granularity);

  return (
    <>
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

      <ScopeFiltersBar
        scope={data.appliedScope}
        available={data.scope}
        rowCount={data.rows.length}
        onChange={setScope}
      />

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

      {/* Visual content · cambia según vista */}
      <div style={{ marginTop: 16 }}>
        {vista === "heatmap" && (
          <FleetHeatmap
            data={data}
            onDrill={handleDrill}
            formatValue={(v) => formatValue(v, data.metric)}
          />
        )}
        {vista === "ranking" && (
          <FleetRanking
            data={data}
            formatValue={(v) => formatValue(v, data.metric)}
            onDrill={handleDrill}
          />
        )}
        {vista === "multiples" && (
          <FleetSmallMultiples
            data={data}
            formatValue={(v) => formatValue(v, data.metric)}
          />
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers · idénticos a los de AnalisisClient
// ═══════════════════════════════════════════════════════════════

function formatValue(v: number, metric: ActivityMetric): string {
  if (v === 0) return "0";
  if (metric === "distanceKm") {
    return `${v.toLocaleString("es-AR", {
      maximumFractionDigits: v >= 100 ? 0 : 1,
    })} km`;
  }
  if (metric === "fuelLiters") {
    return `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })} L`;
  }
  if (metric === "activeMin" || metric === "idleMin") {
    return formatMinutes(v);
  }
  if (metric === "maxSpeedKmh") {
    return `${Math.round(v)} km/h`;
  }
  return Math.round(v).toLocaleString("es-AR");
}

function formatMinutes(min: number): string {
  if (min <= 0) return "0h";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
