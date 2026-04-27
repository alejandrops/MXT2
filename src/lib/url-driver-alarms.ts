// ═══════════════════════════════════════════════════════════════
//  URL helpers for the "Alarmas" tab in Libro del Conductor
//  (Sub-lote 3.3)
// ═══════════════════════════════════════════════════════════════

import type { AlarmStatus, AlarmType, Severity } from "@/types/domain";

export interface DriverAlarmsParams {
  driverAlarmStatus: AlarmStatus | null;
  driverAlarmSeverity: Severity | null;
  driverAlarmType: AlarmType | null;
  driverAlarmPage: number;
}

const VALID_STATUS: AlarmStatus[] = ["OPEN", "ATTENDED", "CLOSED", "DISMISSED"];
const VALID_SEVERITY: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// Only Seguridad-domain types here, since this tab lives in the
// Seguridad module.
const VALID_TYPE: AlarmType[] = [
  "PANIC",
  "UNAUTHORIZED_USE",
  "SABOTAGE",
  "GPS_DISCONNECT",
  "POWER_DISCONNECT",
  "JAMMING",
  "TRAILER_DETACH",
  "CARGO_BREACH",
  "DOOR_BREACH",
  "GEOFENCE_BREACH_CRITICAL",
  "DEVICE_OFFLINE",
];

export function parseDriverAlarmsParams(
  raw: Record<string, string | string[] | undefined>,
): DriverAlarmsParams {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const statusRaw = get("driverAlarmStatus");
  const driverAlarmStatus =
    statusRaw && (VALID_STATUS as string[]).includes(statusRaw)
      ? (statusRaw as AlarmStatus)
      : null;

  const sevRaw = get("driverAlarmSeverity");
  const driverAlarmSeverity =
    sevRaw && (VALID_SEVERITY as string[]).includes(sevRaw)
      ? (sevRaw as Severity)
      : null;

  const typeRaw = get("driverAlarmType");
  const driverAlarmType =
    typeRaw && (VALID_TYPE as string[]).includes(typeRaw)
      ? (typeRaw as AlarmType)
      : null;

  const pageRaw = get("driverAlarmPage");
  const pageNum = pageRaw ? parseInt(pageRaw, 10) : 1;
  const driverAlarmPage =
    Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return {
    driverAlarmStatus,
    driverAlarmSeverity,
    driverAlarmType,
    driverAlarmPage,
  };
}

export function buildDriverAlarmsHref(
  personId: string,
  current: DriverAlarmsParams,
  override: Partial<DriverAlarmsParams>,
): string {
  const isFilterChange =
    "driverAlarmStatus" in override ||
    "driverAlarmSeverity" in override ||
    "driverAlarmType" in override;

  const merged: DriverAlarmsParams = {
    ...current,
    ...override,
    driverAlarmPage:
      "driverAlarmPage" in override
        ? override.driverAlarmPage!
        : isFilterChange
          ? 1
          : current.driverAlarmPage,
  };

  const params = new URLSearchParams();
  params.set("tab", "alarmas");
  if (merged.driverAlarmStatus)
    params.set("driverAlarmStatus", merged.driverAlarmStatus);
  if (merged.driverAlarmSeverity)
    params.set("driverAlarmSeverity", merged.driverAlarmSeverity);
  if (merged.driverAlarmType)
    params.set("driverAlarmType", merged.driverAlarmType);
  if (merged.driverAlarmPage !== 1)
    params.set("driverAlarmPage", String(merged.driverAlarmPage));

  return `/gestion/conductores/${personId}?${params.toString()}`;
}

export function hasActiveDriverAlarmsFilters(p: DriverAlarmsParams): boolean {
  return Boolean(
    p.driverAlarmStatus || p.driverAlarmSeverity || p.driverAlarmType,
  );
}
