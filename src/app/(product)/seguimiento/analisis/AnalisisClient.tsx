"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
} from "lucide-react";
import {
  type ActivityMetric,
  type AnalysisGranularity,
  type FleetAnalysisData,
  type ScopeFilters,
} from "@/lib/queries";
import { MetricSelector } from "@/components/maxtracker/activity/MetricSelector";
import { FleetHeatmap } from "@/components/maxtracker/analysis/FleetHeatmap";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { TrendLine } from "@/components/maxtracker/analysis/TrendLine";
import styles from "./AnalisisClient.module.css";

const BASE_PATH = "/seguimiento/analisis";

interface Props {
  data: FleetAnalysisData;
}

const GRANULARITY_TABS: {
  key: AnalysisGranularity;
  label: string;
  hint: string;
}[] = [
  { key: "day-hours", label: "Día", hint: "por horas" },
  { key: "week-days", label: "Semana", hint: "por días" },
  { key: "month-days", label: "Mes", hint: "por días" },
  { key: "year-weeks", label: "Año", hint: "por semanas" },
  { key: "year-months", label: "Año", hint: "por meses" },
];

// Las granularidades cortas (día, semana) no necesitan trend abajo
const SHOW_TREND: Record<AnalysisGranularity, boolean> = {
  "day-hours": false,
  "week-days": false,
  "month-days": true,
  "year-weeks": true,
  "year-months": true,
};

export function AnalisisClient({ data }: Props) {
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

  function goPrev() {
    nav({ d: data.prevAnchorIso });
  }
  function goNext() {
    if (data.nextAnchorIso) nav({ d: data.nextAnchorIso });
  }
  function goToday() {
    nav({ d: null });
  }
  function setGranularity(g: AnalysisGranularity) {
    nav({ g });
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

  return (
    <>
      {/* ── Top toolbar · granularity + metric ─────────────── */}
      <div className={styles.toolbar}>
        <div className={styles.granularityTabs}>
          {GRANULARITY_TABS.map((tab) => {
            const active = tab.key === data.granularity;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setGranularity(tab.key)}
                className={`${styles.granTab} ${active ? styles.granTabActive : ""}`}
              >
                <span className={styles.granLabel}>{tab.label}</span>
                <span className={styles.granHint}>{tab.hint}</span>
              </button>
            );
          })}
        </div>

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

      {/* ── Period header ──────────────────────────────────── */}
      <div className={styles.periodHeader}>
        <div className={styles.periodNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goPrev}
            title="Período anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className={styles.todayBtn}
            onClick={goToday}
            title="Volver a hoy"
          >
            <CalendarDays size={12} />
            <span>Hoy</span>
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goNext}
            disabled={data.nextAnchorIso === null}
            title={data.nextAnchorIso ? "Período siguiente" : "Sin futuro"}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={styles.periodLabel}>
          <span className={styles.periodTitle}>{data.periodLabel}</span>
          <span className={styles.periodSub}>{data.periodSubLabel}</span>
        </div>

        <div className={styles.periodMetrics}>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>{data.metricLabel}</span>
            <span className={styles.metricValue}>
              {formatValue(data.total, data.metric)}
            </span>
            <Delta
              deltaPct={data.deltaPct}
              previous={data.previousTotal}
              metric={data.metric}
            />
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>{data.averageLabel}</span>
            <span className={styles.metricValueSm}>
              {formatValue(data.averageValue, data.metric)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Heatmap ────────────────────────────────────────── */}
      <section className={styles.heatmapSection}>
        <FleetHeatmap
          data={data}
          onDrill={handleDrill}
          formatValue={(v) => formatValue(v, data.metric)}
        />
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
//  Delta widget
// ═══════════════════════════════════════════════════════════════

function Delta({
  deltaPct,
  previous,
  metric,
}: {
  deltaPct: number | null;
  previous: number | null;
  metric: ActivityMetric;
}) {
  const trend =
    deltaPct === null
      ? "flat"
      : deltaPct > 0.02
        ? "up"
        : deltaPct < -0.02
          ? "down"
          : "flat";
  const isReverseSign =
    metric === "speedingCount" || metric === "highEventCount";
  const sentiment =
    isReverseSign && trend === "up"
      ? styles.deltaBad
      : isReverseSign && trend === "down"
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
        {deltaPct === null
          ? "—"
          : `${(deltaPct * 100 >= 0 ? "+" : "") + (deltaPct * 100).toFixed(1)}%`}
      </span>
      <span className={styles.deltaPrev}>
        {previous !== null
          ? `vs ${formatValue(previous, metric)}`
          : "sin histórico"}
      </span>
    </div>
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
