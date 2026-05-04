// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════
//  admin-drivers.ts · queries del backoffice cross-cliente
//  ─────────────────────────────────────────────────────────────
//  Twin de admin-assets.ts pero para conductores.
//  Sin tenant scope · SA/MA ven los conductores de TODOS los
//  clientes. Muestra info comercial + status de licencia y la
//  asignación operativa al asset que conduce ahora (si es que
//  alguno).
// ═══════════════════════════════════════════════════════════════

export interface AdminDriverRow {
  id: string;
  firstName: string;
  lastName: string;
  document: string | null;
  licenseExpiresAt: Date | null;
  hiredAt: Date | null;
  safetyScore: number;
  account: { id: string; name: string };
  /** El primer asset que conduce actualmente · null si no maneja */
  currentAsset: {
    id: string;
    name: string;
    plate: string | null;
  } | null;
  /** Cantidad TOTAL de assets asignados (puede ser 0, 1, o N) */
  assetsAssignedCount: number;
  /** Eventos en los últimos 30 días */
  events30d: number;
  /** Licencia vencida o por vencer (< 30 días) */
  licenseStatus: "ok" | "expiring_soon" | "expired" | "unknown";
}

export interface AdminDriverListResult {
  rows: AdminDriverRow[];
  total: number;
}

export interface AdminDriverCounts {
  total: number;
  withAssignment: number;
  withoutAssignment: number;
  /** Conductores con licencia vencida */
  licenseExpired: number;
  /** Conductores con licencia que vence en los próximos 30 días */
  licenseExpiringSoon: number;
}

const MS_30D = 30 * 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
//  Counts · KPI strip
// ═══════════════════════════════════════════════════════════════

export async function getAdminDriverCounts(): Promise<AdminDriverCounts> {
  const now = new Date();
  const soon = new Date(now.getTime() + MS_30D);

  const [total, withAssignment, licenseExpired, licenseExpiringSoon] =
    await Promise.all([
      db.person.count(),
      db.person.count({ where: { drivenAssets: { some: {} } } }),
      db.person.count({
        where: { licenseExpiresAt: { lt: now } },
      }),
      db.person.count({
        where: {
          licenseExpiresAt: { gte: now, lte: soon },
        },
      }),
    ]);

  return {
    total,
    withAssignment,
    withoutAssignment: total - withAssignment,
    licenseExpired,
    licenseExpiringSoon,
  };
}

// ═══════════════════════════════════════════════════════════════
//  List · paginated
// ═══════════════════════════════════════════════════════════════

export interface ListDriversForAdminParams {
  search: string | null;
  accountId: string | null;
  /** "with" · solo con asset asignado · "without" · solo sin asset */
  assignmentFilter: "with" | "without" | null;
  /** "ok" · "expiring_soon" · "expired" · "unknown" */
  licenseFilter: "ok" | "expiring_soon" | "expired" | "unknown" | null;
  page: number;
  pageSize: number;
}

export async function listDriversForAdmin(
  params: ListDriversForAdminParams,
): Promise<AdminDriverListResult> {
  const {
    search,
    accountId,
    assignmentFilter,
    licenseFilter,
    page,
    pageSize,
  } = params;

  const now = new Date();
  const soon = new Date(now.getTime() + MS_30D);

  const where: Prisma.PersonWhereInput = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { document: { contains: search } },
    ];
  }
  if (accountId) where.accountId = accountId;

  if (assignmentFilter === "with") {
    where.drivenAssets = { some: {} };
  } else if (assignmentFilter === "without") {
    where.drivenAssets = { none: {} };
  }

  if (licenseFilter === "expired") {
    where.licenseExpiresAt = { lt: now };
  } else if (licenseFilter === "expiring_soon") {
    where.licenseExpiresAt = { gte: now, lte: soon };
  } else if (licenseFilter === "ok") {
    where.licenseExpiresAt = { gt: soon };
  } else if (licenseFilter === "unknown") {
    where.licenseExpiresAt = null;
  }

  const [total, persons] = await Promise.all([
    db.person.count({ where }),
    db.person.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        document: true,
        licenseExpiresAt: true,
        hiredAt: true,
        safetyScore: true,
        account: { select: { id: true, name: true } },
        drivenAssets: {
          select: { id: true, name: true, plate: true },
          orderBy: { name: "asc" },
        },
      },
    }),
  ]);

  // Eventos 30d en una query agrupada
  const since = new Date(Date.now() - MS_30D);
  const personIds = persons.map((p) => p.id);
  const eventCounts =
    personIds.length > 0
      ? await db.event.groupBy({
          by: ["personId"],
          where: {
            personId: { in: personIds },
            occurredAt: { gte: since },
          },
          _count: { _all: true },
        })
      : [];
  const countByPerson = new Map<string, number>();
  for (const r of eventCounts) {
    if (r.personId) countByPerson.set(r.personId, r._count._all);
  }

  const rows: AdminDriverRow[] = persons.map((p) => {
    const firstAsset = p.drivenAssets[0] ?? null;
    let licenseStatus: AdminDriverRow["licenseStatus"] = "unknown";
    if (p.licenseExpiresAt) {
      if (p.licenseExpiresAt < now) licenseStatus = "expired";
      else if (p.licenseExpiresAt <= soon) licenseStatus = "expiring_soon";
      else licenseStatus = "ok";
    }
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      document: p.document,
      licenseExpiresAt: p.licenseExpiresAt,
      hiredAt: p.hiredAt,
      safetyScore: p.safetyScore,
      account: p.account,
      currentAsset: firstAsset
        ? {
            id: firstAsset.id,
            name: firstAsset.name,
            plate: firstAsset.plate,
          }
        : null,
      assetsAssignedCount: p.drivenAssets.length,
      events30d: countByPerson.get(p.id) ?? 0,
      licenseStatus,
    };
  });

  return { rows, total };
}

// ═══════════════════════════════════════════════════════════════
//  Detail · para el drawer técnico (todos los assets, no solo el primero)
// ═══════════════════════════════════════════════════════════════

export interface AdminDriverDetail {
  id: string;
  firstName: string;
  lastName: string;
  document: string | null;
  licenseExpiresAt: Date | null;
  hiredAt: Date | null;
  safetyScore: number;
  account: { id: string; name: string; slug: string };
  /** Todos los assets que tiene asignados como currentDriver */
  drivenAssets: {
    id: string;
    name: string;
    plate: string | null;
    vehicleType: string;
  }[];
  /** Stats agregados */
  stats: {
    events30d: number;
    trips30d: number;
    /** Total km manejados en los últimos 30 días */
    distance30dKm: number;
  };
}

export async function getDriverDetailForAdmin(
  driverId: string,
): Promise<AdminDriverDetail | null> {
  const p = await db.person.findUnique({
    where: { id: driverId },
    include: {
      account: { select: { id: true, name: true, slug: true } },
      drivenAssets: {
        select: {
          id: true,
          name: true,
          plate: true,
          vehicleType: true,
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!p) return null;

  const since = new Date(Date.now() - MS_30D);
  const [events30d, trips30d, distAgg] = await Promise.all([
    db.event.count({
      where: { personId: driverId, occurredAt: { gte: since } },
    }),
    db.trip.count({
      where: { personId: driverId, startedAt: { gte: since } },
    }),
    db.trip.aggregate({
      where: { personId: driverId, startedAt: { gte: since } },
      _sum: { distanceKm: true },
    }),
  ]);

  const distance30dKm = Math.round(distAgg._sum.distanceKm ?? 0);

  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    document: p.document,
    licenseExpiresAt: p.licenseExpiresAt,
    hiredAt: p.hiredAt,
    safetyScore: p.safetyScore,
    account: p.account,
    drivenAssets: p.drivenAssets.map((a) => ({
      id: a.id,
      name: a.name,
      plate: a.plate,
      vehicleType: a.vehicleType,
    })),
    stats: { events30d, trips30d, distance30dKm },
  };
}
