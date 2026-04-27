import {
  getAnalysisData,
  type AnalysisGranularity,
  type ActivityMetric,
} from "@/lib/queries";
import { AnalisisClient } from "./AnalisisClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Seguimiento · Análisis
//  ─────────────────────────────────────────────────────────────
//  Navegador temporal estilo GitHub contributions.
//  5 granularidades · drill-down de mayor a menor zoom.
//
//  URL params:
//    · g  · day-hours | week-days | month-days | year-weeks | year-months
//    · d  · YYYY-MM-DD · ancla del período (default: hoy)
//    · m  · métrica (default: distanceKm)
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const VALID_GRANULARITIES: AnalysisGranularity[] = [
  "day-hours",
  "week-days",
  "month-days",
  "year-weeks",
  "year-months",
];

const VALID_METRICS: ActivityMetric[] = [
  "distanceKm",
  "activeMin",
  "idleMin",
  "tripCount",
  "eventCount",
  "highEventCount",
  "speedingCount",
  "maxSpeedKmh",
  "fuelLiters",
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnalisisPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const get = (k: string): string | null => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === "string" && v.length > 0 ? v : null;
  };

  const gRaw = get("g");
  const granularity: AnalysisGranularity =
    gRaw && (VALID_GRANULARITIES as string[]).includes(gRaw)
      ? (gRaw as AnalysisGranularity)
      : "year-weeks";

  const mRaw = get("m");
  const metric: ActivityMetric =
    mRaw && (VALID_METRICS as string[]).includes(mRaw)
      ? (mRaw as ActivityMetric)
      : "distanceKm";

  // Default anchor · hoy AR-local
  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const anchor = get("d") ?? todayIso;

  const data = await getAnalysisData({ granularity, anchor, metric });

  return (
    <div className={styles.page}>
      <AnalisisClient data={data} />
    </div>
  );
}
