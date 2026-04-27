// ═══════════════════════════════════════════════════════════════
//  Queries for /seguimiento/torre-de-control · alarm queue
//  ─────────────────────────────────────────────────────────────
//  La Torre es ahora un workflow tool · el operador atiende
//  alarmas. Estructura de datos:
//
//    · listAlarmQueue(filters) → AlarmQueueRow[]
//        Lista de alarmas OPEN priorizada (severity desc · luego
//        antigüedad asc · las más viejas sin atender primero).
//        Reads from Alarm + Asset + Person · sin Position.
//
//    · getAlarmDetail(alarmId) → AlarmDetail
//        Detalle completo de una alarma: vehículo, conductor,
//        última posición (LivePosition), eventos previos en las
//        2 horas anteriores al disparo, datos de la alarma misma.
//
//    · getAlarmQueueKpis() → { open, attending, closedToday }
//        Stats compactos para la barra del header.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { ALARM_TYPE_LABEL, EVENT_TYPE_LABEL } from "@/lib/format";

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export type AlarmQueueFilter = "all" | "high+" | "critical";
export type AlarmDomainFilter = "all" | "CONDUCCION" | "SEGURIDAD";
export type AlarmTimeFilter = "all" | "1h" | "today";

export interface AlarmQueueRow {
  id: string;
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  type: string;
  typeLabel: string;
  domain: string;
  severity: string;
  status: string;
  triggeredAt: Date;
  attendedAt: Date | null;
  driverName: string | null;
  /** seconds since triggered · prerendered server-side */
  ageSec: number;
}

export interface AlarmDetail {
  id: string;
  /** Asset · linked to /gestion/vehiculos/[id] from the page */
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  vehicleType: string;
  /** Driver currently assigned to the asset (may be null) */
  driverName: string | null;
  driverDocument: string | null;
  driverPhone: string | null;
  /** Live position from LivePosition table */
  lastLat: number | null;
  lastLng: number | null;
  lastSpeedKmh: number | null;
  lastIgnition: boolean | null;
  msSinceLastSeen: number | null;
  /** Alarm fields */
  type: string;
  typeLabel: string;
  domain: string;
  severity: string;
  status: string;
  triggeredAt: Date;
  attendedAt: Date | null;
  closedAt: Date | null;
  alarmLat: number | null;
  alarmLng: number | null;
  notes: string | null;
  /** Up to 5 events within 2h before triggeredAt · oldest → newest */
  precedingEvents: PrecedingEvent[];
}

export interface PrecedingEvent {
  id: string;
  type: string;
  typeLabel: string;
  severity: string;
  occurredAt: Date;
  /** seconds before the alarm fired */
  secBeforeAlarm: number;
}

export interface AlarmQueueKpis {
  open: number;
  attending: number;
  closedToday: number;
  bySeverity: { critical: number; high: number; medium: number; low: number };
}

// ═══════════════════════════════════════════════════════════════
//  listAlarmQueue
// ═══════════════════════════════════════════════════════════════

interface ListAlarmQueueParams {
  severity?: AlarmQueueFilter;
  domain?: AlarmDomainFilter;
  time?: AlarmTimeFilter;
  /** Include alarms in OPEN status. Default true. */
  includeOpen?: boolean;
  /** Include alarms that have been attended (still OPEN, attendedAt != null) */
  attendingOnly?: boolean;
  limit?: number;
}

export async function listAlarmQueue(
  params: ListAlarmQueueParams = {},
): Promise<AlarmQueueRow[]> {
  const {
    severity = "all",
    domain = "all",
    time = "all",
    attendingOnly = false,
    limit = 200,
  } = params;

  const where: any = { status: "OPEN" };
  if (severity === "critical") where.severity = "CRITICAL";
  else if (severity === "high+")
    where.severity = { in: ["HIGH", "CRITICAL"] };
  if (domain !== "all") where.domain = domain;
  if (attendingOnly) where.attendedAt = { not: null };

  if (time === "1h") {
    where.triggeredAt = { gte: new Date(Date.now() - 60 * 60_000) };
  } else if (time === "today") {
    const AR_OFFSET = 3 * 60 * 60_000;
    const startOfToday = new Date(
      Math.floor((Date.now() - AR_OFFSET) / 86_400_000) * 86_400_000 +
        AR_OFFSET,
    );
    where.triggeredAt = { gte: startOfToday };
  }

  const rows = await db.alarm.findMany({
    where,
    select: {
      id: true,
      assetId: true,
      type: true,
      domain: true,
      severity: true,
      status: true,
      triggeredAt: true,
      attendedAt: true,
      asset: {
        select: {
          name: true,
          plate: true,
          currentDriver: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    take: limit,
  });

  const now = Date.now();

  // Sort: severity DESC · then triggeredAt ASC (older first ·
  // oldest unattended is most urgent). This matches the design:
  // alarms accumulate from newest at the trigger point, but the
  // operator works the OLDEST critical first.
  rows.sort((a: any, b: any) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 0;
    const sb = SEVERITY_ORDER[b.severity] ?? 0;
    if (sa !== sb) return sb - sa;
    return a.triggeredAt.getTime() - b.triggeredAt.getTime();
  });

  return rows.map((r: any): AlarmQueueRow => {
    const driver = r.asset?.currentDriver;
    return {
      id: r.id,
      assetId: r.assetId,
      assetName: r.asset?.name ?? "—",
      assetPlate: r.asset?.plate ?? null,
      type: r.type,
      typeLabel:
        ALARM_TYPE_LABEL[r.type as keyof typeof ALARM_TYPE_LABEL] ??
        String(r.type),
      domain: r.domain,
      severity: r.severity,
      status: r.status,
      triggeredAt: r.triggeredAt,
      attendedAt: r.attendedAt,
      driverName: driver ? `${driver.firstName} ${driver.lastName}` : null,
      ageSec: Math.max(0, Math.floor((now - r.triggeredAt.getTime()) / 1000)),
    };
  });
}

// ═══════════════════════════════════════════════════════════════
//  getAlarmDetail
// ═══════════════════════════════════════════════════════════════

export async function getAlarmDetail(
  alarmId: string,
): Promise<AlarmDetail | null> {
  const alarm = await db.alarm.findUnique({
    where: { id: alarmId },
    select: {
      id: true,
      assetId: true,
      type: true,
      domain: true,
      severity: true,
      status: true,
      triggeredAt: true,
      attendedAt: true,
      closedAt: true,
      lat: true,
      lng: true,
      notes: true,
      asset: {
        select: {
          name: true,
          plate: true,
          vehicleType: true,
          currentDriver: {
            select: {
              firstName: true,
              lastName: true,
              document: true,
            },
          },
          livePosition: {
            select: {
              lat: true,
              lng: true,
              speedKmh: true,
              ignition: true,
              recordedAt: true,
            },
          },
        },
      },
    },
  });

  if (!alarm) return null;

  // Up to 5 events in the 2 hours before triggeredAt
  const lookbackStart = new Date(
    alarm.triggeredAt.getTime() - 2 * 60 * 60_000,
  );
  const eventsRaw = await db.event.findMany({
    where: {
      assetId: alarm.assetId,
      occurredAt: {
        gte: lookbackStart,
        lt: alarm.triggeredAt,
      },
    },
    orderBy: { occurredAt: "desc" },
    take: 5,
    select: {
      id: true,
      type: true,
      severity: true,
      occurredAt: true,
    },
  });

  const driver = alarm.asset?.currentDriver;
  const lp = alarm.asset?.livePosition;
  const now = Date.now();

  return {
    id: alarm.id,
    assetId: alarm.assetId,
    assetName: alarm.asset?.name ?? "—",
    assetPlate: alarm.asset?.plate ?? null,
    vehicleType: alarm.asset?.vehicleType ?? "GENERIC",
    driverName: driver ? `${driver.firstName} ${driver.lastName}` : null,
    driverDocument: driver?.document ?? null,
    // Phone is not in the schema · we use a synthesized AR-style number
    // based on document for the demo. In production this would be a
    // real `Person.phone` column.
    driverPhone: driver?.document
      ? synthesizePhone(driver.document)
      : null,
    lastLat: lp?.lat ?? null,
    lastLng: lp?.lng ?? null,
    lastSpeedKmh: lp?.speedKmh ?? null,
    lastIgnition: lp?.ignition ?? null,
    msSinceLastSeen: lp?.recordedAt
      ? now - lp.recordedAt.getTime()
      : null,
    type: alarm.type,
    typeLabel:
      ALARM_TYPE_LABEL[alarm.type as keyof typeof ALARM_TYPE_LABEL] ??
      String(alarm.type),
    domain: alarm.domain,
    severity: alarm.severity,
    status: alarm.status,
    triggeredAt: alarm.triggeredAt,
    attendedAt: alarm.attendedAt,
    closedAt: alarm.closedAt,
    alarmLat: alarm.lat,
    alarmLng: alarm.lng,
    notes: alarm.notes,
    precedingEvents: eventsRaw
      .map((e: any): PrecedingEvent => ({
        id: e.id,
        type: e.type,
        typeLabel:
          EVENT_TYPE_LABEL[e.type as keyof typeof EVENT_TYPE_LABEL] ??
          String(e.type),
        severity: e.severity,
        occurredAt: e.occurredAt,
        secBeforeAlarm: Math.max(
          0,
          Math.floor(
            (alarm.triggeredAt.getTime() - e.occurredAt.getTime()) / 1000,
          ),
        ),
      }))
      .reverse(), // oldest → newest
  };
}

// ═══════════════════════════════════════════════════════════════
//  getAlarmQueueKpis
// ═══════════════════════════════════════════════════════════════

export async function getAlarmQueueKpis(): Promise<AlarmQueueKpis> {
  const AR_OFFSET = 3 * 60 * 60_000;
  const startOfToday = new Date(
    Math.floor((Date.now() - AR_OFFSET) / 86_400_000) * 86_400_000 + AR_OFFSET,
  );

  const [openRows, closedTodayCount] = await Promise.all([
    db.alarm.findMany({
      where: { status: "OPEN" },
      select: { severity: true, attendedAt: true },
    }),
    db.alarm.count({
      where: {
        status: "CLOSED",
        closedAt: { gte: startOfToday },
      },
    }),
  ]);

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  let attending = 0;
  for (const r of openRows as Array<{
    severity: string;
    attendedAt: Date | null;
  }>) {
    if (r.attendedAt) attending++;
    switch (r.severity) {
      case "CRITICAL":
        bySeverity.critical++;
        break;
      case "HIGH":
        bySeverity.high++;
        break;
      case "MEDIUM":
        bySeverity.medium++;
        break;
      case "LOW":
        bySeverity.low++;
        break;
    }
  }

  return {
    open: openRows.length,
    attending,
    closedToday: closedTodayCount,
    bySeverity,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Demo-only · derive a fake AR phone number from a driver's
 * document so the "Llamar" CTA has something to dial. Production
 * would read Person.phone from a schema column we don't have yet.
 */
function synthesizePhone(document: string): string {
  // 11-9XXX-XXXX (mobile · Buenos Aires area code)
  const digits = document.replace(/\D/g, "").padStart(8, "0").slice(-8);
  return `11-9${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
}
