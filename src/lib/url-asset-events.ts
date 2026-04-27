// ═══════════════════════════════════════════════════════════════
//  URL helpers for the "Eventos" tab in Libro B (Sub-lote 3.2)
//  ─────────────────────────────────────────────────────────────
//  The Libro B page hosts multiple tabs, each potentially with
//  its own filters. To avoid name collisions in the shared
//  searchParams space we namespace this tab's params with an
//  `event*` prefix.
//
//  Example URLs:
//    /gestion/vehiculos/abc?tab=eventos
//    /gestion/vehiculos/abc?tab=eventos&eventType=HARSH_BRAKING
//    /gestion/vehiculos/abc?tab=eventos&eventSeverity=CRITICAL&eventPage=2
//
//  The `tab` param itself stays as-is (managed by the parent
//  Tabs component).
// ═══════════════════════════════════════════════════════════════

import type { EventType, Severity } from "@/types/domain";

export interface AssetEventsParams {
  eventType: EventType | null;
  eventSeverity: Severity | null;
  eventPage: number;
}

const VALID_EVENT_TYPE: EventType[] = [
  // Conducción
  "HARSH_BRAKING",
  "HARSH_ACCELERATION",
  "HARSH_CORNERING",
  "SPEEDING",
  "IDLING",
  "IGNITION_ON",
  "IGNITION_OFF",
  // Seguridad
  "PANIC_BUTTON",
  "UNAUTHORIZED_USE",
  "DOOR_OPEN",
  "SIDE_DOOR_OPEN",
  "CARGO_DOOR_OPEN",
  "TRAILER_DETACH",
  "GPS_DISCONNECT",
  "POWER_DISCONNECT",
  "JAMMING_DETECTED",
  "SABOTAGE",
  // Transversales
  "GEOFENCE_ENTRY",
  "GEOFENCE_EXIT",
];

const VALID_SEVERITY: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function parseAssetEventsParams(
  raw: Record<string, string | string[] | undefined>,
): AssetEventsParams {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const typeRaw = get("eventType");
  const eventType =
    typeRaw && (VALID_EVENT_TYPE as string[]).includes(typeRaw)
      ? (typeRaw as EventType)
      : null;

  const sevRaw = get("eventSeverity");
  const eventSeverity =
    sevRaw && (VALID_SEVERITY as string[]).includes(sevRaw)
      ? (sevRaw as Severity)
      : null;

  const pageRaw = get("eventPage");
  const pageNum = pageRaw ? parseInt(pageRaw, 10) : 1;
  const eventPage = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return { eventType, eventSeverity, eventPage };
}

/**
 * Build a URL for the Eventos tab of a given asset, preserving
 * the asset id and applying override filters.
 *
 * Always keeps `?tab=eventos` so the user stays on this tab.
 * Defaults are omitted from the URL (eventPage=1).
 */
export function buildAssetEventsHref(
  assetId: string,
  current: AssetEventsParams,
  override: Partial<AssetEventsParams>,
): string {
  const isFilterChange =
    "eventType" in override || "eventSeverity" in override;

  const merged: AssetEventsParams = {
    ...current,
    ...override,
    eventPage:
      "eventPage" in override
        ? override.eventPage!
        : isFilterChange
          ? 1
          : current.eventPage,
  };

  const params = new URLSearchParams();
  params.set("tab", "eventos");
  if (merged.eventType) params.set("eventType", merged.eventType);
  if (merged.eventSeverity) params.set("eventSeverity", merged.eventSeverity);
  if (merged.eventPage !== 1) params.set("eventPage", String(merged.eventPage));

  return `/gestion/vehiculos/${assetId}?${params.toString()}`;
}

export function hasActiveAssetEventsFilters(p: AssetEventsParams): boolean {
  return Boolean(p.eventType || p.eventSeverity);
}
