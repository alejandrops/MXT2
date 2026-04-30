import {
  getFleetAnalysis,
  getFleetMultiMetric,
  getDriversMultiMetric,
  type ScopeFilters,
} from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { VistaEjecutivaClient } from "./VistaEjecutivaClient";

// ═══════════════════════════════════════════════════════════════
//  /direccion/vista-ejecutiva
//  ─────────────────────────────────────────────────────────────
//  Movido desde /actividad/dashboard.
//  Es vista snapshot del mes corriente · KPIs grandes, tendencia,
//  top performers, anomalías destacadas. Pensada para director
//  que entra una vez por semana a tener un pulse general · NO
//  para operador que ve datos a diario.
//
//  Multi-tenant scope (U1b): el scope.accountId pasa por
//  resolveAccountScope. Para CA y OP, los KPIs de la vista
//  ejecutiva representan SOLO su cuenta. Para SA y MA, la flota
//  completa cross-account.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VistaEjecutivaPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const get = (k: string): string | null => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === "string" && v.length > 0 ? v : null;
  };

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(
    todayLocal.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const anchor = get("d") ?? todayIso;

  // Multi-tenant scope (U1b)
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "direccion", null);

  const scope: ScopeFilters = {
    accountId: scopedAccountId,
  };

  const [analysis, fleetMulti, driversMulti] = await Promise.all([
    getFleetAnalysis({
      granularity: "month-days",
      anchor,
      metric: "distanceKm",
      scope,
    }),
    getFleetMultiMetric({
      granularity: "month-days",
      anchor,
      metric: "distanceKm",
      scope,
    }),
    getDriversMultiMetric({
      granularity: "month-days",
      anchor,
      metric: "distanceKm",
      scope,
    }),
  ]);

  return (
    <VistaEjecutivaClient
      analysis={analysis}
      fleetMulti={fleetMulti}
      driversMulti={driversMulti}
    />
  );
}
