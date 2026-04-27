// ═══════════════════════════════════════════════════════════════
//  URL helpers for the alarms list (Sub-lote 3.1)
//  ─────────────────────────────────────────────────────────────
//  Mirror of `lib/url.ts` (assets) for the alarms inbox.
//
//  Convention: each list page has its own url-helper module
//  scoped to its filter shape. Don't try to generalize across
//  pages — they evolve independently.
// ═══════════════════════════════════════════════════════════════

import type { AlarmStatus, AlarmType, Severity } from "@/types/domain";

export type AlarmsSortField = "triggeredAt" | "severity";
export type AlarmsSortDir = "asc" | "desc";

export interface AlarmsSearchParams {
  search: string | null;        // matches asset name or plate
  status: AlarmStatus | null;
  severity: Severity | null;
  type: AlarmType | null;
  accountId: string | null;
  sort: AlarmsSortField;
  dir: AlarmsSortDir;
  page: number;
}

const VALID_STATUS: AlarmStatus[] = ["OPEN", "ATTENDED", "CLOSED", "DISMISSED"];
const VALID_SEVERITY: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const VALID_TYPE: AlarmType[] = [
  // Seguridad-only — this URL belongs to the Seguridad inbox.
  // Conducción types are valid AlarmType values but not valid
  // here. If user passes one in URL we ignore it.
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
const VALID_SORT: AlarmsSortField[] = ["triggeredAt", "severity"];

export function parseAlarmsParams(
  raw: Record<string, string | string[] | undefined>,
): AlarmsSearchParams {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const search = get("search");
  const accountId = get("accountId");

  const statusRaw = get("status");
  const status =
    statusRaw && (VALID_STATUS as string[]).includes(statusRaw)
      ? (statusRaw as AlarmStatus)
      : null;

  const severityRaw = get("severity");
  const severity =
    severityRaw && (VALID_SEVERITY as string[]).includes(severityRaw)
      ? (severityRaw as Severity)
      : null;

  const typeRaw = get("type");
  const type =
    typeRaw && (VALID_TYPE as string[]).includes(typeRaw)
      ? (typeRaw as AlarmType)
      : null;

  const sortRaw = get("sort");
  const sort =
    sortRaw && (VALID_SORT as string[]).includes(sortRaw)
      ? (sortRaw as AlarmsSortField)
      : "triggeredAt";

  const dirRaw = get("dir");
  // Default direction depends on sort field: triggeredAt → desc (newest first),
  // severity → desc (most severe first). Both default to desc.
  const dir: AlarmsSortDir = dirRaw === "asc" ? "asc" : "desc";

  const pageRaw = get("page");
  const pageNum = pageRaw ? parseInt(pageRaw, 10) : 1;
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return { search, status, severity, type, accountId, sort, dir, page };
}

export function buildAlarmsHref(
  current: AlarmsSearchParams,
  override: Partial<AlarmsSearchParams>,
): string {
  const isFilterChange =
    "search" in override ||
    "status" in override ||
    "severity" in override ||
    "type" in override ||
    "accountId" in override;

  const merged: AlarmsSearchParams = {
    ...current,
    ...override,
    page: "page" in override ? override.page! : isFilterChange ? 1 : current.page,
  };

  const params = new URLSearchParams();
  if (merged.search) params.set("search", merged.search);
  if (merged.status) params.set("status", merged.status);
  if (merged.severity) params.set("severity", merged.severity);
  if (merged.type) params.set("type", merged.type);
  if (merged.accountId) params.set("accountId", merged.accountId);
  if (merged.sort !== "triggeredAt") params.set("sort", merged.sort);
  if (merged.dir !== "desc") params.set("dir", merged.dir);
  if (merged.page !== 1) params.set("page", String(merged.page));

  const qs = params.toString();
  return qs ? `/seguridad/alarmas?${qs}` : "/seguridad/alarmas";
}

export function hasActiveAlarmFilters(p: AlarmsSearchParams): boolean {
  return Boolean(
    p.search || p.status || p.severity || p.type || p.accountId,
  );
}
