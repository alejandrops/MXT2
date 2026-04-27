// ═══════════════════════════════════════════════════════════════
//  URL helpers · Módulo Actividad
//  ─────────────────────────────────────────────────────────────
//  Compartido entre Reportes / Comparativas / Resumen.
//  Params:
//    · period · today | yesterday | 7d | 30d | custom
//    · from   · YYYY-MM-DD (sólo si period=custom)
//    · to     · YYYY-MM-DD (sólo si period=custom)
//    · metric · distanceKm | activeMin | ... (Reportes/Comparativas)
//    · compare · "prev" para activar comparación período anterior
// ═══════════════════════════════════════════════════════════════

import type {
  ActivityMetric,
  ActivityPreset,
} from "@/lib/queries/activity";

export interface ActivityUrlState {
  preset: ActivityPreset;
  customFrom: string | null;
  customTo: string | null;
  metric: ActivityMetric;
  compare: boolean;
}

export interface ActivityUrlOverride {
  preset?: ActivityPreset;
  customFrom?: string | null;
  customTo?: string | null;
  metric?: ActivityMetric;
  compare?: boolean;
}

export function buildActivityUrl(
  basePath: string,
  current: ActivityUrlState,
  override: ActivityUrlOverride = {},
): string {
  const next: ActivityUrlState = { ...current, ...override };
  const params = new URLSearchParams();
  if (next.preset !== "7d") params.set("period", next.preset);
  if (next.preset === "custom") {
    if (next.customFrom) params.set("from", next.customFrom);
    if (next.customTo) params.set("to", next.customTo);
  }
  if (next.metric !== "distanceKm") params.set("metric", next.metric);
  if (next.compare) params.set("compare", "prev");
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
