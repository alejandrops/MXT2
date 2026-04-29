import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /gestion/vehiculos · ARCHIVADO · redirect al Catálogo
//  ─────────────────────────────────────────────────────────────
//  Ruta migrada a /catalogos/vehiculos. Se mantiene como
//  redirect para no romper bookmarks ni los hrefs del código
//  que aún apuntan a /gestion/* (AlarmCard, FleetRanking,
//  KanbanView, AeropuertoView, DriverAssetsHeatmap, etc).
//
//  TODO post-MVP · reemplazar esos hrefs en componentes para
//  navegar directo a /catalogos/* y eliminar este redirect.
// ═══════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VehiculosArchivedPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") params.set(k, v);
    else if (Array.isArray(v) && v[0]) params.set(k, v[0]);
  }
  const qs = params.toString();
  redirect(`/catalogos/vehiculos${qs ? `?${qs}` : ""}`);
}
