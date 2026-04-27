// ═══════════════════════════════════════════════════════════════
//  Driver-asset history query
//  ─────────────────────────────────────────────────────────────
//  For a given asset, returns the list of drivers who "passed
//  through" that vehicle in the recent past, with usage stats
//  per driver (km, time, days, trips) and a 84-day daily
//  trip-count heatmap suitable for a GitHub-style mini calendar.
//
//  Data model reality (see prisma/schema.prisma):
//    · Asset.currentDriverId  · CURRENT assignment only (1:1)
//    · Event.personId         · who was driving when the event
//                               happened (nullable)
//    · Alarm.personId         · same idea for alarms
//    · Position has NO personId  · raw GPS, no driver attribution
//    · Trip is derived on-the-fly  · no per-trip driver field
//
//  Therefore "drivers who passed through" is reconstructed from:
//
//    1.  union of Event.personId and Alarm.personId for this asset
//    2.  + asset.currentDriverId (always include the current one)
//
//  Per-trip attribution uses event-overlap heuristic:
//    · for each trip in the window
//    · find events of this asset with personId IS NOT NULL whose
//      occurredAt falls inside [trip.startedAt, trip.endedAt]
//    · the most frequent personId wins · ties resolved
//      arbitrarily; when no events have a personId we fall back
//      to asset.currentDriverId (best guess, current driver
//      probably did the trip)
//
//  The heuristic is good enough for the demo and for a real
//  fleet whose drivers rarely swap mid-trip. Once a per-trip
//  driver field is added to the schema (lote futuro), this query
//  becomes a trivial groupBy.
//
//  Window: last 84 days · 12 columns × 7 days for the heatmap.
//  "Today" is pinned to the demo anchor (see url-trips.ts) so
//  the heatmap doesn't run off the seeded data.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { listTrips, type TripRow } from "./trips";

// ─── Constants ─────────────────────────────────────────────────
const MS_DAY = 24 * 60 * 60 * 1000;
const HEATMAP_DAYS = 84; // 12 weeks
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Demo anchor · matches url-trips.ts so the heatmap aligns with
 * the rest of the app's "today". In real production this would
 * be `new Date()`.
 */
function demoToday(): Date {
  return new Date("2026-04-26T12:00:00.000Z");
}

/** Convert a Date timestamp to AR-local YYYY-MM-DD (no UTC drift). */
function ymdAr(ts: number): string {
  const local = new Date(ts - AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface DriverAssetHistoryHeatmapCell {
  /** YYYY-MM-DD in AR local time */
  date: string;
  /** Number of trips on this date attributed to this driver */
  trips: number;
}

export interface DriverAssetHistoryRow {
  driverId: string;
  firstName: string;
  lastName: string;
  /** Optional safety score for the chip in the card */
  safetyScore: number;
  /** Whether this driver is the asset's currentDriver */
  isCurrent: boolean;
  /** Trips attributed to this driver in the window */
  totalTrips: number;
  /** Sum of km across attributed trips */
  totalKm: number;
  /** Sum of trip duration (motor running) in ms */
  totalDurationMs: number;
  /** Distinct days (in AR local) with at least one attributed trip */
  totalDays: number;
  /** First attributed trip start in the window · null if zero trips */
  firstActivityAt: Date | null;
  /** Last attributed trip start in the window · null if zero trips */
  lastActivityAt: Date | null;
  /** 84-cell daily heatmap, oldest first, latest = today */
  heatmap: DriverAssetHistoryHeatmapCell[];
}

// ═══════════════════════════════════════════════════════════════
//  Query
// ═══════════════════════════════════════════════════════════════

/**
 * Returns drivers who have history on this asset in the last
 * 84 days, ordered by total trips DESC then last activity DESC.
 *
 * The currently assigned driver (if any) is always included,
 * even if they have zero attributed trips.
 */
export async function getDriverAssetHistory(
  assetId: string,
): Promise<DriverAssetHistoryRow[]> {
  // ── Window setup ──────────────────────────────────────
  const today = demoToday();
  const start = new Date(today.getTime() - (HEATMAP_DAYS - 1) * MS_DAY);

  // YYYY-MM-DD bounds for listTrips (which expects AR-local YMDs)
  const fromYmd = ymdAr(start.getTime());
  const toYmd = ymdAr(today.getTime());

  // ── Asset · current driver lookup ─────────────────────
  const asset: any = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      currentDriverId: true,
      currentDriver: {
        select: { id: true, firstName: true, lastName: true, safetyScore: true },
      },
    },
  });

  if (!asset) return [];

  const currentDriverId: string | null = asset.currentDriverId ?? null;

  // ── Trips in the window ────────────────────────────────
  const trips: TripRow[] = await listTrips({
    fromDate: fromYmd,
    toDate: toYmd,
    assetIds: [assetId],
  });

  // ── Events in the window with a personId ──────────────
  const eventsRaw: any[] = await db.event.findMany({
    where: {
      assetId,
      personId: { not: null },
      occurredAt: { gte: start, lte: today },
    },
    select: { personId: true, occurredAt: true },
    orderBy: { occurredAt: "asc" },
  });

  // ── Distinct driver IDs we must surface ────────────────
  const driverIds = new Set<string>();
  if (currentDriverId) driverIds.add(currentDriverId);
  for (const e of eventsRaw) {
    if (e.personId) driverIds.add(e.personId);
  }

  // We also union alarm-attributed drivers · these are the
  // people who got a SEGURIDAD alarm while driving this vehicle.
  // We don't use them for trip attribution (alarms are sparser
  // than events) but they should still appear in the panel.
  const alarmsRaw: any[] = await db.alarm.findMany({
    where: {
      assetId,
      personId: { not: null },
      triggeredAt: { gte: start, lte: today },
    },
    select: { personId: true },
  });
  for (const a of alarmsRaw) {
    if (a.personId) driverIds.add(a.personId);
  }

  if (driverIds.size === 0) return [];

  // ── Fetch driver basic data for the union ─────────────
  const driversRaw: any[] = await db.person.findMany({
    where: { id: { in: Array.from(driverIds) } },
    select: { id: true, firstName: true, lastName: true, safetyScore: true },
  });
  const driverById = new Map<string, any>(driversRaw.map((d) => [d.id, d]));

  // ── Per-trip driver attribution ────────────────────────
  // For each trip:
  //   1. find events whose occurredAt is in [startedAt, endedAt]
  //   2. tally personId
  //   3. winner = most frequent · tie → currentDriver if it's
  //      among the tie set, else the smallest id (stable)
  //   4. fallback when no events match → currentDriverId
  //
  // We pre-sort events by occurredAt and use a two-pointer
  // sweep against trips sorted by startedAt for O(N+M) instead
  // of O(N×M).

  // listTrips returns DESC by start time — re-sort ASC for sweep
  const tripsAsc = [...trips].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  const eventsAsc = eventsRaw; // already ASC from DB

  /**
   * Map: tripId → assigned driverId (or null if unattributable).
   */
  const tripDriverByTripId = new Map<string, string | null>();

  let evtCursor = 0;
  for (const t of tripsAsc) {
    // Skip events that ended before this trip started
    while (
      evtCursor < eventsAsc.length &&
      eventsAsc[evtCursor].occurredAt.getTime() < t.startedAt.getTime()
    ) {
      evtCursor++;
    }
    // Tally events inside [t.startedAt, t.endedAt]
    const tally = new Map<string, number>();
    let probe = evtCursor;
    while (
      probe < eventsAsc.length &&
      eventsAsc[probe].occurredAt.getTime() <= t.endedAt.getTime()
    ) {
      const pid: string | null = eventsAsc[probe].personId ?? null;
      if (pid) {
        tally.set(pid, (tally.get(pid) ?? 0) + 1);
      }
      probe++;
    }

    let winner: string | null = null;
    if (tally.size > 0) {
      // Pick max · prefer currentDriverId on ties
      let best = -1;
      for (const [pid, n] of tally) {
        if (
          n > best ||
          (n === best && pid === currentDriverId) ||
          (n === best && winner !== currentDriverId && pid < (winner ?? "\uffff"))
        ) {
          best = n;
          winner = pid;
        }
      }
    } else {
      // No events with personId during the trip · fall back to
      // current driver (probably correct in single-driver fleets)
      winner = currentDriverId;
    }

    tripDriverByTripId.set(t.id, winner);
  }

  // ── Aggregate per driver ───────────────────────────────
  interface Agg {
    trips: number;
    km: number;
    durationMs: number;
    daySet: Set<string>;
    firstAt: Date | null;
    lastAt: Date | null;
    heatmap: Map<string, number>; // ymd → trip count
  }

  const aggByDriver = new Map<string, Agg>();
  function getOrInit(driverId: string): Agg {
    let a = aggByDriver.get(driverId);
    if (!a) {
      a = {
        trips: 0,
        km: 0,
        durationMs: 0,
        daySet: new Set<string>(),
        firstAt: null,
        lastAt: null,
        heatmap: new Map(),
      };
      aggByDriver.set(driverId, a);
    }
    return a;
  }

  for (const t of tripsAsc) {
    const driverId = tripDriverByTripId.get(t.id);
    if (!driverId) continue; // unattributable (very rare in demo)
    const a = getOrInit(driverId);
    a.trips++;
    a.km += t.distanceKm;
    a.durationMs += t.durationMs;
    const ymd = ymdAr(t.startedAt.getTime());
    a.daySet.add(ymd);
    a.heatmap.set(ymd, (a.heatmap.get(ymd) ?? 0) + 1);
    if (a.firstAt === null || t.startedAt < a.firstAt) a.firstAt = t.startedAt;
    if (a.lastAt === null || t.startedAt > a.lastAt) a.lastAt = t.startedAt;
  }

  // Make sure every driver in driverIds has an Agg, even those
  // with zero trips (e.g. only alarms or only the current
  // assignment with no recent activity).
  for (const id of driverIds) {
    getOrInit(id);
  }

  // ── Build heatmap (84 cells, oldest first) ─────────────
  // Use the same anchor for everyone so all driver cards line up
  // visually in the panel.
  const heatmapDates: string[] = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    heatmapDates.push(ymdAr(today.getTime() - i * MS_DAY));
  }

  // ── Materialize rows ───────────────────────────────────
  const rows: DriverAssetHistoryRow[] = [];
  for (const [driverId, a] of aggByDriver) {
    const driver = driverById.get(driverId);
    if (!driver) continue;
    const heatmap: DriverAssetHistoryHeatmapCell[] = heatmapDates.map((d) => ({
      date: d,
      trips: a.heatmap.get(d) ?? 0,
    }));
    rows.push({
      driverId,
      firstName: driver.firstName,
      lastName: driver.lastName,
      safetyScore: driver.safetyScore ?? 0,
      isCurrent: driverId === currentDriverId,
      totalTrips: a.trips,
      totalKm: a.km,
      totalDurationMs: a.durationMs,
      totalDays: a.daySet.size,
      firstActivityAt: a.firstAt,
      lastActivityAt: a.lastAt,
      heatmap,
    });
  }

  // ── Sort: trips DESC · then lastActivity DESC · current first ──
  rows.sort((x, y) => {
    // Current driver always on top
    if (x.isCurrent !== y.isCurrent) return x.isCurrent ? -1 : 1;
    if (x.totalTrips !== y.totalTrips) return y.totalTrips - x.totalTrips;
    const xt = x.lastActivityAt?.getTime() ?? 0;
    const yt = y.lastActivityAt?.getTime() ?? 0;
    return yt - xt;
  });

  return rows;
}
