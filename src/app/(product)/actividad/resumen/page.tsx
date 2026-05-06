import { ActivityViewSwitcher } from "../_views/ActivityViewSwitcher";
import {
  loadReportesData,
  parseReportesParams,
} from "../_lib/loadReportesData";
import { PageHeader } from "@/components/maxtracker/ui";
import styles from "../_views/page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /actividad/resumen · L3.5b
//  ─────────────────────────────────────────────────────────────
//  Pivot sujetos × métricas. Layout forzado a "metrics".
//
//  Combinaciones válidas:
//   · vehicles + tabla → MultiMetricView (tabla wide)
//   · vehicles + visual → ranking de la métrica activa (sin selector vista)
//   · drivers + tabla → DriversMultiMetricView
//   · drivers + visual → forzado a tabla
// ═══════════════════════════════════════════════════════════════

export const revalidate = 60;

const BASE_URL = "/actividad/resumen";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResumenPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = parseReportesParams(sp, "metrics");

  // S3-L4.3 · /resumen no muestra sub-divisiones del período. Si vino
  // con granularity=year-weeks (desde URL legacy o el navegador full),
  // normalizar a year-months · es la única forma de "Año" en simple.
  if (params.granularity === "year-weeks") {
    params.granularity = "year-months";
  }

  // Drivers + visual no soportado · forzamos tabla
  const effectiveModo =
    params.subject === "drivers" && params.modo === "visual"
      ? "tabla"
      : params.modo;

  const result = await loadReportesData({ ...params, modo: effectiveModo });

  return (
    <>
      <PageHeader variant="module" title="Resumen de actividad" helpSlug="actividad/resumen" />
      <div className="appPage">
      {result.kind === "visual-metrics" ? (
        <ActivityViewSwitcher
          layout="metrics"
          modo="visual"
          subject="vehicles"
          multiData={result.multiData}
          baseUrl={BASE_URL}
        />
      ) : result.kind === "visual" && params.subject === "vehicles" ? (
        <ActivityViewSwitcher
          layout="metrics"
          modo="visual"
          subject="vehicles"
          visualData={result.data}
          baseUrl={BASE_URL}
        />
      ) : result.kind === "vehicles-metrics" ? (
        <ActivityViewSwitcher
          layout="metrics"
          modo="tabla"
          subject="vehicles"
          multiData={result.multiData}
          baseUrl={BASE_URL}
        />
      ) : result.kind === "drivers-metrics" ? (
        <ActivityViewSwitcher
          layout="metrics"
          modo="tabla"
          subject="drivers"
          driversMultiData={result.driversMultiData}
          baseUrl={BASE_URL}
        />
      ) : (
        <p>Estado inválido · refrescá la página.</p>
      )}
    </div>
  </>
  );
}
