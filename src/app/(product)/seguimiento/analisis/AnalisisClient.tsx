"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  type AnalysisData,
  type AnalysisGranularity,
} from "@/lib/queries";
import { MetricSelector } from "@/components/maxtracker/activity/MetricSelector";
import { Heatmap } from "@/components/maxtracker/analysis/Heatmap";
import { TrendLine } from "@/components/maxtracker/analysis/TrendLine";
import styles from "./AnalisisClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  AnalisisClient · una pantalla, 5 granularidades, drill-down
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/seguimiento/analisis";

interface Props {
  data: AnalysisData;
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

export function AnalisisClient({ data }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(over: {
    g?: AnalysisGranularity;
    d?: string;
    m?: ActivityMetric;
  }) {
    const params = new URLSearchParams();
    const g = over.g ?? data.granularity;
    const d = over.d ?? data.anchorIso;
    const m = over.m ?? data.metric;
    if (g !== "year-weeks") params.set("g", g);
    // anchor: solo si no es hoy default
    const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
    if (d !== todayIso) params.set("d", d);
    if (m !== "distanceKm") params.set("m", m);
    const qs = params.toString();
    startTransition(() =>
      router.push(qs ? `${BASE_PATH}?${qs}` : BASE_PATH),
    );
  }

  function goPrev() {
    navigate({ d: data.prevAnchorIso });
  }
  function goNext() {
    if (data.nextAnchorIso) navigate({ d: data.nextAnchorIso });
  }
  function goToday() {
    navigate({ d: undefined });
  }
  function setGranularity(g: AnalysisGranularity) {
    navigate({ g });
  }
  function setMetric(m: ActivityMetric) {
    navigate({ m });
  }
  function handleDrill(drillDate: string, drillTo: AnalysisGranularity) {
    navigate({ g: drillTo, d: drillDate });
  }

  const trend = computeTrend(data);

  return (
    <>
      {/* ── Top toolbar · granularity + period nav + metric ──── */}
      <div className={styles.toolbar}>
        <div className={styles.granularityTabs}>
          {GRANULARITY_TABS.map((tab) => {
            const active = tab.key === data.granularity;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setGranularity(tab.key)}
                className={`${styles.granTab} ${
                  active ? styles.granTabActive : ""
                }`}
              >
                <span className={styles.granLabel}>{tab.label}</span>
                <span className={styles.granHint}>{tab.hint}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.toolbarSpacer} />

        <div className={styles.metricWrap}>
          <MetricSelector value={data.metric} onChange={setMetric} />
        </div>
      </div>

      {/* ── Period header ────────────────────────────────────── */}
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

        <div className={styles.periodTotal}>
          <span className={styles.totalLabel}>{data.metricLabel}</span>
          <span className={styles.totalValue}>
            {formatValue(data.total, data.metric)}
          </span>
          <Delta
            deltaPct={data.deltaPct}
            previous={data.previousTotal}
            metric={data.metric}
          />
        </div>
      </div>

      {/* ── Heatmap principal ────────────────────────────────── */}
      <section className={styles.heatmapSection}>
        <Heatmap
          data={data}
          onDrill={handleDrill}
          formatValue={(v) => formatValue(v, data.metric)}
        />
      </section>

      {/* ── Trend line + Top assets · 2 columnas ─────────────── */}
      <div className={styles.bottom}>
        <section className={`${styles.bottomCard} ${styles.trendCard}`}>
          <header className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Evolución</h2>
            <span className={styles.cardSub}>{trend.subtitle}</span>
          </header>
          <TrendLine
            points={data.trend}
            label={data.metricLabel}
            formatValue={(v) => formatValue(v, data.metric)}
          />
        </section>

        <section className={`${styles.bottomCard} ${styles.topCard}`}>
          <header className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Top 5 vehículos</h2>
            <span className={styles.cardSub}>{data.metricLabel}</span>
          </header>
          {data.topAssets.length === 0 ? (
            <div className={styles.empty}>Sin actividad en el período.</div>
          ) : (
            <table className={styles.topTable}>
              <tbody>
                {data.topAssets.map((a, i) => (
                  <tr key={a.assetId} className={styles.topRow}>
                    <td className={styles.topRank}>#{i + 1}</td>
                    <td className={styles.topName}>
                      <Link
                        href={`/gestion/vehiculos/${a.assetId}`}
                        className={styles.assetLink}
                      >
                        {a.assetName}
                      </Link>
                      {a.assetPlate && (
                        <span className={styles.topPlate}>
                          {a.assetPlate}
                        </span>
                      )}
                    </td>
                    <td className={styles.topGroup}>
                      {a.groupName ?? <span className={styles.dim}>—</span>}
                    </td>
                    <td className={styles.topValue}>
                      <strong>{formatValue(a.value, data.metric)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
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
  const isReverseSign = metric === "speedingCount" || metric === "highEventCount";
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
          ? `vs ${formatValue(previous, metric)} antes`
          : "sin histórico"}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function computeTrend(data: AnalysisData): { subtitle: string } {
  switch (data.granularity) {
    case "day-hours":
      return { subtitle: "Por hora" };
    case "week-days":
      return { subtitle: "Por día" };
    case "month-days":
      return { subtitle: "Por día" };
    case "year-weeks":
      return { subtitle: "Por semana" };
    case "year-months":
      return { subtitle: "Por mes" };
  }
}

function formatValue(v: number, metric: ActivityMetric): string {
  if (v === 0) return "0";
  if (metric === "distanceKm") {
    return `${v.toLocaleString("es-AR", {
      maximumFractionDigits: v >= 100 ? 0 : 1,
    })} km`;
  }
  if (metric === "fuelLiters") {
    return `${v.toLocaleString("es-AR", {
      maximumFractionDigits: 1,
    })} L`;
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
