// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  getDriverMonthSummary · S3-L1
//  ─────────────────────────────────────────────────────────────
//  Resumen de los últimos 30 días para el conductor del Libro.
//  Análogo a getAssetMonthSummary pero agrega por personId.
//
//  Usado por SummaryBookTab cuando type === "conductor".
// ═══════════════════════════════════════════════════════════════

const DRIVING_BEHAVIOR_EVENTS = [
  "HARSH_ACCELERATION",
  "HARSH_BRAKING",
  "HARSH_CORNERING",
  "SPEEDING",
  "IDLING",
] as const;

export interface DriverMonthSummary {
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
  /** Días con actividad en el período · proxy de utilización */
  activeDays: number;
  /** Vehículos distintos manejados en el período */
  uniqueAssetsCount: number;
}

export async function getDriverMonthSummary(
  personId: string,
): Promise<DriverMonthSummary> {
  const now = new Date();
  const fromDt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [days, eventCount] = await Promise.all([
    db.assetDriverDay.findMany({
      where: { personId, day: { gte: fromDt } },
      select: {
        distanceKm: true,
        activeMin: true,
        tripCount: true,
        assetId: true,
        day: true,
      },
    }),
    db.event.count({
      where: {
        personId,
        occurredAt: { gte: fromDt },
        type: { in: DRIVING_BEHAVIOR_EVENTS as any },
      },
    }),
  ]);

  const distanceKm =
    Math.round(days.reduce((acc, d) => acc + d.distanceKm, 0) * 10) / 10;
  const activeMin = days.reduce((acc, d) => acc + d.activeMin, 0);
  const tripCount = days.reduce((acc, d) => acc + d.tripCount, 0);
  const uniqueAssetsCount = new Set(days.map((d) => d.assetId)).size;
  const activeDays = new Set(
    days.map((d) => d.day.toISOString().slice(0, 10)),
  ).size;

  return {
    distanceKm,
    activeMin,
    tripCount,
    eventCount,
    activeDays,
    uniqueAssetsCount,
  };
}
