import { ReportesClient } from "../reportes/ReportesClient";
import {
  loadReportesData,
  parseReportesParams,
} from "../_lib/loadReportesData";
import styles from "../reportes/page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /actividad/evolucion · L3.5b
//  ─────────────────────────────────────────────────────────────
//  Pivot sujetos × tiempo. Layout forzado a "time".
//
//  Combinaciones válidas:
//   · vehicles + tabla → DistributionView
//   · vehicles + visual + heatmap/ranking/multiples → VisualView
//   · drivers + tabla → DriversDistributionView
//   · drivers + visual → forzado a tabla (Visual no soporta drivers)
// ═══════════════════════════════════════════════════════════════

export const revalidate = 60;

const BASE_URL = "/actividad/evolucion";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EvolucionPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = parseReportesParams(sp, "time");

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
          layout="time"
          modo="visual"
          subject="vehicles"
          vista={params.vista}
          visualData={result.data}
          baseUrl={BASE_URL}
        />
      ) : result.kind === "vehicles-time" ? (
        <ReportesClient
          layout="time"
          modo="tabla"
          subject="vehicles"
          data={result.data}
          baseUrl={BASE_URL}
        />
      ) : result.kind === "drivers-time" ? (
        <ReportesClient
          layout="time"
          modo="tabla"
          subject="drivers"
          driversData={result.driversData}
          baseUrl={BASE_URL}
        />
      ) : (
        // Fallback defensivo · loadReportesData no devolvería metrics acá
        // (forceLayout="time"), pero TypeScript no lo sabe
        <p>Estado inválido · refrescá la página.</p>
      )}
    </div>
  );
}
