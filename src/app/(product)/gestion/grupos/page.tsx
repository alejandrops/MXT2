import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /gestion/grupos · ARCHIVADO · redirect al Catálogo
//  ─────────────────────────────────────────────────────────────
//  Ruta migrada a /catalogos/grupos. Se mantiene como redirect
//  para no romper bookmarks ni los hrefs del código que aún
//  apuntan a /gestion/*.
//
//  TODO post-MVP · reemplazar esos hrefs en componentes para
//  navegar directo a /catalogos/* y eliminar este redirect.
// ═══════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GruposArchivedPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") params.set(k, v);
    else if (Array.isArray(v) && v[0]) params.set(k, v[0]);
  }
  const qs = params.toString();
  redirect(`/catalogos/grupos${qs ? `?${qs}` : ""}`);
}
