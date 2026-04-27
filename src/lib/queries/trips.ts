// ═══════════════════════════════════════════════════════════════
//  Trips queries · /seguimiento/viajes
//  ─────────────────────────────────────────────────────────────
//  A Trip is a continuous segment of a vehicle's movement,
//  bounded by ignition transitions. The detection logic:
//
//    · Iterate positions in chronological order
//    · Start a trip when ignition turns ON
//    · End it when ignition turns OFF (or when a long gap > 15 min
//      occurs even with ignition still ON · device dropout)
//    · Discard trips < 5 min OR < 0.5 km (these are warmups,
//      brief idles, or noise)
//
//  This layer exposes:
//    · listTrips()        · paginated cross-fleet trip list
//    · getTripKpis()      · aggregates over a date range
//    · getTripRoutes()    · simplified polylines for map overlay
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

// Argentina is UTC-3
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

// ─── Trip detection thresholds ─────────────────────────────────
const MIN_TRIP_DURATION_MS = 5 * 60 * 1000; // 5 min
const MIN_TRIP_DISTANCE_KM = 0.5;
const MAX_GAP_TO_SPLIT_MS = 15 * 60 * 1000; // 15 min · device dropout

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface TripRow {
  id: string; // synthetic · `${assetId}:${startedAt.getTime()}`
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  assetMake: string | null;
  assetModel: string | null;
  driverName: string | null;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  idleMs: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  eventCount: number;
  highSeverityEventCount: number;
  positionCount: number;
}

export interface TripKpis {
  totalTrips: number;
  totalDistanceKm: number;
  totalDurationMs: number;
  totalIdleMs: number;
  avgSpeedKmh: number;
  totalEvents: number;
  totalHighSeverityEvents: number;
  vehiclesActive: number;
}

export interface TripFilters {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  /** Direct asset filter · empty/undef = all */
  assetIds?: string[];
  /** Asset must belong to one of these groups */
  groupIds?: string[];
  /** Asset's currentDriver must be one of these persons */
  personIds?: string[];
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function dateRangeToUtc(fromYmd: string, toYmd: string): {
  startUtc: Date;
  endUtc: Date;
} {
  // fromYmd 00:00:00 local · toYmd 23:59:59 local
  const startLocal = new Date(`${fromYmd}T00:00:00.000Z`);
  const endLocal = new Date(`${toYmd}T23:59:59.999Z`);
  return {
    startUtc: new Date(startLocal.getTime() + TZ_OFFSET_MS),
    endUtc: new Date(endLocal.getTime() + TZ_OFFSET_MS),
  };
}

/** Haversine distance in km between two lat/lng points. */
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

interface RawPosition {
  recordedAt: Date;
  lat: number;
  lng: number;
  speedKmh: number;
  ignition: boolean;
}

/**
 * Pure function · turn an ordered stream of positions into trips.
 * Exported so the same logic can be reused by other consumers
 * (e.g. the route-overlay query).
 */
export function detectTripsFromPositions(
  positions: RawPosition[],
): {
  startIdx: number;
  endIdx: number;
  startedAt: Date;
  endedAt: Date;
  distanceKm: number;
  maxSpeedKmh: number;
  idleMs: number;
}[] {
  const trips: ReturnType<typeof detectTripsFromPositions> = [];
  if (positions.length < 2) return trips;

  let inTrip = false;
  let tripStart = 0;
  let tripDistance = 0;
  let tripMaxSpeed = 0;
  let tripIdle = 0;

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!;
    const prev = i > 0 ? positions[i - 1]! : null;

    // Detect trip start: ignition turned on (or first ignition-on
    // sample after we were not in a trip)
    if (!inTrip && p.ignition) {
      inTrip = true;
      tripStart = i;
      tripDistance = 0;
      tripMaxSpeed = 0;
      tripIdle = 0;
      continue;
    }

    if (!inTrip) continue;

    // Update trip metrics
    if (prev) {
      const seg = haversineKm(prev.lat, prev.lng, p.lat, p.lng);
      tripDistance += seg;
      const dt = p.recordedAt.getTime() - prev.recordedAt.getTime();
      // Idle: still ignited but speed < 3 km/h for that segment
      if (p.speedKmh < 3 && prev.speedKmh < 3) {
        tripIdle += dt;
      }
      // Detect long gap → close current trip and reopen on next
      // ignition-on
      if (dt > MAX_GAP_TO_SPLIT_MS) {
        const startP = positions[tripStart]!;
        const endP = prev;
        emitTripIfValid(
          trips,
          tripStart,
          i - 1,
          startP.recordedAt,
          endP.recordedAt,
          tripDistance,
          tripMaxSpeed,
          tripIdle,
        );
        inTrip = false;
        continue;
      }
    }
    if (p.speedKmh > tripMaxSpeed) tripMaxSpeed = p.speedKmh;

    // Detect trip end: ignition turned OFF
    if (!p.ignition) {
      const startP = positions[tripStart]!;
      const endP = p;
      emitTripIfValid(
        trips,
        tripStart,
        i,
        startP.recordedAt,
        endP.recordedAt,
        tripDistance,
        tripMaxSpeed,
        tripIdle,
      );
      inTrip = false;
    }
  }

  // Trip still open at the end of the data
  if (inTrip) {
    const startP = positions[tripStart]!;
    const lastIdx = positions.length - 1;
    const endP = positions[lastIdx]!;
    emitTripIfValid(
      trips,
      tripStart,
      lastIdx,
      startP.recordedAt,
      endP.recordedAt,
      tripDistance,
      tripMaxSpeed,
      tripIdle,
    );
  }

  return trips;
}

function emitTripIfValid(
  trips: ReturnType<typeof detectTripsFromPositions>,
  startIdx: number,
  endIdx: number,
  startedAt: Date,
  endedAt: Date,
  distanceKm: number,
  maxSpeedKmh: number,
  idleMs: number,
) {
  const durationMs = endedAt.getTime() - startedAt.getTime();
  if (durationMs < MIN_TRIP_DURATION_MS) return;
  if (distanceKm < MIN_TRIP_DISTANCE_KM) return;
  trips.push({
    startIdx,
    endIdx,
    startedAt,
    endedAt,
    distanceKm,
    maxSpeedKmh,
    idleMs,
  });
}

// ═══════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════

/**
 * Returns all trips matching the filters. Cross-fleet · sorted by
 * start time descending (newest first).
 *
 * Implementation note: SQLite isn't great at gap-detection in pure
 * SQL, so we fetch positions per asset and reduce in JS. This is
 * fine for the demo (max ~250k positions / 23 vehicles). For a
 * real Postgres setup we'd push this into a stored function or
 * materialized view of "trip_starts" / "trip_ends".
 */
export async function listTrips(filters: TripFilters): Promise<TripRow[]> {
  const { startUtc, endUtc } = dateRangeToUtc(filters.fromDate, filters.toDate);
  const assetWhere: any = { mobilityType: "MOBILE" };
  if (filters.assetIds && filters.assetIds.length > 0) {
    assetWhere.id = { in: filters.assetIds };
  }
  if (filters.groupIds && filters.groupIds.length > 0) {
    assetWhere.groupId = { in: filters.groupIds };
  }
  if (filters.personIds && filters.personIds.length > 0) {
    assetWhere.currentDriverId = { in: filters.personIds };
  }
  const assets = await db.asset.findMany({
    where: assetWhere,
    select: {
      id: true,
      name: true,
      plate: true,
      make: true,
      model: true,
      currentDriver: { select: { firstName: true, lastName: true } },
    },
    orderBy: { name: "asc" },
  });

  const out: TripRow[] = [];
  for (const a of assets) {
    const positions = await db.position.findMany({
      where: {
        assetId: a.id,
        recordedAt: { gte: startUtc, lte: endUtc },
      },
      select: {
        recordedAt: true,
        lat: true,
        lng: true,
        speedKmh: true,
        ignition: true,
      },
      orderBy: { recordedAt: "asc" },
    });
    if (positions.length < 2) continue;

    const detected = detectTripsFromPositions(positions);

    // Optional: count events that fall inside each trip window
    // We pull all events for this asset in the window once · O(N)
    const eventsInWindow = await db.event.findMany({
      where: {
        assetId: a.id,
        occurredAt: { gte: startUtc, lte: endUtc },
      },
      select: { occurredAt: true, severity: true },
      orderBy: { occurredAt: "asc" },
    });

    for (const t of detected) {
      const startP = positions[t.startIdx]!;
      const endP = positions[t.endIdx]!;
      const durationMs = t.endedAt.getTime() - t.startedAt.getTime();
      const positionCount = t.endIdx - t.startIdx + 1;

      const tripEvents = eventsInWindow.filter(
        (e: { occurredAt: Date; severity: string }) =>
          e.occurredAt.getTime() >= t.startedAt.getTime() &&
          e.occurredAt.getTime() <= t.endedAt.getTime(),
      );
      const highSeverity = tripEvents.filter(
        (e: { severity: string }) =>
          e.severity === "HIGH" || e.severity === "CRITICAL",
      ).length;

      const movingMs = Math.max(0, durationMs - t.idleMs);
      const avgSpeedKmh =
        movingMs > 0 ? t.distanceKm / (movingMs / 3_600_000) : 0;

      out.push({
        id: `${a.id}:${t.startedAt.getTime()}`,
        assetId: a.id,
        assetName: a.name,
        assetPlate: a.plate,
        assetMake: a.make,
        assetModel: a.model,
        driverName: a.currentDriver
          ? `${a.currentDriver.firstName} ${a.currentDriver.lastName}`
          : null,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        durationMs,
        distanceKm: t.distanceKm,
        avgSpeedKmh,
        maxSpeedKmh: t.maxSpeedKmh,
        idleMs: t.idleMs,
        startLat: startP.lat,
        startLng: startP.lng,
        endLat: endP.lat,
        endLng: endP.lng,
        eventCount: tripEvents.length,
        highSeverityEventCount: highSeverity,
        positionCount,
      });
    }
  }

  // Sort by start time DESC (newest first)
  out.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return out;
}

/**
 * Aggregate KPIs over the trip list · cheap because we already
 * have it in memory.
 */
export function aggregateTripKpis(trips: TripRow[]): TripKpis {
  if (trips.length === 0) {
    return {
      totalTrips: 0,
      totalDistanceKm: 0,
      totalDurationMs: 0,
      totalIdleMs: 0,
      avgSpeedKmh: 0,
      totalEvents: 0,
      totalHighSeverityEvents: 0,
      vehiclesActive: 0,
    };
  }
  let dist = 0,
    durMs = 0,
    idleMs = 0,
    events = 0,
    highSev = 0;
  const vehicles = new Set<string>();
  for (const t of trips) {
    dist += t.distanceKm;
    durMs += t.durationMs;
    idleMs += t.idleMs;
    events += t.eventCount;
    highSev += t.highSeverityEventCount;
    vehicles.add(t.assetId);
  }
  const movingMs = Math.max(1, durMs - idleMs);
  return {
    totalTrips: trips.length,
    totalDistanceKm: dist,
    totalDurationMs: durMs,
    totalIdleMs: idleMs,
    avgSpeedKmh: dist / (movingMs / 3_600_000),
    totalEvents: events,
    totalHighSeverityEvents: highSev,
    vehiclesActive: vehicles.size,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Route polylines for the map overlay
//  ─────────────────────────────────────────────────────────────
//  Returns simplified routes (1 sample every Nth position) so we
//  can draw all trips on a single map without melting the browser.
//  Each route is colored by asset · the page maps that to colors.
// ═══════════════════════════════════════════════════════════════

export interface TripRoute {
  tripId: string;
  assetId: string;
  assetName: string;
  /** Simplified polyline · ~30-100 points per trip */
  points: { lat: number; lng: number }[];
}

const TARGET_POINTS_PER_TRIP = 80;

export async function getTripRoutes(
  filters: TripFilters,
  trips: TripRow[],
): Promise<TripRoute[]> {
  if (trips.length === 0) return [];
  const { startUtc, endUtc } = dateRangeToUtc(filters.fromDate, filters.toDate);

  // Group trips by asset for efficient querying
  const tripsByAsset = new Map<string, TripRow[]>();
  for (const t of trips) {
    if (!tripsByAsset.has(t.assetId)) tripsByAsset.set(t.assetId, []);
    tripsByAsset.get(t.assetId)!.push(t);
  }

  const routes: TripRoute[] = [];

  for (const [assetId, assetTrips] of tripsByAsset.entries()) {
    const positions = await db.position.findMany({
      where: {
        assetId,
        recordedAt: { gte: startUtc, lte: endUtc },
      },
      select: { recordedAt: true, lat: true, lng: true },
      orderBy: { recordedAt: "asc" },
    });

    for (const t of assetTrips) {
      // Slice positions for this trip
      const startMs = t.startedAt.getTime();
      const endMs = t.endedAt.getTime();
      const tripPositions = positions.filter(
        (p: { recordedAt: Date; lat: number; lng: number }) => {
          const ms = p.recordedAt.getTime();
          return ms >= startMs && ms <= endMs;
        },
      );
      if (tripPositions.length === 0) continue;

      // Simplify: take every Nth point so we end up with ~TARGET points
      const stride = Math.max(
        1,
        Math.floor(tripPositions.length / TARGET_POINTS_PER_TRIP),
      );
      const points: { lat: number; lng: number }[] = [];
      for (let i = 0; i < tripPositions.length; i += stride) {
        points.push({
          lat: tripPositions[i]!.lat,
          lng: tripPositions[i]!.lng,
        });
      }
      // Always include the very last point
      const last = tripPositions[tripPositions.length - 1]!;
      const tail = points[points.length - 1];
      if (!tail || tail.lat !== last.lat || tail.lng !== last.lng) {
        points.push({ lat: last.lat, lng: last.lng });
      }

      routes.push({
        tripId: t.id,
        assetId: t.assetId,
        assetName: t.assetName,
        points,
      });
    }
  }
  return routes;
}
