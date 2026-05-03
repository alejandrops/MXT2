import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /actividad/analisis · ARCHIVADO · redirect a Reportes visual
//  ─────────────────────────────────────────────────────────────
//  Análisis y Reportes se unificaron en Reportes con 2 modos:
//  Visual (heatmap, ranking, small multiples) · Tabla (distribución
//  por tiempo, multi-métrica). Esta página mantiene la URL para
//  no romper bookmarks · redirige al modo visual.
//
//  Preserva los searchParams · si el usuario tenía un filtro de
//  grupo o granularidad, se mantiene en el redirect.
// ═══════════════════════════════════════════════════════════════

export const revalidate = 60;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnalisisRedirect({ searchParams }: PageProps) {
  const sp = await searchParams;

  // Reescribir params al formato nuevo
  const params = new URLSearchParams();
  params.set("modo", "visual");

  // Mapear v=heatmap|ranking|multiples → vista=...
  const v = pickFirst(sp, "v");
  if (v === "heatmap" || v === "ranking" || v === "multiples") {
    params.set("vista", v);
  } else {
    params.set("vista", "heatmap");
  }

  // Preservar el resto de params · son comunes con Reportes
  const passthrough = ["g", "d", "m", "grp", "type", "driver", "q"];
  for (const key of passthrough) {
    const val = pickFirst(sp, key);
    if (val) params.set(key, val);
  }

  redirect(`/actividad/reportes?${params.toString()}`);
}

function pickFirst(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === "string" && v.length > 0 ? v : null;
}
