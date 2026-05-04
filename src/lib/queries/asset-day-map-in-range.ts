// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
import { db } from "@/lib/db";
import type { AssetDayMap } from "./asset-day-map";
import type { AnalysisGranularity } from "./analysis";

// ═══════════════════════════════════════════════════════════════
//  getAssetDayMapInRange · variante para el Libro del Objeto
//  ─────────────────────────────────────────────────────────────
//  El Libro respeta el período que el usuario seleccionó. Si el
//  período activo es marzo 2026, no tiene sentido mostrar "ruta
//  de hoy" · hay que mostrar el último día con datos DENTRO de
//  marzo 2026.
//
//  Este loader es un hermano de getAssetDayMap (que sigue siendo
//  usado por otras pantallas). La diferencia es que acepta el
//  período (granularity + anchor) y busca dentro de ese rango.
//
//  Reusa el shape AssetDayMap del loader original. Misma deuda
//  preexistente con Position · no la abro acá.
// ═══════════════════════════════════════════════════════════════

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

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

/**
 * Computa el rango UTC [start, end) que cubre el período definido
 * por la granularidad y el ancla, en zona AR.
 */
function computePeriodRange(
  granularity: AnalysisGranularity,
  anchorIso: string,
): { startUtc: Date; endUtc: Date } {
  const [y, m, d] = anchorIso.split("-").map(Number);
  const anchorLocal = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));

  let startLocal: Date;
  let endLocal: Date;

  switch (granularity) {
    case "day-hours":
      startLocal = new Date(anchorLocal);
      endLocal = new Date(anchorLocal);
      endLocal.setUTCDate(endLocal.getUTCDate() + 1);
      break;
    case "week-days": {
      // Semana ISO · lunes a domingo
      const dow = (anchorLocal.getUTCDay() + 6) % 7;
      startLocal = new Date(anchorLocal);
      startLocal.setUTCDate(startLocal.getUTCDate() - dow);
      endLocal = new Date(startLocal);
      endLocal.setUTCDate(endLocal.getUTCDate() + 7);
      break;
    }
    case "month-days":
      startLocal = new Date(
        Date.UTC(anchorLocal.getUTCFullYear(), anchorLocal.getUTCMonth(), 1),
      );
      endLocal = new Date(
        Date.UTC(anchorLocal.getUTCFullYear(), anchorLocal.getUTCMonth() + 1, 1),
      );
      break;
    case "year-weeks":
    case "year-months":
      startLocal = new Date(Date.UTC(anchorLocal.getUTCFullYear(), 0, 1));
      endLocal = new Date(Date.UTC(anchorLocal.getUTCFullYear() + 1, 0, 1));
      break;
  }

  // Convertir AR-local → UTC
  return {
    startUtc: new Date(startLocal.getTime() + AR_OFFSET_MS),
    endUtc: new Date(endLocal.getTime() + AR_OFFSET_MS),
  };
}

export async function getAssetDayMapInRange(
  assetId: string,
  granularity: AnalysisGranularity,
  anchorIso: string,
): Promise<AssetDayMap | null> {
  const { startUtc, endUtc } = computePeriodRange(granularity, anchorIso);

  // Encontrar la última posición DENTRO del rango · ese day es el
  // que vamos a renderizar. Si no hay nada en el rango, no hay mapa.
  const lastInRange = await db.position.findFirst({
    where: {
      assetId,
      recordedAt: { gte: startUtc, lt: endUtc },
    },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });

  if (!lastInRange) {
    return null;
  }

  // Day del último ping en AR-local
  const dayIso = ymdAr(lastInRange.recordedAt.getTime());
  const [yy, mm, dd] = dayIso.split("-").map(Number);

  // Rango del día específico · día completo en AR-local
  const dayStartLocal = new Date(Date.UTC(yy!, (mm ?? 1) - 1, dd ?? 1));
  const dayStartUtc = new Date(dayStartLocal.getTime() + AR_OFFSET_MS);
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  // Cargar todos los puntos del día
  const points = await db.position.findMany({
    where: {
      assetId,
      recordedAt: { gte: dayStartUtc, lt: dayEndUtc },
    },
    orderBy: { recordedAt: "asc" },
    select: {
      lat: true,
      lng: true,
      speedKmh: true,
      ignition: true,
      heading: true,
      recordedAt: true,
    },
  });

  if (points.length === 0) {
    return null;
  }

  // Stats del día · igual que el loader original
  let distanceKm = 0;
  let activeMinutes = 0;
  let maxSpeedKmh = 0;
  let tripCount = 0;
  let inTrip = false;

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (p.speedKmh > maxSpeedKmh) maxSpeedKmh = Math.round(p.speedKmh);
    if (i > 0) {
      const prev = points[i - 1]!;
      distanceKm += haversineKm(prev.lat, prev.lng, p.lat, p.lng);
      const dtMin = (p.recordedAt.getTime() - prev.recordedAt.getTime()) / 60000;
      if (p.ignition && dtMin < 5) activeMinutes += dtMin;
    }
    // Trip simple · cada vez que ignición pasa de off→on
    if (p.ignition && !inTrip) {
      tripCount++;
      inTrip = true;
    } else if (!p.ignition && inTrip) {
      inTrip = false;
    }
  }

  const last = points[points.length - 1]!;

  // Es "hoy" en AR-local
  const todayIso = ymdAr(Date.now());
  const isToday = dayIso === todayIso;

  return {
    dateISO: dayIso,
    isToday,
    points: points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      speedKmh: p.speedKmh,
      ignition: p.ignition,
      recordedAt: p.recordedAt,
    })),
    lastPosition: {
      lat: last.lat,
      lng: last.lng,
      speedKmh: last.speedKmh,
      heading: last.heading ?? 0,
      ignition: last.ignition,
      recordedAt: last.recordedAt,
    },
    stats: {
      pointCount: points.length,
      distanceKm: Math.round(distanceKm * 10) / 10,
      activeMinutes: Math.round(activeMinutes),
      tripCount,
      maxSpeedKmh,
      firstAt: points[0]!.recordedAt,
      lastAt: last.recordedAt,
    },
  };
}
