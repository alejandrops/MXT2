// ═══════════════════════════════════════════════════════════════
//  Activity Heatmap queries · daily activity grid (3 metrics)
//  ─────────────────────────────────────────────────────────────
//  Returns 365 days of activity for an asset or person. Each day
//  carries THREE metrics (so the same heatmap can be re-colored
//  client-side without refetching):
//
//    · km            cumulative haversine distance
//    · activeMinutes minutes with motor on (ignition true)
//    · eventCount    count of safety events on that day
//
//  Strategy:
//    · For days where Position rows exist for the asset(s), we
//      compute km + activeMinutes from the day's points. Real.
//    · Events come from a single GROUP BY query.
//    · For days WITHOUT real telemetry, we generate plausible
//      synthetic values using a deterministic seed (entity id +
//      date) so the same heatmap renders the same way every
//      time. These are clearly marked `isReal: false` so the
//      tooltip can disclose "estimado".
//
//  When the data warehouse is real, replace the synthetic branch
//  with a query against a pre-aggregated `daily_activity` table
//  or a TimescaleDB continuous aggregate.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

const DAYS_IN_YEAR = 365;
const MS_DAY = 24 * 60 * 60 * 1000;
const AR_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3

export interface HeatmapDay {
  /** YYYY-MM-DD in Argentina local time */
  date: string;
  /** Distance in km */
  km: number;
  /** Minutes with motor on */
  activeMinutes: number;
  /** Number of safety events */
  eventCount: number;
  /** True if any of the values came from real telemetry */
  isReal: boolean;
}

export interface ActivityHeatmap {
  days: HeatmapDay[];
  totalKm: number;
  totalActiveMinutes: number;
  totalEvents: number;
  activeDays: number;
  /** Day of the week (0 = Sunday) the first cell represents */
  startDayOfWeek: number;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

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

function seedRand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

/**
 * Generate plausible activity for a day without real telemetry.
 * Returns all 3 metrics correlated.
 */
function syntheticDay(
  seedKey: string,
  date: Date,
): { km: number; activeMinutes: number; eventCount: number } {
  const dow = (date.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
  const r1 = seedRand(seedKey + ":r1");
  const r2 = seedRand(seedKey + ":r2");
  const r3 = seedRand(seedKey + ":r3");
  const r4 = seedRand(seedKey + ":r4");

  if (dow === 6) {
    if (r1 < 0.85) return { km: 0, activeMinutes: 0, eventCount: 0 };
    const km = Math.round(20 + r2 * 40);
    return {
      km,
      activeMinutes: Math.round((km / 50) * 60),
      eventCount: r3 < 0.15 ? 1 : 0,
    };
  }
  if (dow === 5) {
    if (r1 < 0.55) return { km: 0, activeMinutes: 0, eventCount: 0 };
    const km = Math.round(40 + r2 * 110);
    return {
      km,
      activeMinutes: Math.round((km / 45) * 60),
      eventCount: r3 < 0.15 ? Math.floor(r4 * 2) + 1 : 0,
    };
  }
  if (r1 < 0.1) return { km: 0, activeMinutes: 0, eventCount: 0 };
  if (r2 > 0.95) {
    const km = Math.round(280 + r3 * 180);
    return {
      km,
      activeMinutes: Math.round((km / 55) * 60),
      eventCount: r4 < 0.6 ? Math.floor(r4 * 5) + 1 : 0,
    };
  }
  const km = Math.round(60 + r3 * 200);
  return {
    km,
    activeMinutes: Math.round((km / 45) * 60),
    eventCount: r4 < 0.25 ? Math.floor(r4 * 4) + 1 : 0,
  };
}

interface PositionRow {
  recordedAt: Date;
  lat: number;
  lng: number;
  ignition: boolean;
}

function bucketizePositions(
  positions: PositionRow[],
): Map<string, { km: number; activeMinutes: number }> {
  const byDay = new Map<string, PositionRow[]>();
  for (const p of positions) {
    const ymd = ymdAr(p.recordedAt.getTime());
    if (!byDay.has(ymd)) byDay.set(ymd, []);
    byDay.get(ymd)!.push(p);
  }
  const result = new Map<string, { km: number; activeMinutes: number }>();
  for (const [ymd, points] of byDay.entries()) {
    points.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    let km = 0;
    let activeMs = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      if (a.ignition) {
        km += haversineKm(a.lat, a.lng, b.lat, b.lng);
        const dt = b.recordedAt.getTime() - a.recordedAt.getTime();
        activeMs += Math.min(dt, 5 * 60 * 1000);
      }
    }
    result.set(ymd, { km, activeMinutes: activeMs / 60_000 });
  }
  return result;
}

function buildHeatmap(
  realByDay: Map<string, { km: number; activeMinutes: number }>,
  eventsByDay: Map<string, number>,
  seedKey: string,
  endDateMs: number = Date.now(),
): ActivityHeatmap {
  const days: HeatmapDay[] = [];
  let totalKm = 0;
  let totalActiveMinutes = 0;
  let totalEvents = 0;
  let activeDays = 0;

  for (let i = DAYS_IN_YEAR - 1; i >= 0; i--) {
    const ts = endDateMs - i * MS_DAY;
    const ymd = ymdAr(ts);
    const real = realByDay.get(ymd);
    const realEvents = eventsByDay.get(ymd) ?? 0;

    let km: number;
    let activeMinutes: number;
    let eventCount: number;
    let isReal: boolean;

    if (real || realEvents > 0) {
      km = Math.round(real?.km ?? 0);
      activeMinutes = Math.round(real?.activeMinutes ?? 0);
      eventCount = realEvents;
      isReal = true;
    } else {
      const syn = syntheticDay(`${seedKey}:${ymd}`, new Date(ts));
      km = syn.km;
      activeMinutes = syn.activeMinutes;
      eventCount = syn.eventCount;
      isReal = false;
    }

    days.push({ date: ymd, km, activeMinutes, eventCount, isReal });
    if (km > 0 || activeMinutes > 0 || eventCount > 0) {
      totalKm += km;
      totalActiveMinutes += activeMinutes;
      totalEvents += eventCount;
      activeDays++;
    }
  }

  const firstDate = new Date(endDateMs - (DAYS_IN_YEAR - 1) * MS_DAY);
  const startDayOfWeek = firstDate.getUTCDay();

  return {
    days,
    totalKm,
    totalActiveMinutes,
    totalEvents,
    activeDays,
    startDayOfWeek,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════

export async function getAssetActivityHeatmap(
  assetId: string,
): Promise<ActivityHeatmap> {
  const since = new Date(Date.now() - DAYS_IN_YEAR * MS_DAY);

  const [positions, events] = await Promise.all([
    db.position.findMany({
      where: { assetId, recordedAt: { gte: since } },
      select: { recordedAt: true, lat: true, lng: true, ignition: true },
      orderBy: { recordedAt: "asc" },
    }),
    db.event.findMany({
      where: { assetId, occurredAt: { gte: since } },
      select: { occurredAt: true },
    }),
  ]);

  const realByDay = bucketizePositions(positions as PositionRow[]);
  const eventsByDay = new Map<string, number>();
  for (const e of events as { occurredAt: Date }[]) {
    const ymd = ymdAr(e.occurredAt.getTime());
    eventsByDay.set(ymd, (eventsByDay.get(ymd) ?? 0) + 1);
  }

  return buildHeatmap(realByDay, eventsByDay, `asset:${assetId}`);
}

export async function getDriverActivityHeatmap(
  personId: string,
): Promise<ActivityHeatmap> {
  const person = await db.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      drivenAssets: { select: { id: true } },
    },
  });
  if (!person) {
    return buildHeatmap(new Map(), new Map(), `person:${personId}`);
  }

  const assetIds = (person.drivenAssets as { id: string }[]).map(
    (a) => a.id,
  );
  if (assetIds.length === 0) {
    return buildHeatmap(new Map(), new Map(), `person:${personId}`);
  }

  const since = new Date(Date.now() - DAYS_IN_YEAR * MS_DAY);
  const [positions, events] = await Promise.all([
    db.position.findMany({
      where: {
        assetId: { in: assetIds },
        recordedAt: { gte: since },
      },
      select: { recordedAt: true, lat: true, lng: true, ignition: true },
      orderBy: { recordedAt: "asc" },
    }),
    db.event.findMany({
      where: { personId, occurredAt: { gte: since } },
      select: { occurredAt: true },
    }),
  ]);

  const realByDay = bucketizePositions(positions as PositionRow[]);
  const eventsByDay = new Map<string, number>();
  for (const e of events as { occurredAt: Date }[]) {
    const ymd = ymdAr(e.occurredAt.getTime());
    eventsByDay.set(ymd, (eventsByDay.get(ymd) ?? 0) + 1);
  }

  return buildHeatmap(realByDay, eventsByDay, `person:${personId}`);
}
