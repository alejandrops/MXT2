import {
  getFleetAnalysis,
  type AnalysisGranularity,
  type ActivityMetric,
  type ScopeFilters,
} from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { ComparativaObjetosClient } from "./ComparativaObjetosClient";

// ═══════════════════════════════════════════════════════════════
//  /direccion/comparativa-objetos
//  ─────────────────────────────────────────────────────────────
//  Renombrado en S1-L2 ia-reorg desde /direccion/distribucion-grupos.
//  Pantalla de análisis comparativo cross-objeto · vive en Dirección
//  como espacio de análisis estadístico cross-módulo.
//
//  Hoy contiene boxplot por grupo · pendiente expansión a:
//    · Scatter plot (objeto vs flota · resaltando uno)
//    · Slope chart (período A → período B por objeto)
//    · Otros gráficos comparativos (ver spec del framework de módulo)
//
//  Compat: la URL vieja /direccion/distribucion-grupos redirige acá.
// ═══════════════════════════════════════════════════════════════

export const revalidate = 60;

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

export default async function ComparativaObjetosPage({
  searchParams,
}: PageProps) {
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

  // Multi-tenant scope (U1c)
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "direccion", null);

  const scope: ScopeFilters = {
    accountId: scopedAccountId,
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

  return <ComparativaObjetosClient data={data} />;
}
