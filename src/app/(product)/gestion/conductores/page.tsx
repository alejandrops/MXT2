import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /gestion/conductores · ARCHIVADO · redirect al Catálogo
//  ─────────────────────────────────────────────────────────────
//  Ruta migrada a /catalogos/conductores. Se mantiene como
//  redirect para no romper bookmarks ni los 44+ hrefs del código
//  que aún apuntan a /gestion/* (componentes como AlarmCard,
//  DriverScoreCard, FleetRanking, etc).
//
//  TODO post-MVP · reemplazar esos hrefs en componentes para
//  navegar directo a /catalogos/* y eliminar este redirect.
// ═══════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConductoresArchivedPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  // Preservar query string si existe
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") params.set(k, v);
    else if (Array.isArray(v) && v[0]) params.set(k, v[0]);
  }
  const qs = params.toString();
  redirect(`/catalogos/conductores${qs ? `?${qs}` : ""}`);
}
