import {
  getFleetAnalysis,
  type AnalysisGranularity,
  type ActivityMetric,
  type ScopeFilters,
} from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { ComparativasClient } from "./ComparativasClient";

// ═══════════════════════════════════════════════════════════════
//  /direccion/comparativas
//  ─────────────────────────────────────────────────────────────
//  Movido desde /actividad/analisis?v=slope.
//  Slope chart · variación entre 2 períodos consecutivos · cada
//  vehículo es una línea con pendiente. Vista analítica para
//  detectar quiénes mejoraron o empeoraron significativamente.
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

export default async function ComparativasPage({ searchParams }: PageProps) {
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

  return <ComparativasClient data={data} />;
}
