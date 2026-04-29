import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /gestion/vehiculos/[id] · ARCHIVADO · redirect al Libro
//  ─────────────────────────────────────────────────────────────
//  Esta pantalla era una versión anterior del Libro del Objeto
//  ("Libro B") · eliminada en el refactor de Catálogos. Toda su
//  funcionalidad consolidó en /objeto/vehiculo/[id].
//
//  Mantengo la ruta como redirect para no romper bookmarks ni
//  links internos del producto · cualquier acceso directo va al
//  Libro nuevo. Los queryParams (?tab=...) no se preservan ·
//  el Libro nuevo usa otra convención.
//
//  IMPORTANTE · funcionalidades pendientes de migrar al Libro:
//    · AssetLiveStatus (ubicación viva, último ping)
//    · AssetDayRouteCard (mini-mapa del día)
//    · Tab Histórico (listado de viajes)
//    · Tab Devices (trackers instalados)
//    · ActivityHeatmap 12 meses
//  Estas se incorporan en lotes próximos del Libro.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ArchivedAssetDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  redirect(`/objeto/vehiculo/${id}`);
}
