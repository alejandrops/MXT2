// ═══════════════════════════════════════════════════════════════
//  URL helpers for /objeto/vehiculo/[id]?tab=historico
//  ─────────────────────────────────────────────────────────────
//  El tab "Histórico" embebe TripsTable filtrado por assetId.
//  Reusa los tipos de TripsParams (sort/dir) pero el href siempre
//  vuelve a /objeto/vehiculo/[id] preservando ?tab=historico.
//
//  El rango de fechas no es URL-driven en este lote · va fijo a
//  los últimos 30 días (consistente con la KPI strip de la 360).
//  Si en el futuro se quiere selector de fechas, se agrega from/to
//  acá y la página los lee.
// ═══════════════════════════════════════════════════════════════

import type { TripsParams, SortKey } from "./url-trips";

export function buildAssetHistoricoHref(
  assetId: string,
  current: TripsParams,
  override: Partial<TripsParams>,
): string {
  const merged: TripsParams = { ...current, ...override };
  const params = new URLSearchParams();
  params.set("tab", "historico");
  if (merged.sort !== "startedAt") {
    params.set("sort", merged.sort);
  }
  if (merged.sortDir !== "desc") {
    params.set("dir", merged.sortDir);
  }
  return `/objeto/vehiculo/${assetId}?${params.toString()}`;
}

/**
 * Parse just the sort/dir bits relevant to the embedded Histórico
 * tab. Date range is not URL-driven here · the page fixes it.
 */
export function parseAssetHistoricoSort(
  raw: Record<string, string | string[] | undefined>,
): { sort: SortKey; sortDir: "asc" | "desc" } {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };
  const allowed: SortKey[] = [
    "startedAt",
    "asset",
    "driver",
    "distance",
    "duration",
    "events",
  ];
  const sortRaw = get("sort");
  const sort: SortKey =
    sortRaw && allowed.includes(sortRaw as SortKey)
      ? (sortRaw as SortKey)
      : "startedAt";
  const dirRaw = get("dir");
  const sortDir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";
  return { sort, sortDir };
}
