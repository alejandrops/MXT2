// ═══════════════════════════════════════════════════════════════
//  Helper compartido · L3.5 + L3.5b
//  ─────────────────────────────────────────────────────────────
//  Centraliza el parse de searchParams + carga de datos, usado
//  por las 3 entry points:
//    · /actividad/evolucion   · forces layout="time"
//    · /actividad/resumen     · forces layout="metrics"
//    · /actividad/reportes    · legacy redirect-only
//
//  L3.5b · cuando modo=visual, siempre cargamos FleetAnalysisData
//  (independiente del layout · /resumen visual reusa la misma
//  data que /evolucion visual y muestra solo "ranking").
//
//  NOTA · modo=visual + subject=drivers no está soportado · la
//  pantalla forza modo=tabla en ese caso (defendible · VisualView
//  hoy solo opera sobre vehicles · drivers visual sería L11+).
// ═══════════════════════════════════════════════════════════════

import {
  getDriversAnalysis,
  getDriversMultiMetric,
  getFleetAnalysis,
  getFleetMultiMetric,
  type ActivityMetric,
  type AnalysisGranularity,
  type ScopeFilters,
} from "@/lib/queries";
import { getSession } from "@/lib/session";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";

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

export type ReportesSubject = "vehicles" | "drivers";
export type ReportesLayout = "time" | "metrics";
export type ReportesModo = "visual" | "tabla";
export type ReportesVistaVisual = "heatmap" | "ranking" | "multiples";

export interface ParsedReportesParams {
  granularity: AnalysisGranularity;
  metric: ActivityMetric;
  anchor: string;
  scope: ScopeFilters;
  modo: ReportesModo;
  vista: ReportesVistaVisual;
  subject: ReportesSubject;
  layout: ReportesLayout;
}

/**
 * Parse de searchParams · idéntico al original. Las pages nuevas
 * pueden override `layout` y `subject` con valores forzados.
 */
export function parseReportesParams(
  sp: Record<string, string | string[] | undefined>,
  /** L3.5 · si la página fuerza un layout específico, ignorar
   *  el query param. Default: respetar query param. */
  forceLayout?: ReportesLayout,
  /** Default semana, según hint del HANDOFF */
  defaultGranularity: AnalysisGranularity = "week-days",
): ParsedReportesParams {
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
      : defaultGranularity;

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

  const modoRaw = get("modo");
  const modo: ReportesModo = modoRaw === "visual" ? "visual" : "tabla";

  const vistaRaw = get("vista");
  const vista: ReportesVistaVisual =
    vistaRaw === "ranking" || vistaRaw === "multiples" ? vistaRaw : "heatmap";

  const subjectRaw = get("subject");
  let subject: ReportesSubject = subjectRaw === "drivers" ? "drivers" : "vehicles";

  // L3.5b · drivers + visual no soportado · fall back a tabla
  // (no rompemos URL, solo el render forza tabla)
  // (la decisión final la toma el client · acá solo parseamos)

  let layout: ReportesLayout = "time";
  if (forceLayout) {
    layout = forceLayout;
  } else {
    const layoutRaw = get("layout");
    if (layoutRaw === "metrics") layout = "metrics";
    // Legacy mode mappings · ?mode=fleet-multi / ?mode=drivers-multi
    if (!subjectRaw && !layoutRaw) {
      const modeRaw = get("mode");
      if (modeRaw === "fleet-multi") {
        layout = "metrics";
        subject = "vehicles";
      } else if (modeRaw === "drivers-multi") {
        layout = "metrics";
        subject = "drivers";
      }
    }
  }

  return {
    granularity,
    metric,
    anchor,
    scope,
    modo,
    vista,
    subject,
    layout,
  };
}

/**
 * Carga la data adecuada según subject + layout + modo.
 *
 * L3.5b · si modo=visual, SIEMPRE cargamos FleetAnalysis
 * (independiente de subject/layout). Visual hoy solo soporta
 * vehicles, así que el subject=drivers + modo=visual queda
 * "como si fuera tabla" en el render aunque la URL diga visual.
 */
export async function loadReportesData(params: ParsedReportesParams) {
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "actividad", null);
  const scopeWithAccount: ScopeFilters = {
    ...params.scope,
    accountId: scopedAccountId,
  };

  const args = {
    granularity: params.granularity,
    anchor: params.anchor,
    metric: params.metric,
    scope: scopeWithAccount,
  };

  // S3-L4 · /resumen + visual + vehicles ahora usa el bullet table
  // (vehículos × métricas) en vez del ranking de 1 sola métrica.
  // Carga FleetMultiMetricData igual que la tabla del resumen.
  if (
    params.modo === "visual" &&
    params.subject === "vehicles" &&
    params.layout === "metrics"
  ) {
    return {
      kind: "visual-metrics" as const,
      multiData: await getFleetMultiMetric(args),
    };
  }

  // L3.5b · si modo=visual y subject=vehicles + layout=time, FleetAnalysis
  // sirve para los 3 layouts visuales (heatmap/ranking/multiples).
  if (params.modo === "visual" && params.subject === "vehicles") {
    return { kind: "visual" as const, data: await getFleetAnalysis(args) };
  }

  // Drivers + visual no soportado · cae a tabla
  if (params.subject === "vehicles" && params.layout === "time") {
    return { kind: "vehicles-time" as const, data: await getFleetAnalysis(args) };
  }
  if (params.subject === "vehicles" && params.layout === "metrics") {
    return {
      kind: "vehicles-metrics" as const,
      multiData: await getFleetMultiMetric(args),
    };
  }
  if (params.subject === "drivers" && params.layout === "time") {
    return {
      kind: "drivers-time" as const,
      driversData: await getDriversAnalysis(args),
    };
  }
  return {
    kind: "drivers-metrics" as const,
    driversMultiData: await getDriversMultiMetric(args),
  };
}
