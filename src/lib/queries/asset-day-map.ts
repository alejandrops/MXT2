// ═══════════════════════════════════════════════════════════════
//  Asset day map query · for the "Mapa" tab in vehicle detail
//  ─────────────────────────────────────────────────────────────
//  Returns the most recent day with telemetry data for an asset:
//  the route polyline, the last position, and quick stats for
//  that day. Used by the mini-map tab on /catalogos/vehiculos/[id].
//
//  We deliberately resolve the "current day" server-side (rather
//  than literally "today") because for demo data the latest day
//  with positions may be a few days old. This way the map is
//  never empty.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;

export interface AssetDayMap {
  /** ISO date (YYYY-MM-DD) of the day rendered */
  dateISO: string;
  /** Whether the rendered day is literally today's AR-local date */
  isToday: boolean;
  /** Polyline points · sorted by recordedAt ASC */
  points: {
    lat: number;
    lng: number;
    speedKmh: number;
    ignition: boolean;
    recordedAt: Date;
  }[];
  /** Last position of the day (or null if no points) */
  lastPosition: {
    lat: number;
    lng: number;
    speedKmh: number;
    heading: number;
    ignition: boolean;
    recordedAt: Date;
  } | null;
  stats: {
    pointCount: number;
    distanceKm: number;
    activeMinutes: number;
    tripCount: number;
    maxSpeedKmh: number;
    firstAt: Date | null;
    lastAt: Date | null;
  };
}

function ymdAr(ts: number): string {
  const local = new Date(ts - AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

export async function getAssetDayMap(
  assetId: string,
): Promise<AssetDayMap | null> {
  // Find the latest position to anchor the "current day"
  const last = await db.position.findFirst({
    where: { assetId },
    orderBy: { recordedAt: "desc" },
    select: {
      recordedAt: true,
      lat: true,
      lng: true,
      speedKmh: true,
      heading: true,
      ignition: true,
    },
  });

  if (!last) {
    // No data ever · return empty struct so the UI can show a hint
    const today = ymdAr(Date.now());
    return {
      dateISO: today,
      isToday: true,
      points: [],
      lastPosition: null,
      stats: {
        pointCount: 0,
        distanceKm: 0,
        activeMinutes: 0,
        tripCount: 0,
        maxSpeedKmh: 0,
        firstAt: null,
        lastAt: null,
      },
    };
  }

  // Resolve the AR-local day boundaries for the latest position
  const dayYmd = ymdAr(last.recordedAt.getTime());
  const todayYmd = ymdAr(Date.now());
  const localMidnight = new Date(`${dayYmd}T00:00:00.000Z`);
  const dayStart = new Date(localMidnight.getTime() + AR_OFFSET_MS);
  const dayEnd = new Date(dayStart.getTime() + MS_DAY);

  const points = (await db.position.findMany({
    where: {
      assetId,
      recordedAt: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { recordedAt: "asc" },
    select: {
      recordedAt: true,
      lat: true,
      lng: true,
      speedKmh: true,
      ignition: true,
    },
  })) as AssetDayMap["points"];

  // ── Compute stats ────────────────────────────────────
  let distanceKm = 0;
  let activeMs = 0;
  let maxSpeed = 0;
  // Trip detection: 15 min of motor-off separates trips
  const TRIP_GAP_MS = 15 * 60 * 1000;
  let trips = 0;
  let inTrip = false;
  let lastIgnOnAt = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (p.speedKmh > maxSpeed) maxSpeed = p.speedKmh;
    if (i > 0) {
      const prev = points[i - 1]!;
      if (prev.ignition) {
        distanceKm += haversineKm(prev.lat, prev.lng, p.lat, p.lng);
        const dt = p.recordedAt.getTime() - prev.recordedAt.getTime();
        activeMs += Math.min(dt, 5 * 60 * 1000);
      }
    }
    // Trip count
    if (p.ignition) {
      if (!inTrip) {
        const gap = p.recordedAt.getTime() - lastIgnOnAt;
        if (lastIgnOnAt === 0 || gap > TRIP_GAP_MS) trips++;
        inTrip = true;
      }
      lastIgnOnAt = p.recordedAt.getTime();
    } else {
      inTrip = false;
    }
  }

  return {
    dateISO: dayYmd,
    isToday: dayYmd === todayYmd,
    points,
    lastPosition: last ? { ...last, heading: last.heading ?? 0 } : null,
    stats: {
      pointCount: points.length,
      distanceKm: Math.round(distanceKm * 10) / 10,
      activeMinutes: Math.round(activeMs / 60_000),
      tripCount: trips,
      maxSpeedKmh: Math.round(maxSpeed),
      firstAt: points[0]?.recordedAt ?? null,
      lastAt: points[points.length - 1]?.recordedAt ?? null,
    },
  };
}
