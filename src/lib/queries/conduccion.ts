// @ts-nocheck · pre-existing TS errors (Prisma types stale) · validar post-fixes
// ═══════════════════════════════════════════════════════════════
//  Conducción · queries del módulo
//  ─────────────────────────────────────────────────────────────
//  S4-L3b · Score por conductor (Violation Percentage Method
//  adaptado a solo speeding) + KPIs del Dashboard de Conducción
//  + rankings + lista de infracciones recientes.
//
//  El score sigue la metodología Geotab adaptada:
//    score = 100 - violationPct × MULTIPLIER
//
//  Donde:
//    · violationPct  = (km en exceso / km totales) × 100
//    · MULTIPLIER    = 10 (lineal, configurable post-MVP)
//
//  Si el conductor manejó menos de 1 km en el período, score
//  devuelve null (chip "Sin kms" en UI).
//
//  Período por defecto · últimos 30 días, hardcoded en MVP
//  (alineado con el patrón del Dashboard de Seguridad).
//  Period selector llega con S4-L3c.
//
//  Multi-tenancy · respeta FleetScope (CA/OP ven solo su account,
//  SA/MA cross-account).
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  NEVER_MATCHING_ACCOUNT,
  type FleetScope,
} from "./fleet-metrics";
import { CONDUCCION_DEFAULTS } from "@/lib/conduccion/types";

const MS_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SCOPE: FleetScope = { accountId: null };

/// Período de cálculo por defecto · últimos 30 días.
export const CONDUCCION_DEFAULT_PERIOD_DAYS = 30;

// ───────────────────────────────────────────────────────────────
//  WHEREs por scope · helpers internos
// ───────────────────────────────────────────────────────────────

function infractionWhereForScope(scope: FleetScope): Prisma.InfractionWhereInput {
  if (scope.accountId === NEVER_MATCHING_ACCOUNT) {
    return { id: NEVER_MATCHING_ACCOUNT };
  }
  if (scope.accountId === null) return {};
  return { accountId: scope.accountId };
}

function assetDriverDayWhereForScope(scope: FleetScope): Prisma.AssetDriverDayWhereInput {
  if (scope.accountId === NEVER_MATCHING_ACCOUNT) {
    return { id: NEVER_MATCHING_ACCOUNT };
  }
  if (scope.accountId === null) return {};
  return { accountId: scope.accountId };
}

function personWhereForScope(scope: FleetScope): Prisma.PersonWhereInput {
  if (scope.accountId === NEVER_MATCHING_ACCOUNT) {
    return { id: NEVER_MATCHING_ACCOUNT };
  }
  if (scope.accountId === null) return {};
  return { accountId: scope.accountId };
}

// ───────────────────────────────────────────────────────────────
//  Helpers de cálculo · score Violation Percentage Method
// ───────────────────────────────────────────────────────────────

/// Convierte un par (km totales, km en exceso) en un score 0-100.
/// Devuelve null si km totales < 1 (no hay datos suficientes).
export function violationPercentageScore(
  drivenKm: number,
  infractionKm: number,
): number | null {
  if (drivenKm < CONDUCCION_DEFAULTS.MIN_DISTANCE_FOR_SCORE_KM) {
    return null;
  }
  const violationPct = (infractionKm / drivenKm) * 100;
  const raw = 100 - violationPct * CONDUCCION_DEFAULTS.VIOLATION_PCT_MULTIPLIER;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ═══════════════════════════════════════════════════════════════
//  computeDriverScore · score de UN conductor en un período
//  ─────────────────────────────────────────────────────────────
//  Útil para drill-down y para la pantalla de scorecard. Para
//  rankings / dashboard usar getDriverScoresForPeriod() que hace
//  el cálculo en bulk para todos los conductores.
// ═══════════════════════════════════════════════════════════════

export interface DriverScoreResult {
  score: number | null; // null = "Sin kms"
  drivenKm: number;
  infractionDistKm: number;
  violationPct: number;
}

export async function computeDriverScore(
  driverId: string,
  fromDate: Date,
  toDate: Date,
  scope: FleetScope = DEFAULT_SCOPE,
): Promise<DriverScoreResult> {
  const [drivenAgg, infractionAgg] = await Promise.all([
    db.assetDriverDay.aggregate({
      where: {
        ...assetDriverDayWhereForScope(scope),
        // AssetDriverDay usa personId (no driverId · ése es de Infraction)
        personId: driverId,
        day: { gte: fromDate, lte: toDate },
      },
      _sum: { distanceKm: true },
    }),
    db.infraction.aggregate({
      where: {
        ...infractionWhereForScope(scope),
        driverId,
        status: "ACTIVE",
        startedAt: { gte: fromDate, lte: toDate },
      },
      _sum: { distanceMeters: true },
    }),
  ]);

  const drivenKm = drivenAgg._sum.distanceKm ?? 0;
  const infractionDistKm = (infractionAgg._sum.distanceMeters ?? 0) / 1000;
  const score = violationPercentageScore(drivenKm, infractionDistKm);
  const violationPct = drivenKm >= 1 ? (infractionDistKm / drivenKm) * 100 : 0;

  return { score, drivenKm, infractionDistKm, violationPct };
}

// ═══════════════════════════════════════════════════════════════
//  getDriverScoresForPeriod · scores en bulk de TODOS los
//  conductores activos del scope, con sus métricas en el período.
//  ─────────────────────────────────────────────────────────────
//  Una sola query por la tabla AssetDriverDay (groupBy driverId)
//  + una por Infraction (groupBy driverId) + lookup de personas.
//  No itera por conductor · evita N+1.
// ═══════════════════════════════════════════════════════════════

export interface DriverConduccionRow {
  id: string;
  firstName: string;
  lastName: string;
  score: number | null;
  drivenKm: number;
  infractionCount: number;
  graveCount: number;
}

export async function getDriverScoresForPeriod(
  fromDate: Date,
  toDate: Date,
  scope: FleetScope = DEFAULT_SCOPE,
): Promise<DriverConduccionRow[]> {
  const [drivenByDriver, infractionsByDriver, gravesByDriver] = await Promise.all([
    // Km totales · AssetDriverDay agrupa por personId (no driverId)
    // y personId es NOT NULL en el schema · no hace falta filtro.
    db.assetDriverDay.groupBy({
      by: ["personId"],
      where: {
        ...assetDriverDayWhereForScope(scope),
        day: { gte: fromDate, lte: toDate },
      },
      _sum: { distanceKm: true },
    }),
    // Infracciones · Infraction sí usa driverId (definido por
    // este módulo) y SÍ es nullable · filtramos los huérfanos.
    db.infraction.groupBy({
      by: ["driverId"],
      where: {
        ...infractionWhereForScope(scope),
        status: "ACTIVE",
        startedAt: { gte: fromDate, lte: toDate },
        driverId: { not: null },
      },
      _sum: { distanceMeters: true },
      _count: { _all: true },
    }),
    // Solo graves
    db.infraction.groupBy({
      by: ["driverId"],
      where: {
        ...infractionWhereForScope(scope),
        status: "ACTIVE",
        severity: "GRAVE",
        startedAt: { gte: fromDate, lte: toDate },
        driverId: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  // Index las agregaciones · todas las claves son personId del
  // conductor (en assetDriverDay literal · en Infraction el
  // driverId apunta también a Person.id por FK).
  const kmByDriver = new Map<string, number>();
  for (const row of drivenByDriver) {
    kmByDriver.set(row.personId, row._sum.distanceKm ?? 0);
  }
  const infractionsMap = new Map<
    string,
    { distMeters: number; count: number }
  >();
  for (const row of infractionsByDriver) {
    if (row.driverId) {
      infractionsMap.set(row.driverId, {
        distMeters: row._sum.distanceMeters ?? 0,
        count: row._count._all,
      });
    }
  }
  const gravesMap = new Map<string, number>();
  for (const row of gravesByDriver) {
    if (row.driverId) gravesMap.set(row.driverId, row._count._all);
  }

  // Universo · todos los personIds que aparecen en alguna agregación
  const allIds = new Set<string>([
    ...kmByDriver.keys(),
    ...infractionsMap.keys(),
  ]);

  if (allIds.size === 0) return [];

  const persons = await db.person.findMany({
    where: {
      ...personWhereForScope(scope),
      id: { in: [...allIds] },
    },
    select: { id: true, firstName: true, lastName: true },
  });

  const rows: DriverConduccionRow[] = persons.map((p) => {
    const drivenKm = kmByDriver.get(p.id) ?? 0;
    const infractionData = infractionsMap.get(p.id);
    const infractionDistKm = (infractionData?.distMeters ?? 0) / 1000;
    const score = violationPercentageScore(drivenKm, infractionDistKm);
    return {
      id: p.id,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      score,
      drivenKm,
      infractionCount: infractionData?.count ?? 0,
      graveCount: gravesMap.get(p.id) ?? 0,
    };
  });

  return rows;
}

// ═══════════════════════════════════════════════════════════════
//  getConduccionKpis · 4 KPIs del header del Dashboard
//  ─────────────────────────────────────────────────────────────
//  · fleetScore           · promedio simple de scores válidos
//  · fleetScoreDelta      · diferencia vs período anterior (Δ pts)
//  · kmExcessPct          · (km en exceso / km totales) × 100
//  · driversInRedZone     · cantidad con score < 60
//  · driversTotal         · cantidad con score válido (≥ 1 km)
//  · graveInfractionCount · infracciones GRAVE del período
// ═══════════════════════════════════════════════════════════════

export interface ConduccionKpis {
  fleetScore: number | null;
  fleetScoreDelta: number | null; // null si no hay datos del período anterior
  kmExcessPct: number;
  totalKm: number;
  driversInRedZone: number;
  driversTotal: number;
  graveInfractionCount: number;
}

export async function getConduccionKpis(
  scope: FleetScope = DEFAULT_SCOPE,
  periodDays: number = CONDUCCION_DEFAULT_PERIOD_DAYS,
): Promise<ConduccionKpis> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * MS_DAY);
  const previousPeriodStart = new Date(
    now.getTime() - 2 * periodDays * MS_DAY,
  );

  const [currentScores, previousScores, totals, graveCount] = await Promise.all([
    getDriverScoresForPeriod(periodStart, now, scope),
    getDriverScoresForPeriod(previousPeriodStart, periodStart, scope),
    Promise.all([
      db.assetDriverDay.aggregate({
        where: {
          ...assetDriverDayWhereForScope(scope),
          day: { gte: periodStart, lte: now },
        },
        _sum: { distanceKm: true },
      }),
      db.infraction.aggregate({
        where: {
          ...infractionWhereForScope(scope),
          status: "ACTIVE",
          startedAt: { gte: periodStart, lte: now },
        },
        _sum: { distanceMeters: true },
      }),
    ]),
    db.infraction.count({
      where: {
        ...infractionWhereForScope(scope),
        status: "ACTIVE",
        severity: "GRAVE",
        startedAt: { gte: periodStart, lte: now },
      },
    }),
  ]);

  // Promedio simple de scores no-null
  const fleetScore = avgScoreOf(currentScores);
  const previousFleetScore = avgScoreOf(previousScores);
  const fleetScoreDelta =
    fleetScore != null && previousFleetScore != null
      ? fleetScore - previousFleetScore
      : null;

  const totalKm = totals[0]._sum.distanceKm ?? 0;
  const totalInfractionKm = (totals[1]._sum.distanceMeters ?? 0) / 1000;
  const kmExcessPct = totalKm >= 1 ? (totalInfractionKm / totalKm) * 100 : 0;

  const driversValidScores = currentScores.filter((d) => d.score != null);
  const driversInRedZone = driversValidScores.filter(
    (d) => (d.score ?? 100) < CONDUCCION_DEFAULTS.SCORE_BAND_MEDIO_MIN,
  ).length;

  return {
    fleetScore,
    fleetScoreDelta,
    kmExcessPct,
    totalKm,
    driversInRedZone,
    driversTotal: driversValidScores.length,
    graveInfractionCount: graveCount,
  };
}

function avgScoreOf(rows: DriverConduccionRow[]): number | null {
  const valid = rows.filter((r) => r.score != null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, r) => acc + (r.score as number), 0);
  return Math.round(sum / valid.length);
}

// ═══════════════════════════════════════════════════════════════
//  getWorstConductores / getBestConductores · rankings
//  ─────────────────────────────────────────────────────────────
//  Top-N conductores ordenados por score asc/desc. Usa
//  getDriverScoresForPeriod y ordena en memoria · simple y
//  alcanza para flotas hasta 1000 conductores. Para flotas
//  mayores se puede mover el sort a la DB en una optimización
//  posterior.
// ═══════════════════════════════════════════════════════════════

export async function getWorstConductores(
  limit: number,
  scope: FleetScope = DEFAULT_SCOPE,
  periodDays: number = CONDUCCION_DEFAULT_PERIOD_DAYS,
): Promise<DriverConduccionRow[]> {
  const now = new Date();
  const from = new Date(now.getTime() - periodDays * MS_DAY);
  const all = await getDriverScoresForPeriod(from, now, scope);
  return all
    .filter((d) => d.score != null)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, limit);
}

export async function getBestConductores(
  limit: number,
  scope: FleetScope = DEFAULT_SCOPE,
  periodDays: number = CONDUCCION_DEFAULT_PERIOD_DAYS,
): Promise<DriverConduccionRow[]> {
  const now = new Date();
  const from = new Date(now.getTime() - periodDays * MS_DAY);
  const all = await getDriverScoresForPeriod(from, now, scope);
  return all
    .filter((d) => d.score != null)
    .sort((a, b) => (b.score as number) - (a.score as number))
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════
//  getRecentInfractions · listado para columna izquierda del
//  dashboard. Graves primero, después medias, después leves.
//  Dentro de cada severity, las más recientes primero.
// ═══════════════════════════════════════════════════════════════

export interface RecentInfractionRow {
  id: string;
  startedAt: Date;
  durationSec: number;
  vmaxKmh: number;
  peakSpeedKmh: number;
  maxExcessKmh: number;
  severity: "LEVE" | "MEDIA" | "GRAVE";
  asset: { id: string; name: string; plate: string | null };
  driver: { id: string; firstName: string; lastName: string } | null;
}

export async function getRecentInfractions(
  limit: number,
  scope: FleetScope = DEFAULT_SCOPE,
  periodDays: number = CONDUCCION_DEFAULT_PERIOD_DAYS,
): Promise<RecentInfractionRow[]> {
  const now = new Date();
  const from = new Date(now.getTime() - periodDays * MS_DAY);

  const rows = await db.infraction.findMany({
    where: {
      ...infractionWhereForScope(scope),
      status: "ACTIVE",
      startedAt: { gte: from, lte: now },
    },
    orderBy: [
      // Postgres ordena enums por el orden de declaración en el
      // tipo · GRAVE está último → DESC para tenerlo primero
      { severity: "desc" },
      { startedAt: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      startedAt: true,
      durationSec: true,
      vmaxKmh: true,
      peakSpeedKmh: true,
      maxExcessKmh: true,
      severity: true,
      asset: { select: { id: true, name: true, plate: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    startedAt: r.startedAt,
    durationSec: r.durationSec,
    vmaxKmh: r.vmaxKmh,
    peakSpeedKmh: r.peakSpeedKmh,
    maxExcessKmh: r.maxExcessKmh,
    severity: r.severity,
    asset: {
      id: r.asset.id,
      name: r.asset.name,
      plate: r.asset.plate,
    },
    driver: r.driver
      ? {
          id: r.driver.id,
          firstName: r.driver.firstName ?? "",
          lastName: r.driver.lastName ?? "",
        }
      : null,
  }));
}
