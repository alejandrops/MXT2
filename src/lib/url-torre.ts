// ═══════════════════════════════════════════════════════════════
//  URL helpers for /seguimiento/torre-de-control
//  ─────────────────────────────────────────────────────────────
//  Params:
//    · alarm    · selected alarm id (string)
//    · sev      · "all" | "high+" | "critical"
//    · domain   · "all" | "CONDUCCION" | "SEGURIDAD"
//    · time     · "all" | "1h" | "today"
//    · attending · "1" para mostrar sólo en-atención
// ═══════════════════════════════════════════════════════════════

import type {
  AlarmDomainFilter,
  AlarmQueueFilter,
  AlarmTimeFilter,
} from "@/lib/queries/torre";

export interface TorreUrlState {
  alarmId: string | null;
  severity: AlarmQueueFilter;
  domain: AlarmDomainFilter;
  time: AlarmTimeFilter;
  attendingOnly: boolean;
}

const VALID_SEV: AlarmQueueFilter[] = ["all", "high+", "critical"];
const VALID_DOM: AlarmDomainFilter[] = ["all", "CONDUCCION", "SEGURIDAD"];
const VALID_TIME: AlarmTimeFilter[] = ["all", "1h", "today"];

export function parseTorreUrl(
  raw: Record<string, string | string[] | undefined>,
): TorreUrlState {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const sevRaw = get("sev");
  const domRaw = get("domain");
  const timeRaw = get("time");

  return {
    alarmId: get("alarm"),
    severity:
      sevRaw && (VALID_SEV as string[]).includes(sevRaw)
        ? (sevRaw as AlarmQueueFilter)
        : "all",
    domain:
      domRaw && (VALID_DOM as string[]).includes(domRaw)
        ? (domRaw as AlarmDomainFilter)
        : "all",
    time:
      timeRaw && (VALID_TIME as string[]).includes(timeRaw)
        ? (timeRaw as AlarmTimeFilter)
        : "all",
    attendingOnly: get("attending") === "1",
  };
}

export function buildTorreUrl(
  current: TorreUrlState,
  override: Partial<TorreUrlState>,
): string {
  const next = { ...current, ...override };
  const params = new URLSearchParams();
  if (next.alarmId) params.set("alarm", next.alarmId);
  if (next.severity !== "all") params.set("sev", next.severity);
  if (next.domain !== "all") params.set("domain", next.domain);
  if (next.time !== "all") params.set("time", next.time);
  if (next.attendingOnly) params.set("attending", "1");
  const qs = params.toString();
  return qs ? `/seguimiento/torre-de-control?${qs}` : "/seguimiento/torre-de-control";
}
