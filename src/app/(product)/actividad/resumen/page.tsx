import { ReportesClient } from "../reportes/ReportesClient";
import {
  loadReportesData,
  parseReportesParams,
} from "../_lib/loadReportesData";
import styles from "../reportes/page.module.css";

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

  // Drivers + visual no soportado · forzamos tabla
  const effectiveModo =
    params.subject === "drivers" && params.modo === "visual"
      ? "tabla"
      : params.modo;

  const result = await loadReportesData({ ...params, modo: effectiveModo });

  return (
    <div className={styles.page}>
      {result.kind === "visual" && params.subject === "vehicles" ? (
        <ReportesClient
          layout="metrics"
          modo="visual"
          subject="vehicles"
          visualData={result.data}
          baseUrl={BASE_URL}
        />
      ) : result.kind === "vehicles-metrics" ? (
        <ReportesClient
          layout="metrics"
          modo="tabla"
          subject="vehicles"
          multiData={result.multiData}
          baseUrl={BASE_URL}
        />
      ) : result.kind === "drivers-metrics" ? (
        <ReportesClient
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
  );
}
