// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  getPersonAssets · S3-L1
//  ─────────────────────────────────────────────────────────────
//  Vehículos manejados por una persona en los últimos 30 días.
//  Agrupado por assetId · totales km/viajes/días + flag isCurrent
//  (si el asset apunta a este personId como currentDriverId).
//
//  Usado por SummaryBookTab cuando type === "conductor".
// ═══════════════════════════════════════════════════════════════

export interface PersonAssetRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  /** Asignado actualmente como currentDriver del asset */
  isCurrent: boolean;
  totalKm: number;
  totalTrips: number;
  totalDays: number;
}

export async function getPersonAssets(
  personId: string,
): Promise<PersonAssetRow[]> {
  const fromDt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const days = await db.assetDriverDay.findMany({
    where: {
      personId,
      day: { gte: fromDt },
    },
    select: {
      assetId: true,
      day: true,
      distanceKm: true,
      tripCount: true,
      asset: {
        select: {
          id: true,
          name: true,
          plate: true,
          currentDriverId: true,
        },
      },
    },
  });

  if (days.length === 0) return [];

  // Bucket por assetId
  const buckets = new Map<
    string,
    {
      assetId: string;
      assetName: string;
      assetPlate: string | null;
      isCurrent: boolean;
      totalKm: number;
      totalTrips: number;
      days: Set<string>;
    }
  >();

  for (const d of days) {
    const dayKey = d.day.toISOString().slice(0, 10);
    const existing = buckets.get(d.assetId);
    if (existing) {
      existing.totalKm += d.distanceKm;
      existing.totalTrips += d.tripCount;
      existing.days.add(dayKey);
    } else {
      buckets.set(d.assetId, {
        assetId: d.assetId,
        assetName: d.asset.name,
        assetPlate: d.asset.plate,
        isCurrent: d.asset.currentDriverId === personId,
        totalKm: d.distanceKm,
        totalTrips: d.tripCount,
        days: new Set([dayKey]),
      });
    }
  }

  return Array.from(buckets.values()).map((b) => ({
    assetId: b.assetId,
    assetName: b.assetName,
    assetPlate: b.assetPlate,
    isCurrent: b.isCurrent,
    totalKm: Math.round(b.totalKm * 10) / 10,
    totalTrips: b.totalTrips,
    totalDays: b.days.size,
  }));
}
