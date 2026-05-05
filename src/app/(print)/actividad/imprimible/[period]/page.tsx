import { notFound } from "next/navigation";
import {
  getFleetAnalysis,
  getFleetMultiMetric,
  getDriversMultiMetric,
  type AnalysisGranularity,
  type ScopeFilters,
} from "@/lib/queries";
import { PrintReport, type PrintPeriod } from "../PrintReport";

// ═══════════════════════════════════════════════════════════════
//  /actividad/imprimible/[period]
//  ─────────────────────────────────────────────────────────────
//  Ruta dinámica única · period en {semanal, mensual, anual}
//  Reemplaza 3 rutas separadas:
//    /imprimible/semanal · /imprimible/mensual · /imprimible/anual
//
//  La PrintBar de Reportes ya genera URLs así · no rompe nada.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const VALID_PERIODS: PrintPeriod[] = ["semanal", "mensual", "anual"];

const GRANULARITY_BY_PERIOD: Record<PrintPeriod, AnalysisGranularity> = {
  semanal: "week-days",
  mensual: "month-days",
  anual: "year-months",
};

interface PageProps {
  params: Promise<{ period: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ImprimiblePage({
  params,
  searchParams,
}: PageProps) {
  const { period: periodRaw } = await params;
  if (!(VALID_PERIODS as string[]).includes(periodRaw)) {
    notFound();
  }
  const period = periodRaw as PrintPeriod;
  const granularity = GRANULARITY_BY_PERIOD[period];

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

  const [analysis, fleetMulti, driversMulti] = await Promise.all([
    getFleetAnalysis({
      granularity,
      anchor,
      metric: "distanceKm",
      scope,
    }),
    getFleetMultiMetric({
      granularity,
      anchor,
      metric: "distanceKm",
      scope,
    }),
    getDriversMultiMetric({
      granularity,
      anchor,
      metric: "distanceKm",
      scope,
    }),
  ]);

  return (
    <PrintReport
      period={period}
      analysis={analysis}
      fleetMulti={fleetMulti}
      driversMulti={driversMulti}
    />
  );
}
