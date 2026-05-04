import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /direccion/distribucion-grupos · ARCHIVADO
//  ─────────────────────────────────────────────────────────────
//  S1-L2 ia-reorg · Pantalla renombrada a "Comparativa entre objetos"
//  porque el alcance se amplió: ahora va a contener no solo boxplot
//  por grupo sino también scatter, slope chart y otros gráficos
//  comparativos cross-objeto (vehículo, conductor, grupo).
//
//  Esta ruta queda como redirect inteligente para preservar
//  bookmarks viejos · reescribe los searchParams al destino nuevo.
// ═══════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RedirectDistribucionGrupos({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) qs.set(k, v[0] ?? "");
    else if (typeof v === "string") qs.set(k, v);
  }
  const tail = qs.toString();
  redirect(`/direccion/comparativa-objetos${tail ? `?${tail}` : ""}`);
}
