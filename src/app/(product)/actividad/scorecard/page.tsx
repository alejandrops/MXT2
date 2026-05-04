import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /actividad/scorecard · ARCHIVADO · redirect a /conduccion/scorecard
//  ─────────────────────────────────────────────────────────────
//  S1-L2 ia-reorg · El Scorecard pasó de Actividad a Conducción
//  porque conceptualmente pertenece al módulo de safety/scoring
//  (Hybrid Method de Geotab · cada infracción suma al scoring).
//
//  Esta ruta queda como redirect inteligente para preservar
//  bookmarks viejos · reescribe los searchParams al destino nuevo.
// ═══════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RedirectScorecard({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) qs.set(k, v[0] ?? "");
    else if (typeof v === "string") qs.set(k, v);
  }
  const tail = qs.toString();
  redirect(`/conduccion/scorecard${tail ? `?${tail}` : ""}`);
}
