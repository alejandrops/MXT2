// ═══════════════════════════════════════════════════════════════
//  Safety queries (Pantalla 1 · Dashboard D)
//  ─────────────────────────────────────────────────────────────
//  All queries are async functions returning typed results. Each
//  page Server Component calls them directly via `await`.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type {
  AlarmWithRefs,
  DriverScoreRow,
  SafetyKpis,
} from "@/types/domain";

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Top-line KPIs for the Dashboard D header.
 *
 * Lote 1.2: simple aggregations over current state. Lote 3 will
 * replace the safety score with a precomputed daily snapshot
 * (KpiDailySnapshot entity).
 *
 * NOTE (Sub-lote 3.2.1): Dashboard D belongs to módulo Seguridad,
 * so alarm counts filter by `domain: "SEGURIDAD"`. The driver
 * safety score still uses Conducción events (that's where harsh
 * driving lives), so we don't filter it.
 */
export async function getSafetyKpis(): Promise<SafetyKpis> {
  const yesterday = new Date(Date.now() - MS_DAY);

  const [
    openAlarmsCount,
    criticalAssetsCount,
    events24hCount,
    avgScoreAgg,
  ] = await Promise.all([
    db.alarm.count({
      where: { status: "OPEN", domain: "SEGURIDAD" },
    }),
    db.person.count({ where: { safetyScore: { lt: 60 } } }),
    // Events 24h shows ALL events (both domains) on the dashboard
    // header — it's a "what's happening" indicator. Domain-specific
    // counts live elsewhere.
    db.event.count({ where: { occurredAt: { gte: yesterday } } }),
    db.person.aggregate({ _avg: { safetyScore: true } }),
  ]);

  return {
    openAlarmsCount,
    criticalAssetsCount,
    events24hCount,
    fleetSafetyScore: Math.round(avgScoreAgg._avg.safetyScore ?? 0),
  };
}

/**
 * The newest N open alarms with asset and (optional) person refs
 * already joined. Ordered by triggeredAt desc.
 *
 * Filters by SEGURIDAD domain only — this powers Dashboard D and
 * Libro B alarm panels in the Seguridad module.
 */
export async function getOpenAlarms(limit = 20): Promise<AlarmWithRefs[]> {
  return db.alarm.findMany({
    where: { status: "OPEN", domain: "SEGURIDAD" },
    orderBy: { triggeredAt: "desc" },
    take: limit,
    include: {
      asset: { select: { id: true, name: true, plate: true } },
      person: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

/**
 * Worst-N drivers by safety score (lowest first). Used in the
 * Dashboard D side panel.
 */
export async function getWorstDrivers(limit = 5): Promise<DriverScoreRow[]> {
  const since = new Date(Date.now() - 30 * MS_DAY);

  const drivers = await db.person.findMany({
    orderBy: { safetyScore: "asc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      safetyScore: true,
      _count: {
        select: {
          events: { where: { occurredAt: { gte: since } } },
        },
      },
    },
  });

  return drivers.map((d) => ({
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    safetyScore: d.safetyScore,
    eventCount30d: d._count.events,
  }));
}

/**
 * Top-N assets by event count over the last 30 days. Powers the
 * "assets con más eventos" panel on Dashboard D.
 */
export interface AssetEventCountRow {
  id: string;
  name: string;
  plate: string | null;
  eventCount30d: number;
}

export async function getTopAssetsByEvents(limit = 5): Promise<AssetEventCountRow[]> {
  const since = new Date(Date.now() - 30 * MS_DAY);

  // GroupBy is fine here since we only need counts per asset.
  const grouped = await db.event.groupBy({
    by: ["assetId"],
    where: { occurredAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { assetId: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  // Hydrate the asset metadata in one query.
  const assets = (await db.asset.findMany({
    where: { id: { in: grouped.map((g) => g.assetId) } },
    select: { id: true, name: true, plate: true },
  })) as { id: string; name: string; plate: string | null }[];
  const byId = new Map(assets.map((a) => [a.id, a]));

  return grouped
    .map((g) => {
      const a = byId.get(g.assetId);
      if (!a) return null;
      return {
        id: a.id,
        name: a.name,
        plate: a.plate,
        eventCount30d: g._count._all,
      };
    })
    .filter((r): r is AssetEventCountRow => r !== null);
}
