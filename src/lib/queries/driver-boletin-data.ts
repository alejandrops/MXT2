// @ts-nocheck · pre-existing patterns (Prisma types stale)
// ═══════════════════════════════════════════════════════════════
//  getDriverBoletinData · S5-E1
//  ─────────────────────────────────────────────────────────────
//  Query agregadora que produce todos los datos necesarios para
//  el boletín mensual o anual de un conductor.
//
//  Soporta período mensual ("YYYY-MM") y anual ("YYYY").
//
//  Score · adaptación del Geotab Driver Safety Hybrid Method:
//    score = max(0, min(100, 100 - (kmExceso/kmTotal) * 100 * MULT))
//    MULT = 10 · ajustable.
//    Bandas: ≥80 verde · 60-80 amarilla · <60 roja
//
//  Output completo (DriverBoletinData) está pensado para serializar
//  como JSON en BoletinSnapshot.payload · sin Date objects, todo
//  primitivos.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { ParsedPeriod } from "@/lib/conduccion/boletin-driver-text";

const SCORE_MULTIPLIER = 10;

export interface DriverBoletinData {
  // Driver
  driver: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    accountName: string;
    /** ID corto para folio · 4-8 chars */
    idShort: string;
  };

  // Resumen del período
  summary: {
    distanceKm: number;
    activeMin: number;
    tripCount: number;
    activeDays: number;
    uniqueAssetsCount: number;
    /** Score 0-100 · ya redondeado a entero */
    score: number;
  };

  // Comparativa con período anterior · null si no hay datos
  prev: {
    score: number | null;
    distanceKm: number | null;
    tripCount: number | null;
    activeMin: number | null;
    infractionCount: number | null;
  };

  // Infracciones del período
  infractions: {
    total: number;
    leve: number;
    media: number;
    grave: number;
    /** Top 3 más graves del período · ordenadas por exceso desc */
    topThree: Array<{
      id: string;
      startedAtIso: string;
      assetName: string;
      assetPlate: string | null;
      vmaxKmh: number;
      peakSpeedKmh: number;
      maxExcessKmh: number;
      severity: "LEVE" | "MEDIA" | "GRAVE";
      startAddress: string | null;
    }>;
  };

  // Evolución temporal · sparkline data
  // Mensual: 4 semanas · Anual: 12 meses
  evolution: {
    /** Score por sub-período (week 1-4 mensual, jan-dec anual) */
    scoreSeries: number[];
    /** Distancia por sub-período */
    distanceSeries: number[];
    /** Etiquetas de los sub-períodos · "S1".."S4" o "ene".."dic" */
    labels: string[];
  };

  // Para mensual · días con infracciones para sparkline dot
  // null si anual
  daySpotlight: Array<null | "L" | "M" | "G"> | null;

  // Vehículos manejados (mensual) o info anual
  vehicles: Array<{
    id: string;
    name: string;
    plate: string | null;
    distanceKm: number;
    tripCount: number;
  }>;

  // Solo anual · meses en zona verde
  monthsInGreen: number | null;
}

export async function getDriverBoletinData(args: {
  driverId: string;
  period: ParsedPeriod;
  accountId: string | null;
}): Promise<DriverBoletinData | null> {
  const { driverId, period, accountId } = args;

  // ── 1. Driver + cuenta ───────────────────────────────
  const driver = await db.person.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      accountId: true,
      account: { select: { name: true } },
    },
  });
  if (!driver) return null;

  // Multi-tenant scope check
  if (accountId !== null && driver.accountId !== accountId) return null;

  // ── 2. Calcular rangos del período actual y anterior ──
  const { start, end } = periodToDateRange(period);
  const prevPeriod = getPreviousPeriod(period);
  const prev = periodToDateRange(prevPeriod);

  // ── 3. Resumen del período · queries paralelas ────────
  const [days, prevDays, infractions, prevInfractions, assetMeta] =
    await Promise.all([
      // assetDriverDay del período actual
      db.assetDriverDay.findMany({
        where: {
          personId: driverId,
          day: { gte: start, lt: end },
        },
        select: {
          distanceKm: true,
          activeMin: true,
          tripCount: true,
          assetId: true,
          day: true,
        },
      }),
      // assetDriverDay del período anterior · solo necesito agregados
      db.assetDriverDay.findMany({
        where: {
          personId: driverId,
          day: { gte: prev.start, lt: prev.end },
        },
        select: {
          distanceKm: true,
          activeMin: true,
          tripCount: true,
        },
      }),
      // Infracciones del período actual
      db.infraction.findMany({
        where: {
          driverId,
          startedAt: { gte: start, lt: end },
        },
        select: {
          id: true,
          startedAt: true,
          severity: true,
          vmaxKmh: true,
          peakSpeedKmh: true,
          maxExcessKmh: true,
          distanceMeters: true,
          startAddress: true,
          assetId: true,
          asset: { select: { name: true, plate: true } },
        },
        orderBy: { startedAt: "asc" },
      }),
      // Count del período anterior (para delta)
      db.infraction.count({
        where: {
          driverId,
          startedAt: { gte: prev.start, lt: prev.end },
        },
      }),
      // Metadata de los vehículos manejados
      db.assetDriverDay.findMany({
        where: {
          personId: driverId,
          day: { gte: start, lt: end },
        },
        select: {
          assetId: true,
          asset: { select: { name: true, plate: true } },
        },
        distinct: ["assetId"],
      }),
    ]);

  // ── 4. Agregaciones del resumen ──────────────────────
  const distanceKm = round1(days.reduce((acc, d) => acc + d.distanceKm, 0));
  const activeMin = days.reduce((acc, d) => acc + d.activeMin, 0);
  const tripCount = days.reduce((acc, d) => acc + d.tripCount, 0);
  const activeDays = new Set(
    days.map((d) => d.day.toISOString().slice(0, 10)),
  ).size;
  const uniqueAssetsCount = new Set(days.map((d) => d.assetId)).size;

  // Anterior · solo agregados
  const prevDistanceKm = round1(
    prevDays.reduce((acc, d) => acc + d.distanceKm, 0),
  );
  const prevTripCount = prevDays.reduce((acc, d) => acc + d.tripCount, 0);
  const prevActiveMin = prevDays.reduce((acc, d) => acc + d.activeMin, 0);

  // ── 5. Score actual y anterior ───────────────────────
  // Distancia en exceso · suma de distanceMeters de infracciones / 1000
  const excessKmCurrent = sum(infractions.map((i) => i.distanceMeters)) / 1000;
  const score = computeScore(distanceKm, excessKmCurrent);

  // Para el prev score necesito kmExceso prev · query separada simple
  const prevInfractionDistance = await db.infraction.aggregate({
    where: {
      driverId,
      startedAt: { gte: prev.start, lt: prev.end },
    },
    _sum: { distanceMeters: true },
  });
  const prevExcessKm = (prevInfractionDistance._sum.distanceMeters ?? 0) / 1000;
  const prevScore =
    prevDistanceKm > 0 ? computeScore(prevDistanceKm, prevExcessKm) : null;

  // ── 6. Infracciones · agregaciones por severidad ──────
  let leve = 0,
    media = 0,
    grave = 0;
  for (const i of infractions) {
    if (i.severity === "LEVE") leve++;
    else if (i.severity === "MEDIA") media++;
    else if (i.severity === "GRAVE") grave++;
  }

  // Top 3 más graves · ordenadas por maxExcessKmh desc
  const topThree = [...infractions]
    .sort((a, b) => b.maxExcessKmh - a.maxExcessKmh)
    .slice(0, 3)
    .map((i) => ({
      id: i.id,
      startedAtIso: i.startedAt.toISOString(),
      assetName: i.asset.name,
      assetPlate: i.asset.plate,
      vmaxKmh: i.vmaxKmh,
      peakSpeedKmh: Math.round(i.peakSpeedKmh),
      maxExcessKmh: Math.round(i.maxExcessKmh),
      severity: i.severity as "LEVE" | "MEDIA" | "GRAVE",
      startAddress: i.startAddress,
    }));

  // ── 7. Evolución · series temporales ──────────────────
  let evolution: DriverBoletinData["evolution"];
  let daySpotlight: DriverBoletinData["daySpotlight"] = null;
  let monthsInGreen: number | null = null;

  if (period.kind === "monthly") {
    // 4 semanas del mes · agregar por semana
    const weeks = bucketByWeek(start, end, days, infractions);
    evolution = {
      scoreSeries: weeks.map((w) => w.score),
      distanceSeries: weeks.map((w) => w.distanceKm),
      labels: ["S1", "S2", "S3", "S4", "S5"].slice(0, weeks.length),
    };
    // daySpotlight · una entrada por día del mes con la peor severity
    daySpotlight = bucketByDay(start, end, infractions);
  } else {
    // Anual · 12 meses
    const months = bucketByMonth(period.year, days, infractions);
    evolution = {
      scoreSeries: months.map((m) => m.score),
      distanceSeries: months.map((m) => m.distanceKm),
      labels: [
        "ene", "feb", "mar", "abr", "may", "jun",
        "jul", "ago", "sep", "oct", "nov", "dic",
      ],
    };
    monthsInGreen = months.filter((m) => m.score >= 80).length;
  }

  // ── 8. Vehículos manejados ───────────────────────────
  const vehicleAgg = new Map<
    string,
    { id: string; name: string; plate: string | null; distanceKm: number; tripCount: number }
  >();
  for (const d of days) {
    const existing = vehicleAgg.get(d.assetId);
    if (existing) {
      existing.distanceKm += d.distanceKm;
      existing.tripCount += d.tripCount;
    } else {
      const meta = assetMeta.find((a) => a.assetId === d.assetId);
      vehicleAgg.set(d.assetId, {
        id: d.assetId,
        name: meta?.asset.name ?? "—",
        plate: meta?.asset.plate ?? null,
        distanceKm: d.distanceKm,
        tripCount: d.tripCount,
      });
    }
  }
  const vehicles = Array.from(vehicleAgg.values())
    .map((v) => ({ ...v, distanceKm: round1(v.distanceKm) }))
    .sort((a, b) => b.distanceKm - a.distanceKm);

  return {
    driver: {
      id: driver.id,
      fullName: `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() || "—",
      firstName: driver.firstName ?? "",
      lastName: driver.lastName ?? "",
      accountName: driver.account?.name ?? "—",
      idShort: driver.id.slice(-4).toUpperCase(),
    },
    summary: {
      distanceKm,
      activeMin,
      tripCount,
      activeDays,
      uniqueAssetsCount,
      score,
    },
    prev: {
      score: prevScore,
      distanceKm: prevDistanceKm > 0 ? prevDistanceKm : null,
      tripCount: prevTripCount > 0 ? prevTripCount : null,
      activeMin: prevActiveMin > 0 ? prevActiveMin : null,
      infractionCount: prevInfractions > 0 ? prevInfractions : null,
    },
    infractions: {
      total: infractions.length,
      leve,
      media,
      grave,
      topThree,
    },
    evolution,
    daySpotlight,
    vehicles,
    monthsInGreen,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers internos
// ═══════════════════════════════════════════════════════════════

function periodToDateRange(p: ParsedPeriod): { start: Date; end: Date } {
  if (p.kind === "monthly") {
    // Mes en zona AR (UTC-3) · usar 03:00 UTC como inicio del día AR
    const start = new Date(Date.UTC(p.year, p.month! - 1, 1, 3));
    const end = new Date(Date.UTC(p.year, p.month!, 1, 3));
    return { start, end };
  }
  const start = new Date(Date.UTC(p.year, 0, 1, 3));
  const end = new Date(Date.UTC(p.year + 1, 0, 1, 3));
  return { start, end };
}

function getPreviousPeriod(p: ParsedPeriod): ParsedPeriod {
  if (p.kind === "monthly") {
    const prevMonth = p.month === 1 ? 12 : p.month! - 1;
    const prevYear = p.month === 1 ? p.year - 1 : p.year;
    return {
      kind: "monthly",
      year: prevYear,
      month: prevMonth,
      label: "",
      compact: "",
      previous: "",
    };
  }
  return {
    kind: "annual",
    year: p.year - 1,
    month: null,
    label: "",
    compact: "",
    previous: "",
  };
}

/** Score 0-100 · 100 - (excessKm/totalKm)*100*MULT, capado */
function computeScore(totalKm: number, excessKm: number): number {
  if (totalKm <= 0) return 100;
  const ratio = excessKm / totalKm;
  const raw = 100 - ratio * 100 * SCORE_MULTIPLIER;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

interface DayRow {
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  assetId: string;
  day: Date;
}
interface InfractionRow {
  startedAt: Date;
  severity: string;
  distanceMeters: number;
}

/** Agrupa days+infractions por semana ISO (lun-dom) dentro del mes */
function bucketByWeek(
  monthStart: Date,
  monthEnd: Date,
  days: DayRow[],
  infs: InfractionRow[],
): Array<{ score: number; distanceKm: number }> {
  // Construir buckets de semana · cada uno cubre 7 días desde monthStart
  const buckets: Array<{
    startMs: number;
    endMs: number;
    distanceKm: number;
    excessKm: number;
  }> = [];
  let cursor = monthStart.getTime();
  const endMs = monthEnd.getTime();
  while (cursor < endMs) {
    const next = Math.min(cursor + 7 * 86400000, endMs);
    buckets.push({ startMs: cursor, endMs: next, distanceKm: 0, excessKm: 0 });
    cursor = next;
  }
  for (const d of days) {
    const t = d.day.getTime();
    const b = buckets.find((bk) => t >= bk.startMs && t < bk.endMs);
    if (b) b.distanceKm += d.distanceKm;
  }
  for (const i of infs) {
    const t = i.startedAt.getTime();
    const b = buckets.find((bk) => t >= bk.startMs && t < bk.endMs);
    if (b) b.excessKm += i.distanceMeters / 1000;
  }
  return buckets.map((b) => ({
    distanceKm: round1(b.distanceKm),
    score: computeScore(b.distanceKm, b.excessKm),
  }));
}

/** Una entrada por día del mes · null si sin infracciones, sino la peor severity */
function bucketByDay(
  monthStart: Date,
  monthEnd: Date,
  infs: InfractionRow[],
): Array<null | "L" | "M" | "G"> {
  const totalDays = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000);
  const result: Array<null | "L" | "M" | "G"> = Array(totalDays).fill(null);
  for (const i of infs) {
    const dayIdx = Math.floor((i.startedAt.getTime() - monthStart.getTime()) / 86400000);
    if (dayIdx < 0 || dayIdx >= totalDays) continue;
    const sev = i.severity === "GRAVE" ? "G" : i.severity === "MEDIA" ? "M" : "L";
    const cur = result[dayIdx];
    // Mantener la peor del día
    if (cur === null) result[dayIdx] = sev;
    else if (cur === "L" && (sev === "M" || sev === "G")) result[dayIdx] = sev;
    else if (cur === "M" && sev === "G") result[dayIdx] = sev;
  }
  return result;
}

/** 12 meses del año · score y distancia por cada uno */
function bucketByMonth(
  year: number,
  days: DayRow[],
  infs: InfractionRow[],
): Array<{ score: number; distanceKm: number }> {
  const buckets = Array.from({ length: 12 }, () => ({
    distanceKm: 0,
    excessKm: 0,
  }));
  for (const d of days) {
    const m = d.day.getUTCMonth();
    if (d.day.getUTCFullYear() === year || (d.day.getUTCFullYear() === year + 1 && m === 0 && d.day.getUTCDate() === 1 && d.day.getUTCHours() < 3)) {
      // Compensar cutoff AR · día 1 ene 00-03 UTC pertenece a dic año anterior
      const monthIdx = d.day.getUTCFullYear() === year ? m : 11;
      buckets[monthIdx].distanceKm += d.distanceKm;
    }
  }
  for (const i of infs) {
    const m = i.startedAt.getUTCMonth();
    if (i.startedAt.getUTCFullYear() === year) {
      buckets[m].excessKm += i.distanceMeters / 1000;
    }
  }
  return buckets.map((b) => ({
    distanceKm: round1(b.distanceKm),
    score: computeScore(b.distanceKm, b.excessKm),
  }));
}
