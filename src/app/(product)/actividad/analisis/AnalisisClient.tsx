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
import { AnalysisKpiStrip } from "@/components/maxtracker/analysis/AnalysisKpiStrip";
import { FleetHeatmap } from "@/components/maxtracker/analysis/FleetHeatmap";
import { FleetRanking } from "@/components/maxtracker/analysis/FleetRanking";
import { FleetSmallMultiples } from "@/components/maxtracker/analysis/FleetSmallMultiples";
import {
  ViewToggle,
  type AnalysisView,
} from "@/components/maxtracker/analysis/ViewToggle";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { TrendLine } from "@/components/maxtracker/analysis/TrendLine";
import styles from "./AnalisisClient.module.css";

const BASE_PATH = "/actividad/analisis";

interface Props {
  data: FleetAnalysisData;
  view: AnalysisView;
}

// Las granularidades cortas (día, semana) no necesitan trend abajo
const SHOW_TREND: Record<AnalysisGranularity, boolean> = {
  "day-hours": false,
  "week-days": false,
  "month-days": true,
  "year-weeks": true,
  "year-months": true,
};

export function AnalisisClient({ data, view }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    m?: ActivityMetric;
    scope?: ScopeFilters;
    v?: AnalysisView;
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? data.granularity;
    const d = over.d === null ? null : over.d ?? data.anchorIso;
    const m = over.m ?? data.metric;
    const scope = over.scope ?? data.appliedScope;
    const v = over.v ?? view;

    if (g !== "year-weeks") params.set("g", g);

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
    if (v !== "heatmap") params.set("v", v);

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
  function setView(v: AnalysisView) {
    nav({ v });
  }
  function handleDrill(date: string, drillTo: AnalysisGranularity) {
    nav({ g: drillTo, d: date });
  }

  // Detectar si el ancla actual es "hoy"
  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const isAnchorToday = data.anchorIso === todayIso;

  return (
    <>
      {/* ── Top toolbar · navigator + metric ────────────────── */}
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
      </div>

      {/* ── Scope filters ──────────────────────────────────── */}
      <ScopeFiltersBar
        scope={data.appliedScope}
        available={data.scope}
        rowCount={data.rows.length}
        onChange={setScope}
      />

      {/* ── KPI strip · resumen ejecutivo del período ──────── */}
      <AnalysisKpiStrip data={data} formatValue={formatValue} />

      {/* ── Period title bar ───────────────────────────────── */}
      <div className={styles.periodHeader}>
        <span className={styles.periodTitle}>{data.periodLabel}</span>
        <span className={styles.periodSub}>{data.periodSubLabel}</span>
        <span className={styles.periodSub}>·</span>
        <span className={styles.periodAvg}>
          {data.averageLabel}: <strong>{formatValue(data.averageValue, data.metric)}</strong>
        </span>
      </div>

      {/* ── View toggle + visualización principal ──────────── */}
      <section className={styles.viewSection}>
        <div className={styles.viewToggleRow}>
          <ViewToggle value={view} onChange={setView} />
        </div>
        <div className={styles.viewBody}>
          {view === "heatmap" && (
            <FleetHeatmap
              data={data}
              onDrill={handleDrill}
              formatValue={(v) => formatValue(v, data.metric)}
            />
          )}
          {view === "ranking" && (
            <FleetRanking
              data={data}
              formatValue={formatValue}
              onDrill={handleDrill}
            />
          )}
          {view === "multiples" && (
            <FleetSmallMultiples data={data} formatValue={formatValue} />
          )}
        </div>
      </section>

      {/* ── Trend (solo en granularidades largas) ──────────── */}
      {SHOW_TREND[data.granularity] && data.trend.length > 0 && (
        <section className={styles.trendSection}>
          <header className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Evolución agregada</h2>
            <span className={styles.cardSub}>
              Suma de toda la flota seleccionada por{" "}
              {data.granularity === "month-days"
                ? "día"
                : data.granularity === "year-weeks"
                  ? "semana"
                  : "mes"}
            </span>
          </header>
          <TrendLine
            points={data.trend}
            label={data.metricLabel}
            formatValue={(v) => formatValue(v, data.metric)}
          />
        </section>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Format helpers
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
