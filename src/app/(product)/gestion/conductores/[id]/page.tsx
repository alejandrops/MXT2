import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /gestion/conductores/[id] · ARCHIVADO · redirect al Libro
//  ─────────────────────────────────────────────────────────────
//  Versión anterior del Libro del Conductor. Funcionalidad
//  consolidada en /objeto/conductor/[id].
//
//  IMPORTANTE · funcionalidades pendientes de migrar al Libro:
//    · Tab Vehículos manejados (DriverAssetsPanel)
//    · ActivityHeatmap 12 meses
//    · Eventos y alarmas paginados con filtros
//  Estas se incorporan en lotes próximos del Libro.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ArchivedDriverDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  redirect(`/objeto/conductor/${id}`);
}
