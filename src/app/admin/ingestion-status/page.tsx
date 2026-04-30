import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canRead } from "@/lib/permissions";
import { IngestionStatusClient } from "./IngestionStatusClient";

// ═══════════════════════════════════════════════════════════════
//  /admin/ingestion-status (O1)
//  ─────────────────────────────────────────────────────────────
//  Pantalla de monitoreo en tiempo real del endpoint de ingestion
//  de flespi. Muestra:
//
//   · Totales acumulados desde el inicio del proceso (received,
//     ok, skipped, duplicates, errors, trips creados/descartados)
//   · Información del último batch (timestamp, tamaño promedio)
//   · Skip reasons desglosados (qué tipo de message falla más)
//   · Devices silenciosos · cuántos dejaron de reportar y desde
//     hace cuánto (5min, 1h, 24h, nunca)
//
//  Datos vienen de `/api/ingest/flespi/metrics` · client-side
//  fetch con auto-refresh cada 30 segundos.
//
//  Visibilidad:
//   · Solo SA y MA · es vista cross-cliente del estado del sistema
//   · CA y OP no llegan acá (no tienen `backoffice_dispositivos`)
//
//  Limitaciones conocidas:
//   · Las métricas son in-memory y se resetean al reiniciar el
//     server. Para producción, exportar a Prometheus/StatsD desde
//     `src/lib/ingestion/metrics.ts` (ya está aislado).
//   · Si el proceso pasa a múltiples instancias (workers o
//     replicas en Vercel/Fly), el counter local pierde sentido
//     · habría que pasar a Redis INCR.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function IngestionStatusPage() {
  const session = await getSession();
  if (!canRead(session, "backoffice_dispositivos")) {
    redirect("/admin");
  }

  return <IngestionStatusClient />;
}
