// ═══════════════════════════════════════════════════════════════
//  Asset queries (Pantallas 2+3 · Lista A + Libro B)
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type {
  AssetDetail,
  AssetListRow,
  AssetStatus,
  MobilityType,
} from "@/types/domain";
import type { Prisma } from "@prisma/client";

const MS_DAY = 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
//  Lista A · paginated, filterable list
// ═══════════════════════════════════════════════════════════════

export interface AssetListParams {
  search?: string | null;
  status?: AssetStatus | null;
  mobility?: MobilityType | null;
  accountId?: string | null;
  groupId?: string | null;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "status" | "speedKmh";
  sortDir?: "asc" | "desc";
}

export interface AssetListResult {
  rows: AssetListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listAssets(
  params: AssetListParams = {},
): Promise<AssetListResult> {
  const {
    search,
    status,
    mobility,
    accountId,
    groupId,
    page = 1,
    pageSize = 25,
    sortBy = "name",
    sortDir = "asc",
  } = params;

  const where: Prisma.AssetWhereInput = {
    ...(status ? { status } : {}),
    ...(mobility ? { mobilityType: mobility } : {}),
    ...(accountId ? { accountId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { plate: { contains: search } },
          ],
        }
      : {}),
  };

  // Sort:
  //  · "name" / "status"  · plain Asset columns
  //  · "speedKmh"         · sort on related LivePosition (E6-A).
  //                          Assets without LivePosition fall to
  //                          the bottom (asc) or top (desc) ·
  //                          documented & acceptable for the demo.
  const orderBy: Prisma.AssetOrderByWithRelationInput =
    sortBy === "name"
      ? { name: sortDir }
      : sortBy === "status"
        ? { status: sortDir }
        : {
            livePosition: {
              speedKmh: sortDir,
            },
          };

  const [total, items] = await Promise.all([
    db.asset.count({ where }),
    db.asset.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        group: { select: { id: true, name: true } },
        currentDriver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            safetyScore: true,
          },
        },
        // E6-A: Read live position from the precalculated table
        // instead of subquerying Position. No more Position access
        // from the UI for the asset list.
        livePosition: {
          select: {
            lat: true,
            lng: true,
            speedKmh: true,
            recordedAt: true,
            ignition: true,
          },
        },
      },
    }),
  ]);

  const rows: AssetListRow[] = items.map((a) => ({
    ...a,
    lastPosition: a.livePosition
      ? {
          lat: a.livePosition.lat,
          lng: a.livePosition.lng,
          speedKmh: a.livePosition.speedKmh,
          recordedAt: a.livePosition.recordedAt,
          ignition: a.livePosition.ignition,
        }
      : null,
  }));

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ═══════════════════════════════════════════════════════════════
//  Status counts (KPI strip on Lista A)
// ═══════════════════════════════════════════════════════════════

export async function getAssetStatusCounts(
  filters: { accountId?: string | null } = {},
): Promise<Record<AssetStatus, number>> {
  const groups = await db.asset.groupBy({
    by: ["status"],
    where: filters.accountId ? { accountId: filters.accountId } : undefined,
    _count: { _all: true },
  });
  const result: Record<AssetStatus, number> = {
    MOVING: 0,
    IDLE: 0,
    STOPPED: 0,
    OFFLINE: 0,
    MAINTENANCE: 0,
  };
  for (const g of groups) {
    result[g.status] = g._count._all;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  Libro B · detail by id
// ═══════════════════════════════════════════════════════════════

export async function getAssetDetail(id: string): Promise<AssetDetail | null> {
  const since = new Date(Date.now() - 30 * MS_DAY);
  const since1y = new Date(Date.now() - 365 * MS_DAY);

  const asset = await db.asset.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      currentDriver: true,
      devices: { orderBy: { isPrimary: "desc" } },
      positions: {
        orderBy: { recordedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!asset) return null;

  const [
    eventCount30d,
    alarmCount30d,
    openAlarms,
    positions30d,
    positions1y,
  ] = await Promise.all([
    db.event.count({
      where: { assetId: id, occurredAt: { gte: since } },
    }),
    db.alarm.count({
      where: { assetId: id, triggeredAt: { gte: since } },
    }),
    db.alarm.count({
      where: { assetId: id, status: "OPEN" },
    }),
    // For period KPIs (km, active time, trips)
    db.position.findMany({
      where: { assetId: id, recordedAt: { gte: since } },
      select: { recordedAt: true, lat: true, lng: true, ignition: true },
      orderBy: { recordedAt: "asc" },
    }),
    // For odometer estimate (last year of positions)
    db.position.findMany({
      where: { assetId: id, recordedAt: { gte: since1y } },
      select: { lat: true, lng: true, ignition: true, recordedAt: true },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  // ── Period KPIs from positions ───────────────────────
  const km30d = computeKm(positions30d as PositionLite[]);
  const activeMinutes30d = computeActiveMinutes(
    positions30d as PositionLite[],
  );
  const tripCount30d = computeTripCount(positions30d as PositionLite[]);
  const odometerKm = Math.round(computeKm(positions1y as PositionLite[]));

  // ── Communication state from last position ─────────
  const lastPosition = (asset as any).positions[0] ?? null;
  let commState: AssetDetail["stats"]["commState"] = "NO_COMM";
  let msSinceLastSeen = 1e10;
  if (lastPosition) {
    msSinceLastSeen = Date.now() - lastPosition.recordedAt.getTime();
    if (msSinceLastSeen < 5 * 60 * 1000) commState = "ONLINE";
    else if (msSinceLastSeen < 30 * 60 * 1000) commState = "RECENT";
    else if (msSinceLastSeen < 24 * 60 * 60 * 1000) commState = "STALE";
    else commState = "LONG";
  }

  return {
    ...asset,
    lastPosition,
    stats: {
      eventCount30d,
      alarmCount30d,
      openAlarms,
      km30d: Math.round(km30d),
      activeMinutes30d: Math.round(activeMinutes30d),
      tripCount30d,
      odometerKm,
      commState,
      msSinceLastSeen,
    },
  } as AssetDetail;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers · period KPI computation from raw positions
// ═══════════════════════════════════════════════════════════════

interface PositionLite {
  recordedAt: Date;
  lat: number;
  lng: number;
  ignition: boolean;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function computeKm(positions: PositionLite[]): number {
  let km = 0;
  for (let i = 1; i < positions.length; i++) {
    const a = positions[i - 1]!;
    const b = positions[i]!;
    if (a.ignition) {
      km += haversineKm(a.lat, a.lng, b.lat, b.lng);
    }
  }
  return km;
}

function computeActiveMinutes(positions: PositionLite[]): number {
  let activeMs = 0;
  for (let i = 1; i < positions.length; i++) {
    const a = positions[i - 1]!;
    const b = positions[i]!;
    if (a.ignition) {
      const dt = b.recordedAt.getTime() - a.recordedAt.getTime();
      // Cap segments at 5 minutes to avoid overcounting gaps
      activeMs += Math.min(dt, 5 * 60 * 1000);
    }
  }
  return activeMs / 60_000;
}

/**
 * Count "trips" as distinct ignition-on intervals separated by
 * at least 15 minutes of motor-off.
 */
function computeTripCount(positions: PositionLite[]): number {
  if (positions.length === 0) return 0;
  const TRIP_GAP_MS = 15 * 60 * 1000;
  let trips = 0;
  let inTrip = false;
  let lastIgnOnAt = 0;
  for (const p of positions) {
    if (p.ignition) {
      if (!inTrip) {
        // Start a new trip if it's been long enough since last ign-on
        const gap = p.recordedAt.getTime() - lastIgnOnAt;
        if (lastIgnOnAt === 0 || gap > TRIP_GAP_MS) {
          trips++;
        }
        inTrip = true;
      }
      lastIgnOnAt = p.recordedAt.getTime();
    } else {
      inTrip = false;
    }
  }
  return trips;
}

// ═══════════════════════════════════════════════════════════════
//  Filter helpers (dropdown options)
// ═══════════════════════════════════════════════════════════════

export async function getAccountsForFilter(
  /**
   * Scope opcional · si se provee un accountId, devuelve solo esa
   * account (caso CA y OP, que solo ven su propia). Sin scope,
   * devuelve todas (caso SA y MA cross-account).
   *
   * La página llamadora debería computarlo así:
   *
   *     const scopedAccountId = resolveAccountScope(session, mod, null);
   *     const accounts = await getAccountsForFilter(scopedAccountId);
   *
   * Para SA y MA, scopedAccountId será null → devuelve todas.
   * Para CA y OP, scopedAccountId será su accountId → devuelve [esa].
   */
  accountId?: string | null,
): Promise<{ id: string; name: string }[]> {
  return db.account.findMany({
    where: accountId ? { id: accountId } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getGroupsForFilter(
  accountId?: string | null,
): Promise<{ id: string; name: string; accountId: string }[]> {
  return db.group.findMany({
    where: accountId ? { accountId } : undefined,
    select: { id: true, name: true, accountId: true },
    orderBy: { name: "asc" },
  });
}
