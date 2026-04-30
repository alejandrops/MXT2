// ═══════════════════════════════════════════════════════════════
//  Person queries (Sub-lote 3.3 · Libro del Conductor)
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type {
  AlarmDomain,
  AlarmStatus,
  AlarmType,
  AlarmWithRefs,
  EventType,
  PersonDetail,
  Severity,
} from "@/types/domain";
import type { EventWithPerson } from "./events";
import type { Prisma } from "@prisma/client";

const MS_DAY = 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
//  Detail (Libro del Conductor)
// ═══════════════════════════════════════════════════════════════

/**
 * Full detail of a Person, with currently-driven assets, 30-day
 * aggregates, and a daily event histogram for the SVG sparkline.
 *
 * Returns null if the id doesn't match any person.
 */
export async function getPersonDetail(
  id: string,
): Promise<PersonDetail | null> {
  const since = new Date(Date.now() - 30 * MS_DAY);

  const person = await db.person.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true } },
      drivenAssets: {
        select: {
          id: true,
          name: true,
          plate: true,
          make: true,
          model: true,
          status: true,
        },
      },
    },
  });

  if (!person) return null;

  const [eventCount30d, alarmCount30d, openAlarms, lastEvent, dailyEvents] =
    await Promise.all([
      db.event.count({
        where: { personId: id, occurredAt: { gte: since } },
      }),
      db.alarm.count({
        where: {
          personId: id,
          domain: "SEGURIDAD",
          triggeredAt: { gte: since },
        },
      }),
      db.alarm.count({
        where: { personId: id, domain: "SEGURIDAD", status: "OPEN" },
      }),
      db.event.findFirst({
        where: { personId: id },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
      db.event.findMany({
        where: { personId: id, occurredAt: { gte: since } },
        select: { occurredAt: true },
        orderBy: { occurredAt: "asc" },
      }),
    ]);

  // ── Build daily histogram (30 buckets, 1 per day) ──────────
  // The bucket date is YYYY-MM-DD in UTC (timezone-agnostic for
  // a sparkline; refine in Lote 4 if accountTimezone matters).
  const histogram = buildDailyHistogram(dailyEvents.map((e) => e.occurredAt));

  return {
    ...person,
    stats: {
      eventCount30d,
      alarmCount30d,
      openAlarms,
      lastEventAt: lastEvent?.occurredAt ?? null,
    },
    eventHistogram: histogram,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Eventos tab · paginated by person (Sub-lote 3.3)
// ═══════════════════════════════════════════════════════════════

export interface PersonEventListParams {
  personId: string;
  type?: EventType | null;
  severity?: Severity | null;
  page?: number;
  pageSize?: number;
}

export interface PersonEventListResult {
  rows: EventWithPerson[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listEventsByPerson(
  params: PersonEventListParams,
): Promise<PersonEventListResult> {
  const { personId, type, severity, page = 1, pageSize = 25 } = params;

  const where: Prisma.EventWhereInput = {
    personId,
    ...(type ? { type } : {}),
    ...(severity ? { severity } : {}),
  };

  const [total, items] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
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

// ═══════════════════════════════════════════════════════════════
//  Alarmas tab · paginated by person (Sub-lote 3.3)
// ═══════════════════════════════════════════════════════════════

export interface PersonAlarmListParams {
  personId: string;
  status?: AlarmStatus | null;
  severity?: Severity | null;
  type?: AlarmType | null;
  domain?: AlarmDomain;
  page?: number;
  pageSize?: number;
}

export interface PersonAlarmListResult {
  rows: AlarmWithRefs[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listAlarmsByPerson(
  params: PersonAlarmListParams,
): Promise<PersonAlarmListResult> {
  const {
    personId,
    status,
    severity,
    type,
    domain = "SEGURIDAD",
    page = 1,
    pageSize = 25,
  } = params;

  const where: Prisma.AlarmWhereInput = {
    personId,
    domain,
    ...(status ? { status } : {}),
    ...(severity ? { severity } : {}),
    ...(type ? { type } : {}),
  };

  const [total, items] = await Promise.all([
    db.alarm.count({ where }),
    db.alarm.findMany({
      where,
      orderBy: { triggeredAt: "desc" },
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

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Build a 30-day histogram from a list of event timestamps.
 * Returns an array of 30 entries (oldest first), with each
 * entry being { date: "YYYY-MM-DD", count: number }.
 */
function buildDailyHistogram(
  timestamps: Date[],
): { date: string; count: number }[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const buckets: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(today.getTime() - i * MS_DAY);
    buckets.push({ date: day.toISOString().slice(0, 10), count: 0 });
  }

  const indexByDate = new Map(buckets.map((b, i) => [b.date, i]));

  for (const ts of timestamps) {
    const key = ts.toISOString().slice(0, 10);
    const idx = indexByDate.get(key);
    if (idx !== undefined) buckets[idx]!.count++;
  }

  return buckets;
}

// ═══════════════════════════════════════════════════════════════
//  Lista de Conductores · /gestion/conductores
//  ─────────────────────────────────────────────────────────────
//  Paginated, filterable list with the same shape as listAssets:
//    · server-side filters (search, account, status)
//    · sort by name / safetyScore / lastActivity
//    · returns rows + paging metadata
// ═══════════════════════════════════════════════════════════════

export interface DriverListRow {
  id: string;
  firstName: string;
  lastName: string;
  /** Document number, or "—" if not set in seed */
  document: string;
  safetyScore: number;
  /** Driver license expiration · null if not seeded */
  licenseExpiresAt: Date | null;
  hiredAt: Date | null;
  accountId: string;
  accountName: string;
  /** Currently assigned asset (driver may be driving one right now) */
  currentAsset: {
    id: string;
    name: string;
    plate: string | null;
  } | null;
  /** Aggregates over the last 30 days */
  events30d: number;
  /** Driver license expiring soon (< 30 days) flag */
  licenseExpiringSoon: boolean;
}

export interface DriverListParams {
  search?: string | null;
  accountId?: string | null;
  /**
   * "active"   · driver currently assigned to an asset
   * "inactive" · driver with no assigned asset
   * null       · everyone
   */
  status?: "active" | "inactive" | null;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "safetyScore" | "events30d";
  sortDir?: "asc" | "desc";
}

export interface DriverListResult {
  rows: DriverListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const MS_30D = 30 * 24 * 60 * 60 * 1000;

export async function listDrivers(
  params: DriverListParams = {},
): Promise<DriverListResult> {
  const {
    search,
    accountId,
    status,
    page = 1,
    pageSize = 25,
    sortBy = "name",
    sortDir = "asc",
  } = params;

  // ── Build where clause ─────────────────────────────────
  const where: any = {
    ...(accountId ? { accountId } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { document: { contains: search } },
          ],
        }
      : {}),
  };

  // status filter operates on the drivenAssets relation
  // (Person 1—N Asset · "currentDriver" relation)
  if (status === "active") {
    where.drivenAssets = { some: {} };
  } else if (status === "inactive") {
    where.drivenAssets = { none: {} };
  }

  // ── Sort ───────────────────────────────────────────────
  // events30d sort can't be done in SQL trivially without a
  // join + group; we sort in JS after fetching the page (the
  // page is bounded so it's cheap).
  const orderBy: any =
    sortBy === "name"
      ? [{ firstName: sortDir }, { lastName: sortDir }]
      : sortBy === "safetyScore"
        ? { safetyScore: sortDir }
        : { firstName: sortDir }; // fallback, sorted by events later

  // ── Count + fetch ──────────────────────────────────────
  const [total, persons] = await Promise.all([
    db.person.count({ where }),
    db.person.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        document: true,
        safetyScore: true,
        licenseExpiresAt: true,
        hiredAt: true,
        accountId: true,
        account: { select: { name: true } },
        // Person · 1—N Asset (relation "CurrentDriver")
        // Take the first one (a driver typically drives at most
        // one vehicle at a time in this demo's data).
        drivenAssets: {
          select: { id: true, name: true, plate: true },
          take: 1,
          orderBy: { name: "asc" },
        },
      },
    }),
  ]);

  // ── 30-day events count per person (one query) ────────
  const since = new Date(Date.now() - MS_30D);
  const ids = persons.map((p: any) => p.id);
  const eventCounts =
    ids.length > 0
      ? await db.event.groupBy({
          by: ["personId"],
          where: {
            personId: { in: ids },
            occurredAt: { gte: since },
          },
          _count: { _all: true },
        })
      : [];
  const countByPerson = new Map<string, number>();
  for (const r of eventCounts as any[]) {
    if (r.personId) countByPerson.set(r.personId, r._count._all);
  }

  const NOW = Date.now();
  const SOON_MS = 30 * 24 * 60 * 60 * 1000;
  let rows: DriverListRow[] = persons.map((p: any) => {
    const firstAsset = p.drivenAssets?.[0] ?? null;
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      document: p.document ?? "—",
      safetyScore: p.safetyScore,
      licenseExpiresAt: p.licenseExpiresAt ?? null,
      hiredAt: p.hiredAt ?? null,
      accountId: p.accountId,
      accountName: p.account.name,
      currentAsset: firstAsset
        ? {
            id: firstAsset.id,
            name: firstAsset.name,
            plate: firstAsset.plate,
          }
        : null,
      events30d: countByPerson.get(p.id) ?? 0,
      licenseExpiringSoon: p.licenseExpiresAt
        ? p.licenseExpiresAt.getTime() - NOW < SOON_MS &&
          p.licenseExpiresAt.getTime() > NOW
        : false,
    };
  });

  // ── Post-sort by events30d if requested ───────────────
  if (sortBy === "events30d") {
    rows = [...rows].sort((a, b) =>
      sortDir === "asc"
        ? a.events30d - b.events30d
        : b.events30d - a.events30d,
    );
  }

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ═══════════════════════════════════════════════════════════════
//  Counts for KPI strip
// ═══════════════════════════════════════════════════════════════

export interface DriverCounts {
  total: number;
  active: number;
  inactive: number;
  licenseExpiringSoon: number;
  avgSafetyScore: number;
}

export async function getDriverCounts(opts: {
  accountId?: string | null;
} = {}): Promise<DriverCounts> {
  const where: any = opts.accountId ? { accountId: opts.accountId } : {};

  const [total, active, soonCount, avgAgg] = await Promise.all([
    db.person.count({ where }),
    db.person.count({
      where: { ...where, drivenAssets: { some: {} } },
    }),
    (() => {
      const now = new Date();
      const soon = new Date(now.getTime() + 30 * MS_DAY);
      return db.person.count({
        where: {
          ...where,
          licenseExpiresAt: { gte: now, lte: soon },
        },
      });
    })(),
    db.person.aggregate({
      where,
      _avg: { safetyScore: true },
    }),
  ]);

  return {
    total,
    active,
    inactive: total - active,
    licenseExpiringSoon: soonCount,
    avgSafetyScore: Math.round((avgAgg as any)._avg.safetyScore ?? 0),
  };
}

// ═══════════════════════════════════════════════════════════════
//  Lightweight filter helper · for filter bars
// ═══════════════════════════════════════════════════════════════

export interface DriverForFilter {
  id: string;
  firstName: string;
  lastName: string;
}

export async function listDriversForFilter(
  accountId?: string | null,
): Promise<DriverForFilter[]> {
  return db.person.findMany({
    where: {
      drivenAssets: { some: {} }, // only drivers actually assigned
      ...(accountId ? { accountId } : {}),
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
