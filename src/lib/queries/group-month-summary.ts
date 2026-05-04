// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";
import { DRIVING_BEHAVIOR_EVENT_TYPES } from "@/lib/event-types";

// ═══════════════════════════════════════════════════════════════
//  getGroupMonthSummary · S3-L2
//  ─────────────────────────────────────────────────────────────
//  Datos agregados del grupo para el Resumen ejecutivo (360°).
//  Período fijo · últimos 30 días.
//
//  Retorna:
//    · header · nombre, account, assetCount
//    · KPIs · km · viajes · activeMin · score promedio · eventos
//    · topVehicles · top 3 por km
//    · topDrivers · top 3 por km manejados
//    · alarmStats · activos críticos · totales en período
// ═══════════════════════════════════════════════════════════════

export interface GroupMonthSummary {
  group: {
    id: string;
    name: string;
    accountName: string;
    assetCount: number;
    driverCount: number;
  };
  kpis: {
    distanceKm: number;
    activeMin: number;
    tripCount: number;
    eventCount: number;
    eventsPer100km: number;
    avgSafetyScore: number;
    activeAssets: number; // únicos con AssetDriverDay en período
    activeDrivers: number;
  };
  topVehicles: Array<{
    assetId: string;
    name: string;
    plate: string | null;
    distanceKm: number;
    tripCount: number;
  }>;
  topDrivers: Array<{
    personId: string;
    name: string;
    distanceKm: number;
    tripCount: number;
  }>;
  alarmStats: {
    openCount: number;
    closedInPeriod: number;
    criticalOpen: number;
  };
}

export async function getGroupMonthSummary(
  groupId: string,
): Promise<GroupMonthSummary | null> {
  const now = new Date();
  const fromDt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const group = await db.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      accountId: true,
      account: { select: { name: true } },
      assets: {
        select: {
          id: true,
          name: true,
          plate: true,
        },
      },
    },
  });
  if (!group) return null;

  const assetIds = group.assets.map((a) => a.id);
  if (assetIds.length === 0) {
    return {
      group: {
        id: group.id,
        name: group.name,
        accountName: group.account.name,
        assetCount: 0,
        driverCount: 0,
      },
      kpis: {
        distanceKm: 0,
        activeMin: 0,
        tripCount: 0,
        eventCount: 0,
        eventsPer100km: 0,
        avgSafetyScore: 0,
        activeAssets: 0,
        activeDrivers: 0,
      },
      topVehicles: [],
      topDrivers: [],
      alarmStats: { openCount: 0, closedInPeriod: 0, criticalOpen: 0 },
    };
  }

  // Datos agregados del período · usamos AssetDriverDay como en el resto del sistema
  const [days, eventCount, openAlarms, closedInPeriod, criticalOpen] =
    await Promise.all([
      db.assetDriverDay.findMany({
        where: {
          assetId: { in: assetIds },
          day: { gte: fromDt },
        },
        select: {
          assetId: true,
          personId: true,
          distanceKm: true,
          activeMin: true,
          tripCount: true,
          person: {
            select: {
              firstName: true,
              lastName: true,
              safetyScore: true,
            },
          },
        },
      }),
      db.event.count({
        where: {
          assetId: { in: assetIds },
          occurredAt: { gte: fromDt },
          type: { in: DRIVING_BEHAVIOR_EVENT_TYPES as any },
        },
      }),
      db.alarm.count({
        where: {
          assetId: { in: assetIds },
          status: "OPEN",
        },
      }),
      db.alarm.count({
        where: {
          assetId: { in: assetIds },
          closedAt: { gte: fromDt, not: null },
        },
      }),
      db.alarm.count({
        where: {
          assetId: { in: assetIds },
          status: "OPEN",
          severity: "HIGH",
        },
      }),
    ]);

  // Aggregates totales
  const distanceKm =
    Math.round(days.reduce((acc, d) => acc + d.distanceKm, 0) * 10) / 10;
  const activeMin = days.reduce((acc, d) => acc + d.activeMin, 0);
  const tripCount = days.reduce((acc, d) => acc + d.tripCount, 0);

  // Score promedio ponderado por km · si no hay km, simple
  let avgSafetyScore = 0;
  if (days.length > 0) {
    const weighted = days.reduce(
      (acc, d) => {
        const score = d.person?.safetyScore ?? 0;
        return {
          num: acc.num + score * d.distanceKm,
          den: acc.den + d.distanceKm,
        };
      },
      { num: 0, den: 0 },
    );
    avgSafetyScore =
      weighted.den > 0
        ? Math.round(weighted.num / weighted.den)
        : Math.round(
            days.reduce((acc, d) => acc + (d.person?.safetyScore ?? 0), 0) /
              days.length,
          );
  }

  // Sets de únicos
  const activeAssets = new Set(days.map((d) => d.assetId)).size;
  const activeDrivers = new Set(days.map((d) => d.personId)).size;

  // Top vehículos por km
  const assetMeta = new Map(
    group.assets.map((a) => [a.id, { name: a.name, plate: a.plate }]),
  );
  const byAsset = new Map<
    string,
    { distanceKm: number; tripCount: number }
  >();
  for (const d of days) {
    const cur = byAsset.get(d.assetId);
    if (cur) {
      cur.distanceKm += d.distanceKm;
      cur.tripCount += d.tripCount;
    } else {
      byAsset.set(d.assetId, {
        distanceKm: d.distanceKm,
        tripCount: d.tripCount,
      });
    }
  }
  const topVehicles = Array.from(byAsset.entries())
    .map(([assetId, agg]) => ({
      assetId,
      name: assetMeta.get(assetId)?.name ?? "—",
      plate: assetMeta.get(assetId)?.plate ?? null,
      distanceKm: Math.round(agg.distanceKm * 10) / 10,
      tripCount: agg.tripCount,
    }))
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, 3);

  // Top conductores por km
  const byPerson = new Map<
    string,
    { name: string; distanceKm: number; tripCount: number }
  >();
  for (const d of days) {
    const cur = byPerson.get(d.personId);
    const name = `${d.person?.firstName ?? ""} ${d.person?.lastName ?? ""}`.trim();
    if (cur) {
      cur.distanceKm += d.distanceKm;
      cur.tripCount += d.tripCount;
    } else {
      byPerson.set(d.personId, {
        name: name || "Conductor sin nombre",
        distanceKm: d.distanceKm,
        tripCount: d.tripCount,
      });
    }
  }
  const topDrivers = Array.from(byPerson.entries())
    .map(([personId, agg]) => ({
      personId,
      name: agg.name,
      distanceKm: Math.round(agg.distanceKm * 10) / 10,
      tripCount: agg.tripCount,
    }))
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, 3);

  const eventsPer100km =
    distanceKm > 0
      ? Math.round((eventCount / distanceKm) * 100 * 100) / 100
      : 0;

  return {
    group: {
      id: group.id,
      name: group.name,
      accountName: group.account.name,
      assetCount: group.assets.length,
      driverCount: activeDrivers,
    },
    kpis: {
      distanceKm,
      activeMin,
      tripCount,
      eventCount,
      eventsPer100km,
      avgSafetyScore,
      activeAssets,
      activeDrivers,
    },
    topVehicles,
    topDrivers,
    alarmStats: {
      openCount: openAlarms,
      closedInPeriod,
      criticalOpen,
    },
  };
}
