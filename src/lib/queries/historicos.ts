// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
// ═══════════════════════════════════════════════════════════════
//  Históricos queries (Sub-lote 3.4)
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { Asset, Event, EventType, Position, Severity } from "@/types/domain";

// ═══════════════════════════════════════════════════════════════
//  Filter dropdown · Mobile assets only
//  ─────────────────────────────────────────────────────────────
//  Históricos shows trajectories — only meaningful for assets
//  that move. Excludes silos and other FIXED-mobility assets.
// ═══════════════════════════════════════════════════════════════

export interface AssetForFilter {
  id: string;
  name: string;
  plate: string | null;
  make: string | null;
  model: string | null;
}

export async function listMobileAssetsForFilter(
  accountId?: string | null,
): Promise<AssetForFilter[]> {
  return db.asset.findMany({
    where: {
      mobilityType: "MOBILE",
      ...(accountId ? { accountId } : {}),
    },
    select: {
      id: true,
      name: true,
      plate: true,
      make: true,
      model: true,
    },
    orderBy: { name: "asc" },
  });
}

// ═══════════════════════════════════════════════════════════════
//  Latest date with data · for default-date pickup
//  ─────────────────────────────────────────────────────────────
//  Returns the YYYY-MM-DD (Argentina local time) of the most
//  recent day that has any Position rows for the given asset.
//
//  Used when the user lands on Históricos without a date filter
//  — instead of guessing "yesterday" we use the actual latest
//  day with real telemetry, so the page always renders something
//  useful regardless of when the seed was last run.
// ═══════════════════════════════════════════════════════════════

export async function getLatestDateWithData(
  assetId: string,
): Promise<string | null> {
  const last = await db.position.findFirst({
    where: { assetId },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });
  if (!last) return null;
  // Translate UTC timestamp to Argentina local date (UTC-3)
  const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
  const localMs = last.recordedAt.getTime() - AR_OFFSET_MS;
  return new Date(localMs).toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
//  Daily trajectory · positions + events for a single day
// ═══════════════════════════════════════════════════════════════

export interface TrajectoryPoint {
  lat: number;
  lng: number;
  recordedAt: Date;
  speedKmh: number;
  heading: number;
  ignition: boolean;
}

export interface TrajectoryEvent {
  id: string;
  type: EventType;
  severity: Severity;
  occurredAt: Date;
  lat: number | null;
  lng: number | null;
}

// ═══════════════════════════════════════════════════════════════
//  Segments · derived from positions
//  ─────────────────────────────────────────────────────────────
//  We segment the day into 3 kinds of intervals:
//    · TRIP    · vehicle moving (speed >= 5 km/h sustained)
//    · IDLE    · ignition on, speed < 5 km/h
//    · STOP    · ignition off (or unknown), speed = 0
//
//  Algorithm:
//    1. Classify each position as M(oving)/I(dle)/S(top)
//    2. Walk the sequence; close current segment when classification
//       changes for at least MIN_SEGMENT_MS (avoids flapping at
//       traffic lights, brief speed dips, etc)
//    3. Tiny segments (<MIN_SEGMENT_MS) get absorbed into neighbors
// ═══════════════════════════════════════════════════════════════

export type SegmentKind = "TRIP" | "IDLE" | "STOP";

export interface Segment {
  id: string;
  kind: SegmentKind;
  startAt: Date;
  endAt: Date;
  durationMs: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  /** Distance in km · only meaningful for TRIPs */
  distanceKm: number;
  /** Max speed reached during the segment */
  maxSpeedKmh: number;
}

export interface DailyTrajectory {
  asset: {
    id: string;
    name: string;
    plate: string | null;
    make: string | null;
    model: string | null;
    currentDriver: {
      id: string;
      firstName: string;
      lastName: string;
      document: string | null;
      safetyScore: number;
    } | null;
  };
  dateISO: string; // YYYY-MM-DD
  points: TrajectoryPoint[];
  events: TrajectoryEvent[];
  segments: Segment[];
  stats: {
    pointCount: number;
    eventCount: number;
    startAt: Date | null;
    endAt: Date | null;
    durationMs: number;
    distanceKm: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    tripCount: number;
    stopCount: number;
    idleCount: number;
  };
}

export async function getDailyTrajectory(
  assetId: string,
  dateISO: string, // YYYY-MM-DD · interpreted as Argentina local day
  fromTime?: string | null, // HH:MM · optional · clip start
  toTime?: string | null, // HH:MM · optional · clip end
): Promise<DailyTrajectory | null> {
  // Compute Argentina local day boundaries (UTC-3) and translate
  // to UTC for the query. A "day" for fleet operators is the local
  // civil day, not the UTC day — vehicles often work overnight
  // shifts that would split awkwardly across UTC midnight.
  //
  // 00:00 AR = 03:00 UTC, 24:00 AR = 03:00 UTC next day
  const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
  const localMidnight = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(localMidnight.getTime())) return null;
  const dayStart = new Date(localMidnight.getTime() + AR_OFFSET_MS);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Apply optional HH:MM clipping (F2). If both times come, narrow
  // [dayStart, dayEnd] to [dayStart+from, dayStart+to]. Otherwise
  // we keep the full-day window.
  let windowStart = dayStart;
  let windowEnd = dayEnd;
  if (fromTime && toTime) {
    const parseHHMM = (t: string): number | null => {
      const m = /^(\d{2}):(\d{2})$/.exec(t);
      if (!m) return null;
      const hh = parseInt(m[1]!, 10);
      const mm = parseInt(m[2]!, 10);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return hh * 60 + mm;
    };
    const fromMin = parseHHMM(fromTime);
    const toMin = parseHHMM(toTime);
    if (fromMin !== null && toMin !== null && fromMin < toMin) {
      windowStart = new Date(dayStart.getTime() + fromMin * 60_000);
      windowEnd = new Date(dayStart.getTime() + toMin * 60_000);
    }
  }

  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      name: true,
      plate: true,
      make: true,
      model: true,
      currentDriver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          document: true,
          safetyScore: true,
        },
      },
    },
  });
  if (!asset) return null;

  const [positionsRaw, eventsRaw] = await Promise.all([
    db.position.findMany({
      where: {
        assetId,
        recordedAt: { gte: windowStart, lt: windowEnd },
      },
      orderBy: { recordedAt: "asc" },
      select: {
        lat: true,
        lng: true,
        recordedAt: true,
        speedKmh: true,
        heading: true,
        ignition: true,
      },
    }),
    db.event.findMany({
      where: {
        assetId,
        occurredAt: { gte: windowStart, lt: windowEnd },
      },
      orderBy: { occurredAt: "asc" },
      select: {
        id: true,
        type: true,
        severity: true,
        occurredAt: true,
        lat: true,
        lng: true,
      },
    }),
  ]);

  const points: TrajectoryPoint[] = positionsRaw.map((p) => ({
    ...p,
    heading: p.heading ?? 0,
  }));
  const events: TrajectoryEvent[] = eventsRaw;

  // ── Aggregate stats ────────────────────────────────────────
  const startAt = points[0]?.recordedAt ?? null;
  const endAt = points[points.length - 1]?.recordedAt ?? null;
  const durationMs =
    startAt && endAt ? endAt.getTime() - startAt.getTime() : 0;

  let distanceKm = 0;
  let totalSpeed = 0;
  let maxSpeed = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    totalSpeed += p.speedKmh;
    if (p.speedKmh > maxSpeed) maxSpeed = p.speedKmh;
    if (i > 0) {
      const prev = points[i - 1]!;
      distanceKm += haversineKm(prev.lat, prev.lng, p.lat, p.lng);
    }
  }

  const avgSpeedKmh = points.length > 0 ? totalSpeed / points.length : 0;

  // ── Segments ──────────────────────────────────────────────
  const segments = computeSegments(points);
  const tripCount = segments.filter((s) => s.kind === "TRIP").length;
  const stopCount = segments.filter((s) => s.kind === "STOP").length;
  const idleCount = segments.filter((s) => s.kind === "IDLE").length;

  return {
    asset,
    dateISO,
    points,
    events,
    segments,
    stats: {
      pointCount: points.length,
      eventCount: events.length,
      startAt,
      endAt,
      durationMs,
      distanceKm,
      avgSpeedKmh,
      maxSpeedKmh: maxSpeed,
      tripCount,
      stopCount,
      idleCount,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Haversine distance in km between two lat/lng points.
 * Used for trip distance aggregation.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ═══════════════════════════════════════════════════════════════
//  Segmentation algorithm
//  ─────────────────────────────────────────────────────────────
//  Walks the sorted positions and groups them into TRIP / IDLE /
//  STOP intervals.
//
//    1. Each point is classified by (speed, ignition):
//         M (moving)  · speed >= MOVING_THRESHOLD
//         I (idling)  · speed < threshold AND ignition ON
//         S (stopped) · ignition OFF (or no ignition info + speed=0)
//
//    2. Consecutive same-class points form raw segments.
//
//    3. Tiny segments (< MIN_SEGMENT_MS, e.g. brief speed dip at
//       a traffic light) get merged into the surrounding context:
//         · A short M sandwiched between two long S → folded into S
//         · A short I in the middle of a long M → folded into M
//
//    4. Adjacent segments of the same kind are merged after the
//       absorption pass.
// ═══════════════════════════════════════════════════════════════

const MOVING_THRESHOLD_KMH = 5;
const MIN_SEGMENT_MS = 60_000; // 1 minute · ignore brief flapping

type SegKind = SegmentKind;

function classifyPoint(p: TrajectoryPoint): SegKind {
  if (p.speedKmh >= MOVING_THRESHOLD_KMH) return "TRIP";
  if (p.ignition) return "IDLE";
  return "STOP";
}

function computeSegments(points: TrajectoryPoint[]): Segment[] {
  if (points.length === 0) return [];

  // ── Pass 1 · build raw segments by class ──────────────────
  type RawSeg = {
    kind: SegKind;
    startIdx: number;
    endIdx: number; // inclusive
  };
  const raw: RawSeg[] = [];
  let cur: RawSeg = {
    kind: classifyPoint(points[0]!),
    startIdx: 0,
    endIdx: 0,
  };
  for (let i = 1; i < points.length; i++) {
    const k = classifyPoint(points[i]!);
    if (k === cur.kind) {
      cur.endIdx = i;
    } else {
      raw.push(cur);
      cur = { kind: k, startIdx: i, endIdx: i };
    }
  }
  raw.push(cur);

  // ── Pass 2 · absorb tiny segments ─────────────────────────
  // If a segment is shorter than MIN_SEGMENT_MS and is sandwiched
  // between two of the same different kind, fold it into them.
  const absorbed: RawSeg[] = [];
  for (let i = 0; i < raw.length; i++) {
    const seg = raw[i]!;
    const dur =
      points[seg.endIdx]!.recordedAt.getTime() -
      points[seg.startIdx]!.recordedAt.getTime();
    const prev = absorbed[absorbed.length - 1];
    const next = raw[i + 1];
    if (
      dur < MIN_SEGMENT_MS &&
      prev &&
      next &&
      prev.kind === next.kind &&
      prev.kind !== seg.kind
    ) {
      // Fold this segment into prev; we'll also fold next when we visit it
      prev.endIdx = seg.endIdx;
      continue;
    }
    if (
      prev &&
      prev.kind === seg.kind
    ) {
      // Merge with previous if same kind (post-absorption neighbors)
      prev.endIdx = seg.endIdx;
      continue;
    }
    absorbed.push({ ...seg });
  }

  // ── Pass 3 · materialize Segment objects with stats ───────
  const segments: Segment[] = [];
  for (let i = 0; i < absorbed.length; i++) {
    const r = absorbed[i]!;
    const startPt = points[r.startIdx]!;
    const endPt = points[r.endIdx]!;
    let dist = 0;
    let maxSpd = 0;
    for (let j = r.startIdx; j <= r.endIdx; j++) {
      const p = points[j]!;
      if (p.speedKmh > maxSpd) maxSpd = p.speedKmh;
      if (j > r.startIdx) {
        const prev = points[j - 1]!;
        dist += haversineKm(prev.lat, prev.lng, p.lat, p.lng);
      }
    }
    segments.push({
      id: `seg-${i}`,
      kind: r.kind,
      startAt: startPt.recordedAt,
      endAt: endPt.recordedAt,
      durationMs: endPt.recordedAt.getTime() - startPt.recordedAt.getTime(),
      startLat: startPt.lat,
      startLng: startPt.lng,
      endLat: endPt.lat,
      endLng: endPt.lng,
      distanceKm: r.kind === "TRIP" ? dist : 0,
      maxSpeedKmh: maxSpd,
    });
  }

  return segments;
}
