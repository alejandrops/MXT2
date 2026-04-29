import {
  getFleetAnalysis,
  getFleetMultiMetric,
  getDriversAnalysis,
  getDriversMultiMetric,
  type AnalysisGranularity,
  type ActivityMetric,
  type ScopeFilters,
} from "@/lib/queries";
import { ReportesClient } from "./ReportesClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Reportes · 3 ejes (sujeto × modo × vista)
//  ─────────────────────────────────────────────────────────────
//  Lote unificación · Análisis y Reportes se fusionaron en una
//  sola pantalla con 2 modos top-level:
//
//  MODO VISUAL · gráficos exploratorios (data del FleetAnalysis):
//    · heatmap     · matriz vehículos × tiempo (default)
//    · ranking     · barras ordenadas con promedio
//    · multiples   · mini-líneas por vehículo
//
//  MODO TABLA · tablas densas para extraer datos:
//    · time        · pivot vehículos × tiempo (era DistributionView)
//    · metrics     · multi-métrica vehículos
//    · drivers-time    · pivot conductores × tiempo
//    · drivers-metrics · multi-métrica conductores
//
//  URL params:
//    g       · granularity · default month-days
//    d       · anchor ISO
//    m       · metric (en time o visual)
//    grp     · group ids
//    type    · vehicle types
//    driver  · person ids
//    q       · search
//    modo    · visual | tabla (default tabla · backward compat)
//    vista   · solo cuando modo=visual · heatmap|ranking|multiples
//    subject · solo cuando modo=tabla · vehicles (default) | drivers
//    layout  · solo cuando modo=tabla · time (default) | metrics
//
//  Legacy ?mode=fleet-multi y ?mode=drivers-multi siguen
//  funcionando como atajo a tabla.
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

type Modo = "visual" | "tabla";
type VistaVisual = "heatmap" | "ranking" | "multiples";
type Subject = "vehicles" | "drivers";
type Layout = "time" | "metrics";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportesPage({ searchParams }: PageProps) {
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

  // ── Comunes ─────────────────────────────────────────────────
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

  // ── Modo top-level ──────────────────────────────────────────
  const modoRaw = get("modo");
  const modo: Modo = modoRaw === "visual" ? "visual" : "tabla";

  // ── MODO VISUAL ─────────────────────────────────────────────
  if (modo === "visual") {
    const vistaRaw = get("vista");
    const vista: VistaVisual =
      vistaRaw === "ranking" || vistaRaw === "multiples"
        ? vistaRaw
        : "heatmap";

    const data = await getFleetAnalysis({
      granularity,
      anchor,
      metric,
      scope,
    });

    return (
      <div className={styles.page}>
        <ReportesClient
          modo="visual"
          vista={vista}
          visualData={data}
        />
      </div>
    );
  }

  // ── MODO TABLA · misma lógica de antes ──────────────────────
  let subject: Subject = "vehicles";
  let layout: Layout = "time";

  const subjectRaw = get("subject");
  const layoutRaw = get("layout");
  const modeRaw = get("mode");

  if (subjectRaw === "drivers") subject = "drivers";
  if (layoutRaw === "metrics") layout = "metrics";

  // Legacy mode mappings
  if (!subjectRaw && !layoutRaw && modeRaw) {
    if (modeRaw === "fleet-multi") {
      subject = "vehicles";
      layout = "metrics";
    } else if (modeRaw === "drivers-multi") {
      subject = "drivers";
      layout = "metrics";
    }
  }

  if (subject === "vehicles" && layout === "time") {
    const data = await getFleetAnalysis({
      granularity,
      anchor,
      metric,
      scope,
    });
    return (
      <div className={styles.page}>
        <ReportesClient
          modo="tabla"
          subject="vehicles"
          layout="time"
          data={data}
        />
      </div>
    );
  }
  if (subject === "vehicles" && layout === "metrics") {
    const multiData = await getFleetMultiMetric({
      granularity,
      anchor,
      metric,
      scope,
    });
    return (
      <div className={styles.page}>
        <ReportesClient
          modo="tabla"
          subject="vehicles"
          layout="metrics"
          multiData={multiData}
        />
      </div>
    );
  }
  if (subject === "drivers" && layout === "time") {
    const driversData = await getDriversAnalysis({
      granularity,
      anchor,
      metric,
      scope,
    });
    return (
      <div className={styles.page}>
        <ReportesClient
          modo="tabla"
          subject="drivers"
          layout="time"
          driversData={driversData}
        />
      </div>
    );
  }
  // drivers + metrics
  const driversMultiData = await getDriversMultiMetric({
    granularity,
    anchor,
    metric,
    scope,
  });
  return (
    <div className={styles.page}>
      <ReportesClient
        modo="tabla"
        subject="drivers"
        layout="metrics"
        driversMultiData={driversMultiData}
      />
    </div>
  );
}
