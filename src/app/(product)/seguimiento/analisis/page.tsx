import {
  getFleetAnalysis,
  type AnalysisGranularity,
  type ActivityMetric,
  type ScopeFilters,
} from "@/lib/queries";
import { AnalisisClient } from "./AnalisisClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Análisis · matriz vehículos × tiempo · GitHub-style
//  ─────────────────────────────────────────────────────────────
//  URL params:
//    · g  · day-hours | week-days | month-days | year-weeks | year-months
//    · d  · YYYY-MM-DD anchor (default hoy)
//    · m  · métrica
//    · grp · group ids (csv)
//    · type · vehicle types (csv)
//    · driver · person ids (csv)
//    · q · search libre
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const VALID_G: AnalysisGranularity[] = [
  "day-hours",
  "week-days",
  "month-days",
  "year-weeks",
  "year-months",
];

const VALID_M: ActivityMetric[] = [
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
  const csv = (k: string): string[] | undefined => {
    const v = get(k);
    if (!v) return undefined;
    return v.split(",").filter(Boolean);
  };

  const gRaw = get("g");
  const granularity: AnalysisGranularity =
    gRaw && (VALID_G as string[]).includes(gRaw)
      ? (gRaw as AnalysisGranularity)
      : "year-weeks";

  const mRaw = get("m");
  const metric: ActivityMetric =
    mRaw && (VALID_M as string[]).includes(mRaw)
      ? (mRaw as ActivityMetric)
      : "distanceKm";

  // Default anchor · hoy AR-local
  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const anchor = get("d") ?? todayIso;

  const scope: ScopeFilters = {
    groupIds: csv("grp"),
    vehicleTypes: csv("type"),
    personIds: csv("driver"),
    search: get("q") ?? undefined,
  };

  const data = await getFleetAnalysis({
    granularity,
    anchor,
    metric,
    scope,
  });

  return (
    <div className={styles.page}>
      <AnalisisClient data={data} />
    </div>
  );
}
