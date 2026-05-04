// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
// ═══════════════════════════════════════════════════════════════
//  Alarm queries
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type {
  AlarmDomain,
  AlarmStatus,
  AlarmType,
  AlarmWithRefs,
  Severity,
} from "@/types/domain";
import type { Prisma } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════
//  By asset (Dashboard D + Libro B) — preserved from Lote 1
// ═══════════════════════════════════════════════════════════════

export async function getAlarmsByAsset(
  assetId: string,
  options: {
    limit?: number;
    status?: AlarmStatus;
    domain?: AlarmDomain;
  } = {},
): Promise<AlarmWithRefs[]> {
  const { limit = 50, status, domain } = options;
  return db.alarm.findMany({
    where: {
      assetId,
      ...(status && { status }),
      ...(domain && { domain }),
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
//  By person (S3-L1 · Libro del conductor · vista Resumen)
// ═══════════════════════════════════════════════════════════════

export async function getAlarmsByPerson(
  personId: string,
  options: {
    limit?: number;
    status?: AlarmStatus;
    domain?: AlarmDomain;
  } = {},
): Promise<AlarmWithRefs[]> {
  const { limit = 50, status, domain } = options;
  return db.alarm.findMany({
    where: {
      personId,
      ...(status && { status }),
      ...(domain && { domain }),
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
//  Status counts (used by Dashboard D + Alarmas inbox KPI strip)
//
//  Defaults to SEGURIDAD domain since the Seguridad module is the
//  only consumer in Lote 3. Pass domain explicitly when called
//  from the future Conducción module.
// ═══════════════════════════════════════════════════════════════

export async function getAlarmCountsByStatus(
  filters: {
    accountId?: string | null;
    domain?: AlarmDomain;
  } = {},
): Promise<Record<AlarmStatus, number>> {
  const { accountId, domain = "SEGURIDAD" } = filters;
  const groups = await db.alarm.groupBy({
    by: ["status"],
    where: {
      domain,
      ...(accountId && { accountId }),
    },
    _count: { _all: true },
  });
  const result: Record<AlarmStatus, number> = {
    OPEN: 0,
    ATTENDED: 0,
    CLOSED: 0,
    DISMISSED: 0,
  };
  for (const g of groups) {
    result[g.status] = g._count._all;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  Alarms inbox · paginated, filterable list (Sub-lote 3.1)
//
//  Defaults to SEGURIDAD domain. The /seguridad/alarmas route
//  doesn't expose this filter; it always queries SEGURIDAD. The
//  future /conduccion/alarmas route will pass domain="CONDUCCION".
// ═══════════════════════════════════════════════════════════════

export interface AlarmListParams {
  search?: string | null;
  status?: AlarmStatus | null;
  severity?: Severity | null;
  type?: AlarmType | null;
  accountId?: string | null;
  domain?: AlarmDomain;
  page?: number;
  pageSize?: number;
  sortBy?: "triggeredAt" | "severity";
  sortDir?: "asc" | "desc";
}

export interface AlarmListResult {
  rows: AlarmWithRefs[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listAlarms(
  params: AlarmListParams = {},
): Promise<AlarmListResult> {
  const {
    search,
    status,
    severity,
    type,
    accountId,
    domain = "SEGURIDAD",
    page = 1,
    pageSize = 25,
    sortBy = "triggeredAt",
    sortDir = "desc",
  } = params;

  const where: Prisma.AlarmWhereInput = {
    domain,
    ...(status ? { status } : {}),
    ...(severity ? { severity } : {}),
    ...(type ? { type } : {}),
    ...(accountId ? { accountId } : {}),
    ...(search
      ? {
          asset: {
            OR: [
              { name: { contains: search } },
              { plate: { contains: search } },
            ],
          },
        }
      : {}),
  };

  const orderBy: Prisma.AlarmOrderByWithRelationInput =
    sortBy === "severity"
      ? { severity: sortDir }
      : { triggeredAt: sortDir };

  const [total, items] = await Promise.all([
    db.alarm.count({ where }),
    db.alarm.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        asset: { select: { id: true, name: true, plate: true } },
        person: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  return {
    rows: items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
