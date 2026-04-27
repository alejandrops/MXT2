// ═══════════════════════════════════════════════════════════════
//  Asset · Drivers · queries (E5-A)
//  ─────────────────────────────────────────────────────────────
//  Lectura de la tabla precalculada AssetDriverDay para el tab
//  "Conductor" de la Vista 360 de vehículo. Exposes:
//
//    · getAssetDriverList(assetId)
//        Lista de conductores que pasaron por el vehículo, con
//        stats agregadas (km totales, tiempo, días, viajes,
//        último día). Ordenada por último contacto desc.
//
//    · getAssetDriverWeeklyHeatmap(assetId, weeks)
//        Grilla [personId][weekIdx] → kmDeLaSemana.
//        Color de la celda = chofer dominante de la semana,
//        intensidad = km. Usado por <AssetDriversHeatmap/>.
//
//  La UI NUNCA consulta Position desde acá · todo sale de
//  AssetDriverDay, que se puebla en seed (futuro: batch job).
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
//  getAssetDriverList
// ═══════════════════════════════════════════════════════════════

export interface AssetDriverRow {
  personId: string;
  firstName: string;
  lastName: string;
  safetyScore: number;
  /// Total km driven by this person on this asset across all days.
  totalKm: number;
  /// Total active minutes (motor on).
  totalActiveMin: number;
  /// Number of distinct days this person drove this asset.
  dayCount: number;
  /// Total trip count summed across days.
  tripCount: number;
  /// Most recent day this person drove the vehicle (AR-local).
  lastDay: Date;
  /// First day in the available window.
  firstDay: Date;
  /// True if this person is the asset's currentDriverId.
  isCurrent: boolean;
}

export async function getAssetDriverList(
  assetId: string,
): Promise<AssetDriverRow[]> {
  const [asset, days] = await Promise.all([
    db.asset.findUnique({
      where: { id: assetId },
      select: { currentDriverId: true },
    }),
    db.assetDriverDay.findMany({
      where: { assetId },
      orderBy: { day: "asc" },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            safetyScore: true,
          },
        },
      },
    }),
  ]);

  if (days.length === 0) return [];

  const currentId = asset?.currentDriverId ?? null;

  // Bucket by personId
  const byPerson = new Map<string, AssetDriverRow>();
  for (const d of days) {
    const existing = byPerson.get(d.personId);
    if (existing) {
      existing.totalKm += d.distanceKm;
      existing.totalActiveMin += d.activeMin;
      existing.dayCount += 1;
      existing.tripCount += d.tripCount;
      if (d.day > existing.lastDay) existing.lastDay = d.day;
      if (d.day < existing.firstDay) existing.firstDay = d.day;
    } else {
      byPerson.set(d.personId, {
        personId: d.personId,
        firstName: d.person.firstName,
        lastName: d.person.lastName,
        safetyScore: d.person.safetyScore,
        totalKm: d.distanceKm,
        totalActiveMin: d.activeMin,
        dayCount: 1,
        tripCount: d.tripCount,
        firstDay: d.day,
        lastDay: d.day,
        isCurrent: d.personId === currentId,
      });
    }
  }

  // Sort by lastDay DESC (most recently active first), then by km DESC
  const out = Array.from(byPerson.values());
  out.sort((a, b) => {
    const dt = b.lastDay.getTime() - a.lastDay.getTime();
    if (dt !== 0) return dt;
    return b.totalKm - a.totalKm;
  });

  // Round km to 1 decimal for display
  for (const r of out) {
    r.totalKm = Math.round(r.totalKm * 10) / 10;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  getAssetDriverWeeklyHeatmap
// ═══════════════════════════════════════════════════════════════

export interface DriverHeatmapWeek {
  /// Week start date (AR-local Monday 00:00, stored as UTC instant)
  weekStart: Date;
  /// ISO date YYYY-MM-DD of the Monday
  weekStartISO: string;
  /// Driver who drove the most km this week (null = no activity)
  dominantPersonId: string | null;
  /// Total km driven this week (all drivers combined)
  totalKm: number;
  /// Per-driver breakdown · only drivers who drove this week
  byPerson: { personId: string; km: number; days: number }[];
}

export interface DriverHeatmapResult {
  /// Drivers in the order they should appear as rows
  drivers: {
    personId: string;
    firstName: string;
    lastName: string;
    /// Stable color slot 0..N for the heatmap palette
    colorSlot: number;
    isCurrent: boolean;
  }[];
  /// Weeks ordered ASC (oldest first, most recent last)
  weeks: DriverHeatmapWeek[];
  /// Maximum totalKm across all weeks · used to scale intensity
  maxWeekKm: number;
}

/**
 * Build the weekly heatmap for the Conductor tab.
 *
 * @param assetId  Vehicle to query
 * @param weeks    How many weeks back from today to include (default 53)
 * @param now      Reference instant for "today" (default: Date.now())
 */
export async function getAssetDriverWeeklyHeatmap(
  assetId: string,
  weeks = 53,
  now: number = Date.now(),
): Promise<DriverHeatmapResult> {
  // Anchor on AR-local Monday of the current week
  const todayMondayUtc = arLocalMondayUtc(now);
  const earliestMondayUtc = new Date(
    todayMondayUtc.getTime() - (weeks - 1) * 7 * MS_DAY,
  );

  const [asset, rows] = await Promise.all([
    db.asset.findUnique({
      where: { id: assetId },
      select: { currentDriverId: true },
    }),
    db.assetDriverDay.findMany({
      where: {
        assetId,
        day: { gte: earliestMondayUtc },
      },
      orderBy: { day: "asc" },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  // Build week buckets · key = weekStart UTC instant
  interface WeekAccum {
    weekStart: Date;
    byPerson: Map<string, { km: number; days: number }>;
    totalKm: number;
  }
  const weekMap = new Map<number, WeekAccum>();

  for (let i = 0; i < weeks; i++) {
    const ws = new Date(earliestMondayUtc.getTime() + i * 7 * MS_DAY);
    weekMap.set(ws.getTime(), {
      weekStart: ws,
      byPerson: new Map(),
      totalKm: 0,
    });
  }

  // Track which persons appear at all so we can emit driver rows
  // even if they only drove 1 day.
  const personDirectory = new Map<
    string,
    { firstName: string; lastName: string; firstSeen: number }
  >();

  for (const r of rows) {
    const ws = weekStartUtcOf(r.day.getTime());
    const w = weekMap.get(ws.getTime());
    if (!w) continue;
    const prev = w.byPerson.get(r.personId) ?? { km: 0, days: 0 };
    prev.km += r.distanceKm;
    prev.days += 1;
    w.byPerson.set(r.personId, prev);
    w.totalKm += r.distanceKm;

    const dirEntry = personDirectory.get(r.personId);
    if (!dirEntry) {
      personDirectory.set(r.personId, {
        firstName: r.person.firstName,
        lastName: r.person.lastName,
        firstSeen: r.day.getTime(),
      });
    } else if (r.day.getTime() < dirEntry.firstSeen) {
      dirEntry.firstSeen = r.day.getTime();
    }
  }

  // ── Emit weeks (ASC) with dominant driver and per-person rollup
  const weeksOut: DriverHeatmapWeek[] = [];
  let maxKm = 0;
  const orderedKeys = Array.from(weekMap.keys()).sort((a, b) => a - b);
  for (const k of orderedKeys) {
    const w = weekMap.get(k)!;
    let dominant: string | null = null;
    let dominantKm = -1;
    const byPerson: DriverHeatmapWeek["byPerson"] = [];
    for (const [personId, agg] of w.byPerson) {
      byPerson.push({ personId, km: agg.km, days: agg.days });
      if (agg.km > dominantKm) {
        dominant = personId;
        dominantKm = agg.km;
      }
    }
    if (w.totalKm > maxKm) maxKm = w.totalKm;
    weeksOut.push({
      weekStart: w.weekStart,
      weekStartISO: ymdAr(w.weekStart.getTime()),
      dominantPersonId: dominant,
      totalKm: Math.round(w.totalKm * 10) / 10,
      byPerson: byPerson.map((p) => ({
        ...p,
        km: Math.round(p.km * 10) / 10,
      })),
    });
  }

  // ── Emit drivers · order: current first, then by firstSeen ASC
  const currentId = asset?.currentDriverId ?? null;
  const driversArr = Array.from(personDirectory.entries()).map(
    ([personId, d]) => ({
      personId,
      firstName: d.firstName,
      lastName: d.lastName,
      firstSeen: d.firstSeen,
      isCurrent: personId === currentId,
    }),
  );
  driversArr.sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return a.firstSeen - b.firstSeen;
  });

  return {
    drivers: driversArr.map((d, idx) => ({
      personId: d.personId,
      firstName: d.firstName,
      lastName: d.lastName,
      colorSlot: idx % HEATMAP_PALETTE_SIZE,
      isCurrent: d.isCurrent,
    })),
    weeks: weeksOut,
    maxWeekKm: Math.round(maxKm * 10) / 10,
  };
}

/// Number of distinct hues in the heatmap palette (in
/// AssetDriversHeatmap.module.css). Drivers cycle through these.
const HEATMAP_PALETTE_SIZE = 6;

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

/** UTC instant of the most recent AR-local Monday 00:00 ≤ ts */
function arLocalMondayUtc(ts: number): Date {
  // Move into AR-local frame
  const localMs = ts - AR_OFFSET_MS;
  const local = new Date(localMs);
  // getUTCDay on the shifted timestamp gives AR-local weekday
  // (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dow = local.getUTCDay();
  // Days back to Monday · if Sunday (0), back 6 days; otherwise dow-1
  const daysBack = dow === 0 ? 6 : dow - 1;
  // AR-local 00:00 of that Monday
  const mondayLocalMs =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
    ) -
    daysBack * MS_DAY;
  // Translate back to UTC instant (AR-local 00:00 = 03:00 UTC)
  return new Date(mondayLocalMs + AR_OFFSET_MS);
}

/** UTC instant of the AR-local Monday 00:00 of the week containing ts */
function weekStartUtcOf(ts: number): Date {
  return arLocalMondayUtc(ts);
}

function ymdAr(ts: number): string {
  const local = new Date(ts - AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ═══════════════════════════════════════════════════════════════
//  F7 · Mirror del E5-A · query desde la perspectiva del Person
//  ─────────────────────────────────────────────────────────────
//  Para el tab "Vehículos manejados" del Conductor 360.
//  Misma data (AssetDriverDay) · agregada por (asset, week) en
//  vez de (person, week).
// ═══════════════════════════════════════════════════════════════

export interface PersonAssetRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  /** Total km manejados por este conductor en este asset · all-time */
  totalKm: number;
  /** Días distintos manejando este asset */
  totalDays: number;
  /** Cantidad de viajes registrados */
  totalTrips: number;
  /** Última vez que el conductor manejó este asset */
  lastDay: Date;
  /** Es el asset que más manejó (most-driven badge) */
  isMostDriven: boolean;
}

/**
 * Lista de assets que manejó este conductor (cross-time).
 * Usado en el header del tab "Vehículos manejados" del 360.
 */
export async function getDriverAssetList(
  personId: string,
): Promise<PersonAssetRow[]> {
  const rows = await db.assetDriverDay.findMany({
    where: { personId },
    orderBy: { day: "asc" },
    include: {
      asset: {
        select: { id: true, name: true, plate: true },
      },
    },
  });

  if (rows.length === 0) return [];

  interface Bucket {
    assetName: string;
    assetPlate: string | null;
    totalKm: number;
    totalDays: number;
    totalTrips: number;
    lastDay: Date;
  }
  const byAsset = new Map<string, Bucket>();
  for (const r of rows as any[]) {
    const cur = byAsset.get(r.assetId);
    if (cur) {
      cur.totalKm += r.distanceKm;
      cur.totalDays += 1;
      cur.totalTrips += r.tripCount;
      if (r.day > cur.lastDay) cur.lastDay = r.day;
    } else {
      byAsset.set(r.assetId, {
        assetName: r.asset.name,
        assetPlate: r.asset.plate,
        totalKm: r.distanceKm,
        totalDays: 1,
        totalTrips: r.tripCount,
        lastDay: r.day,
      });
    }
  }

  // Pick most-driven by km
  let mostDrivenId: string | null = null;
  let mostKm = -Infinity;
  for (const [id, b] of byAsset) {
    if (b.totalKm > mostKm) {
      mostKm = b.totalKm;
      mostDrivenId = id;
    }
  }

  return Array.from(byAsset.entries())
    .map(([id, b]): PersonAssetRow => ({
      assetId: id,
      assetName: b.assetName,
      assetPlate: b.assetPlate,
      totalKm: Math.round(b.totalKm * 10) / 10,
      totalDays: b.totalDays,
      totalTrips: b.totalTrips,
      lastDay: b.lastDay,
      isMostDriven: id === mostDrivenId,
    }))
    .sort((a, b) => b.totalKm - a.totalKm);
}

export interface PersonAssetHeatmapWeek {
  weekStart: Date;
  weekStartISO: string;
  /** Asset con más km en esta semana · null si nada */
  dominantAssetId: string | null;
  /** Total km de la semana · todos los assets sumados */
  totalKm: number;
  byAsset: { assetId: string; km: number; days: number }[];
}

export interface PersonAssetHeatmapResult {
  assets: {
    assetId: string;
    assetName: string;
    assetPlate: string | null;
    /** Slot 0..N de la paleta · estable por asset */
    colorSlot: number;
    isMostDriven: boolean;
  }[];
  weeks: PersonAssetHeatmapWeek[];
  maxWeekKm: number;
}

/**
 * Heatmap por (asset, week) para el Conductor 360.
 * Mismo shape conceptual que getAssetDriverWeeklyHeatmap pero
 * pivoteado: filas = asset (no person), color slot = asset.
 */
export async function getDriverAssetWeeklyHeatmap(
  personId: string,
  weeks = 53,
  now: number = Date.now(),
): Promise<PersonAssetHeatmapResult> {
  const todayMondayUtc = arLocalMondayUtc(now);
  const earliestMondayUtc = new Date(
    todayMondayUtc.getTime() - (weeks - 1) * 7 * MS_DAY,
  );

  const rows = await db.assetDriverDay.findMany({
    where: {
      personId,
      day: { gte: earliestMondayUtc },
    },
    orderBy: { day: "asc" },
    include: {
      asset: {
        select: { id: true, name: true, plate: true },
      },
    },
  });

  // Build week buckets
  interface WeekAccum {
    weekStart: Date;
    byAsset: Map<string, { km: number; days: number }>;
    totalKm: number;
  }
  const weekMap = new Map<number, WeekAccum>();
  for (let w = 0; w < weeks; w++) {
    const ws = new Date(
      earliestMondayUtc.getTime() + w * 7 * MS_DAY,
    );
    weekMap.set(ws.getTime(), {
      weekStart: ws,
      byAsset: new Map(),
      totalKm: 0,
    });
  }

  // Aggregate · also collect all-time totals to pick most-driven
  const allTimeKmByAsset = new Map<string, number>();
  const assetMeta = new Map<
    string,
    { name: string; plate: string | null }
  >();

  for (const r of rows as any[]) {
    const wkUtc = weekStartUtcOf(r.day.getTime());
    const wk = weekMap.get(wkUtc.getTime());
    if (!wk) continue;
    const cur = wk.byAsset.get(r.assetId);
    if (cur) {
      cur.km += r.distanceKm;
      cur.days += 1;
    } else {
      wk.byAsset.set(r.assetId, { km: r.distanceKm, days: 1 });
    }
    wk.totalKm += r.distanceKm;
    allTimeKmByAsset.set(
      r.assetId,
      (allTimeKmByAsset.get(r.assetId) ?? 0) + r.distanceKm,
    );
    if (!assetMeta.has(r.assetId)) {
      assetMeta.set(r.assetId, {
        name: r.asset.name,
        plate: r.asset.plate,
      });
    }
  }

  // Pick most-driven by all-time km
  let mostDrivenId: string | null = null;
  let mostKm = -Infinity;
  for (const [id, km] of allTimeKmByAsset) {
    if (km > mostKm) {
      mostKm = km;
      mostDrivenId = id;
    }
  }

  // Order assets · most-driven first, others by all-time km desc
  const orderedAssetIds = Array.from(allTimeKmByAsset.entries())
    .sort((a, b) => {
      if (a[0] === mostDrivenId) return -1;
      if (b[0] === mostDrivenId) return 1;
      return b[1] - a[1];
    })
    .map(([id]) => id);

  const assets = orderedAssetIds.map((id, idx) => {
    const meta = assetMeta.get(id)!;
    return {
      assetId: id,
      assetName: meta.name,
      assetPlate: meta.plate,
      colorSlot: idx % HEATMAP_PALETTE_SIZE,
      isMostDriven: id === mostDrivenId,
    };
  });

  const weeksOut: PersonAssetHeatmapWeek[] = Array.from(weekMap.values())
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map((wk): PersonAssetHeatmapWeek => {
      let dominantAssetId: string | null = null;
      let dominantKm = -Infinity;
      const byAsset: PersonAssetHeatmapWeek["byAsset"] = [];
      for (const [aid, agg] of wk.byAsset) {
        byAsset.push({ assetId: aid, km: agg.km, days: agg.days });
        if (agg.km > dominantKm) {
          dominantKm = agg.km;
          dominantAssetId = aid;
        }
      }
      return {
        weekStart: wk.weekStart,
        weekStartISO: ymdAr(wk.weekStart.getTime()),
        dominantAssetId,
        totalKm: wk.totalKm,
        byAsset,
      };
    });

  const maxWeekKm = Math.max(0, ...weeksOut.map((w) => w.totalKm));

  return { assets, weeks: weeksOut, maxWeekKm };
}
