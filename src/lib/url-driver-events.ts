// ═══════════════════════════════════════════════════════════════
//  URL helpers for the "Eventos" tab in Libro del Conductor
//  (Sub-lote 3.3)
//  ─────────────────────────────────────────────────────────────
//  Mirror of url-asset-events.ts but with `driver*` prefix to
//  namespace from a future Alarmas tab in the same page.
// ═══════════════════════════════════════════════════════════════

import type { EventType, Severity } from "@/types/domain";

export interface DriverEventsParams {
  driverEventType: EventType | null;
  driverEventSeverity: Severity | null;
  driverEventPage: number;
}

const VALID_EVENT_TYPE: EventType[] = [
  "HARSH_BRAKING",
  "HARSH_ACCELERATION",
  "HARSH_CORNERING",
  "SPEEDING",
  "IDLING",
  "IGNITION_ON",
  "IGNITION_OFF",
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
  "GEOFENCE_ENTRY",
  "GEOFENCE_EXIT",
];

const VALID_SEVERITY: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function parseDriverEventsParams(
  raw: Record<string, string | string[] | undefined>,
): DriverEventsParams {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const typeRaw = get("driverEventType");
  const driverEventType =
    typeRaw && (VALID_EVENT_TYPE as string[]).includes(typeRaw)
      ? (typeRaw as EventType)
      : null;

  const sevRaw = get("driverEventSeverity");
  const driverEventSeverity =
    sevRaw && (VALID_SEVERITY as string[]).includes(sevRaw)
      ? (sevRaw as Severity)
      : null;

  const pageRaw = get("driverEventPage");
  const pageNum = pageRaw ? parseInt(pageRaw, 10) : 1;
  const driverEventPage =
    Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return { driverEventType, driverEventSeverity, driverEventPage };
}

export function buildDriverEventsHref(
  personId: string,
  current: DriverEventsParams,
  override: Partial<DriverEventsParams>,
): string {
  const isFilterChange =
    "driverEventType" in override || "driverEventSeverity" in override;

  const merged: DriverEventsParams = {
    ...current,
    ...override,
    driverEventPage:
      "driverEventPage" in override
        ? override.driverEventPage!
        : isFilterChange
          ? 1
          : current.driverEventPage,
  };

  const params = new URLSearchParams();
  params.set("tab", "eventos");
  if (merged.driverEventType) params.set("driverEventType", merged.driverEventType);
  if (merged.driverEventSeverity)
    params.set("driverEventSeverity", merged.driverEventSeverity);
  if (merged.driverEventPage !== 1)
    params.set("driverEventPage", String(merged.driverEventPage));

  return `/gestion/conductores/${personId}?${params.toString()}`;
}

export function hasActiveDriverEventsFilters(p: DriverEventsParams): boolean {
  return Boolean(p.driverEventType || p.driverEventSeverity);
}
