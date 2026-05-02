// ═══════════════════════════════════════════════════════════════
//  Safety queries (Pantalla 1 · Dashboard D)
//  ─────────────────────────────────────────────────────────────
//  All queries are async functions returning typed results. Each
//  page Server Component calls them directly via `await`.
//
//  L2B-2 · multi-tenant scope agregado a las 4 queries del módulo.
//  Pre-L2B-2 todas contaban cross-tenant · CA / OP veían datos de
//  otros clientes (cross-tenant leak crítico). Ahora cada query
//  acepta `scope?: FleetScope` con default `{ accountId: null }`
//  para mantener backward compat con callers que no pasan scope
//  (ej · /debug que sí quiere ver cross-tenant).
//
//  La query de alarmas se delega a `getFleetOpenAlarmsCount` del
//  módulo unificado · single source of truth.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  getFleetOpenAlarmsCount,
  type FleetScope,
} from "./fleet-metrics";
import { NEVER_MATCHING_ACCOUNT } from "./tenant-scope";
import type {
  AlarmWithRefs,
  DriverScoreRow,
  SafetyKpis,
} from "@/types/domain";
import type { Prisma } from "@prisma/client";

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Default scope · sin filtro · cross-tenant. Usado por /debug y
 * por callers viejos que aún no pasan scope explícito.
 */
const DEFAULT_SCOPE: FleetScope = { accountId: null };

// ───────────────────────────────────────────────────────────────
//  Helpers internos · WHEREs por scope
// ───────────────────────────────────────────────────────────────

/** Persons del scope · accountId directo. */
function personWhereForScope(scope: FleetScope): Prisma.PersonWhereInput {
  if (scope.accountId === NEVER_MATCHING_ACCOUNT) {
    return { id: NEVER_MATCHING_ACCOUNT };
  }
  if (scope.accountId === null) return {};
  return { accountId: scope.accountId };
}

/**
 * Events del scope · Event.accountId no existe en schema · se filtra
 * vía relación `asset.accountId`.
 */
function eventWhereForScope(scope: FleetScope): Prisma.EventWhereInput {
  if (scope.accountId === NEVER_MATCHING_ACCOUNT) {
    return { asset: { id: NEVER_MATCHING_ACCOUNT } };
  }
  if (scope.accountId === null) return {};
  return { asset: { accountId: scope.accountId } };
}

/** Asset del scope · accountId directo. */
function assetWhereForScope(scope: FleetScope): Prisma.AssetWhereInput {
  if (scope.accountId === NEVER_MATCHING_ACCOUNT) {
    return { id: NEVER_MATCHING_ACCOUNT };
  }
  if (scope.accountId === null) return {};
  return { accountId: scope.accountId };
}

// ═══════════════════════════════════════════════════════════════
//  getSafetyKpis · 4 KPIs del header del Dashboard D
//  ─────────────────────────────────────────────────────────────
//  Top-line KPIs · alarmas abiertas, assets críticos, eventos 24h,
//  fleet safety score (promedio).
// ═══════════════════════════════════════════════════════════════

export async function getSafetyKpis(
  scope: FleetScope = DEFAULT_SCOPE,
): Promise<SafetyKpis> {
  const yesterday = new Date(Date.now() - MS_DAY);

  const [
    openAlarmsCount,
    criticalAssetsCount,
    events24hCount,
    avgScoreAgg,
  ] = await Promise.all([
    // L2B-2 · delega a fleet-metrics · single source of truth
    getFleetOpenAlarmsCount(scope, { domain: "SEGURIDAD" }),
    db.person.count({
      where: {
        ...personWhereForScope(scope),
        safetyScore: { lt: 60 },
      },
    }),
    db.event.count({
      where: {
        ...eventWhereForScope(scope),
        occurredAt: { gte: yesterday },
      },
    }),
    db.person.aggregate({
      where: personWhereForScope(scope),
      _avg: { safetyScore: true },
    }),
  ]);

  return {
    openAlarmsCount,
    criticalAssetsCount,
    events24hCount,
    fleetSafetyScore: Math.round(avgScoreAgg._avg.safetyScore ?? 0),
  };
}

// ═══════════════════════════════════════════════════════════════
//  getOpenAlarms · lista de alarmas abiertas para el Dashboard D
//  ─────────────────────────────────────────────────────────────
//  Filtra por domain SEGURIDAD · powers Dashboard D y Libro B
//  alarm panels en el módulo Seguridad. Para Conducción se necesita
//  pasar otro domain explícito (futuro).
// ═══════════════════════════════════════════════════════════════

export async function getOpenAlarms(
  limit = 20,
  scope: FleetScope = DEFAULT_SCOPE,
): Promise<AlarmWithRefs[]> {
  // Alarm tiene accountId directo · no se necesita join.
  const accountWhere: Prisma.AlarmWhereInput =
    scope.accountId === NEVER_MATCHING_ACCOUNT
      ? { id: NEVER_MATCHING_ACCOUNT }
      : scope.accountId
        ? { accountId: scope.accountId }
        : {};

  return db.alarm.findMany({
    where: {
      ...accountWhere,
      status: "OPEN",
      domain: "SEGURIDAD",
    },
    orderBy: { triggeredAt: "desc" },
    take: limit,
    include: {
      asset: { select: { id: true, name: true, plate: true } },
      person: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  getWorstDrivers · top-N peor safetyScore
//  ─────────────────────────────────────────────────────────────
//  Powers el panel "Top conductores · peor score" del Dashboard D.
// ═══════════════════════════════════════════════════════════════

export async function getWorstDrivers(
  limit = 5,
  scope: FleetScope = DEFAULT_SCOPE,
): Promise<DriverScoreRow[]> {
  const since = new Date(Date.now() - 30 * MS_DAY);

  const drivers = await db.person.findMany({
    where: personWhereForScope(scope),
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

// ═══════════════════════════════════════════════════════════════
//  getTopAssetsByEvents · top-N assets con más eventos en 30d
// ═══════════════════════════════════════════════════════════════

export interface AssetEventCountRow {
  id: string;
  name: string;
  plate: string | null;
  eventCount30d: number;
}

export async function getTopAssetsByEvents(
  limit = 5,
  scope: FleetScope = DEFAULT_SCOPE,
): Promise<AssetEventCountRow[]> {
  const since = new Date(Date.now() - 30 * MS_DAY);

  // GroupBy filtrado por scope vía relación asset.accountId.
  const grouped = await db.event.groupBy({
    by: ["assetId"],
    where: {
      ...eventWhereForScope(scope),
      occurredAt: { gte: since },
    },
    _count: { _all: true },
    orderBy: { _count: { assetId: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  // Hydrate metadata · scope ya aplicado al groupBy, los assets
  // resultantes están todos dentro del scope.
  const assets = (await db.asset.findMany({
    where: {
      ...assetWhereForScope(scope),
      id: { in: grouped.map((g) => g.assetId) },
    },
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
