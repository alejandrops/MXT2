import {
  getFleetAnalysis,
  type AnalysisGranularity,
  type ActivityMetric,
  type ScopeFilters,
} from "@/lib/queries";
import { CorrelacionesClient } from "./CorrelacionesClient";

// ═══════════════════════════════════════════════════════════════
//  /direccion/correlaciones
//  ─────────────────────────────────────────────────────────────
//  Movido desde /actividad/analisis?v=scatter.
//  Scatter X/Y · cada vehículo es un punto · permite explorar
//  correlaciones entre 2 métricas (ej: distancia vs excesos).
//  Vista analítica · perfil ejecutivo / consultoría.
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

export default async function CorrelacionesPage({ searchParams }: PageProps) {
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
      : "month-days";

  const mRaw = get("m");
  const metric: ActivityMetric =
    mRaw && (VALID_M as string[]).includes(mRaw)
      ? (mRaw as ActivityMetric)
      : "distanceKm";

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(
    todayLocal.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const anchor = get("d") ?? todayIso;

  const scope: ScopeFilters = {
    groupIds: csv("grp"),
    vehicleTypes: csv("type"),
    personIds: csv("driver"),
    search: get("q") ?? undefined,
  };

  const yRaw = get("y");
  const validY =
    yRaw && (VALID_M as string[]).includes(yRaw)
      ? (yRaw as ActivityMetric)
      : null;
  const metricY: ActivityMetric =
    validY ?? (metric === "distanceKm" ? "speedingCount" : "distanceKm");

  const invertY = get("iy") === "1";

  const data = await getFleetAnalysis({
    granularity,
    anchor,
    metric,
    scope,
  });

  let dataY: typeof data;
  if (metricY !== metric) {
    dataY = await getFleetAnalysis({
      granularity,
      anchor,
      metric: metricY,
      scope,
    });
  } else {
    dataY = data;
  }

  return (
    <CorrelacionesClient
      data={data}
      dataY={dataY}
      metricY={metricY}
      invertY={invertY}
    />
  );
}
