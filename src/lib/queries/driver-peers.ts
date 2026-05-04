// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";
import { DRIVING_BEHAVIOR_EVENT_TYPES } from "@/lib/event-types";

// ═══════════════════════════════════════════════════════════════
//  getDriverPeers · S2-L7
//  ─────────────────────────────────────────────────────────────
//  Análogo de getGroupPeers pero para Libro de Conductor.
//  Devuelve los conductores activos del mismo account con
//  métricas comparables del período. El conductor del Libro
//  aparece destacado en el scatter.
//
//  Filtro · solo conductores con AssetDriverDay en el período
//  (i.e. que efectivamente manejaron). Evita ruido de Persons
//  inactivos o mal cargados.
// ═══════════════════════════════════════════════════════════════

export interface DriverPeer {
  id: string;
  name: string;
  plate: string | null; // null para drivers · solo para shape compat
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
  eventsPer100km: number;
  safetyScore: number;
}

export interface DriverPeersResult {
  accountId: string;
  accountName: string;
  activeId: string;
  peers: DriverPeer[];
}

export async function getDriverPeers(
  personId: string,
  fromDate: string,
  toDate: string,
): Promise<DriverPeersResult | null> {
  const person = await db.person.findUnique({
    where: { id: personId },
    select: {
      accountId: true,
      account: { select: { id: true, name: true } },
    },
  });
  if (!person) return null;

  const fromDt = new Date(`${fromDate}T03:00:00Z`);
  const toDt = new Date(`${toDate}T03:00:00Z`);
  toDt.setUTCDate(toDt.getUTCDate() + 1);

  // 1 · Aggregar AssetDriverDay por personId del account
  const days = await db.assetDriverDay.findMany({
    where: {
      accountId: person.accountId,
      day: { gte: fromDt, lt: toDt },
    },
    select: {
      personId: true,
      distanceKm: true,
      activeMin: true,
      tripCount: true,
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          safetyScore: true,
        },
      },
    },
  });

  if (days.length === 0) return null;

  // 2 · Bucket por personId
  const totals = new Map<
    string,
    {
      id: string;
      name: string;
      safetyScoreBaseline: number;
      distanceKm: number;
      activeMin: number;
      tripCount: number;
    }
  >();

  for (const d of days) {
    const existing = totals.get(d.personId);
    if (existing) {
      existing.distanceKm += d.distanceKm;
      existing.activeMin += d.activeMin;
      existing.tripCount += d.tripCount;
    } else {
      totals.set(d.personId, {
        id: d.personId,
        name: `${d.person.firstName} ${d.person.lastName}`.trim(),
        safetyScoreBaseline: d.person.safetyScore,
        distanceKm: d.distanceKm,
        activeMin: d.activeMin,
        tripCount: d.tripCount,
      });
    }
  }

  if (totals.size < 2) return null;

  // 3 · Eventos por personId (telemetría) en el período
  const eventCounts = await db.event.groupBy({
    by: ["personId"],
    where: {
      asset: { accountId: person.accountId },
      occurredAt: { gte: fromDt, lt: toDt },
      type: { in: DRIVING_BEHAVIOR_EVENT_TYPES as any },
      personId: { not: null },
    },
    _count: { _all: true },
  });
  const eventsByPerson = new Map<string, number>();
  for (const row of eventCounts) {
    if (row.personId) eventsByPerson.set(row.personId, row._count._all);
  }

  // 4 · Proyectar
  const peers: DriverPeer[] = Array.from(totals.values()).map((t) => {
    const eventCount = eventsByPerson.get(t.id) ?? 0;
    const eventsPer100km =
      t.distanceKm > 0 ? (eventCount / t.distanceKm) * 100 : 0;
    return {
      id: t.id,
      name: t.name,
      plate: null,
      distanceKm: Math.round(t.distanceKm * 10) / 10,
      activeMin: t.activeMin,
      tripCount: t.tripCount,
      eventCount,
      eventsPer100km: Math.round(eventsPer100km * 100) / 100,
      // Para drivers usamos directamente el safetyScore de Person
      // (más rico que el proxy de eventos por km)
      safetyScore: t.safetyScoreBaseline,
    };
  });

  return {
    accountId: person.accountId,
    accountName: person.account.name,
    activeId: personId,
    peers,
  };
}
