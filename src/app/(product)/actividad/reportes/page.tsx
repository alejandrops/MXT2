import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /actividad/reportes · redirect inteligente · S3-L4.2
//  ─────────────────────────────────────────────────────────────
//  Antes era una pantalla self-contained que duplicaba la lógica
//  de /actividad/evolucion + /actividad/resumen. Era deuda de
//  un refactor incompleto · 3 pantallas haciendo lo mismo.
//
//  Ahora es solo redirect · preserva todos los query params y
//  manda al equivalente correcto:
//
//    layout=metrics  o  mode=fleet-multi/drivers-multi  → /resumen
//    el resto (default · time)                          → /evolucion
//
//  URLs viejas siguen funcionando · ningún link/bookmark roto.
// ═══════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportesRedirectPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const layout = pickStr(sp.layout);
  const modeRaw = pickStr(sp.mode);

  const isMetricsLayout =
    layout === "metrics" ||
    modeRaw === "fleet-multi" ||
    modeRaw === "drivers-multi";

  const target = isMetricsLayout
    ? "/actividad/resumen"
    : "/actividad/evolucion";

  // Preservar todos los query params (excepto `mode` legacy que ya
  // tradujimos a layout). /resumen y /evolucion forzan su layout
  // internamente · el param se ignora si está, no rompe nada.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (key === "mode") continue;
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0]);
    } else {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  redirect(qs ? `${target}?${qs}` : target);
}

function pickStr(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}
