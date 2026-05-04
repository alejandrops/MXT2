// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";
import { DRIVING_BEHAVIOR_EVENT_TYPES } from "@/lib/event-types";

// ═══════════════════════════════════════════════════════════════
//  getGroupPeers · S1-L4b posición-en-grupo
//  ─────────────────────────────────────────────────────────────
//  Devuelve los assets del mismo grupo del asset activo, con
//  métricas comparables del período · alimenta el scatter
//  "Posición en el grupo" del Libro del vehículo.
//
//  Comportamiento:
//    · Si el asset no tiene group · devuelve null (sin scatter)
//    · Si está en un grupo de 1 asset (solo él) · devuelve null
//    · Si hay 2+ peers · devuelve array completo con el activo incluido
//
//  Métricas calculadas por asset:
//    · distanceKm, activeMin, tripCount       (de AssetDriverDay)
//    · eventCount                              (de Event con type telemetría)
//    · eventsPer100km                          (derivado · safety proxy)
//    · safetyScore                             (proxy · 100 - eventsPer100km*K)
// ═══════════════════════════════════════════════════════════════

export interface GroupPeer {
  id: string;
  name: string;
  plate: string | null;
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
  eventsPer100km: number;
  safetyScore: number;
}

export interface GroupPeersResult {
  groupId: string;
  groupName: string;
  activeId: string;
  peers: GroupPeer[];
}

export async function getGroupPeers(
  assetId: string,
  fromDate: string,
  toDate: string,
): Promise<GroupPeersResult | null> {
  // 1 · Resolver el grupo del asset
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      groupId: true,
      group: { select: { id: true, name: true } },
    },
  });
  if (!asset?.groupId || !asset.group) return null;
  const groupId = asset.groupId;

  // 2 · Listar todos los assets del grupo
  const groupAssets = await db.asset.findMany({
    where: { groupId },
    select: {
      id: true,
      name: true,
      plate: true,
    },
    orderBy: { name: "asc" },
  });
  if (groupAssets.length < 2) return null;

  // 3 · Métricas del período · AssetDriverDay agregado por asset
  const fromDt = new Date(`${fromDate}T03:00:00Z`);
  const toDt = new Date(`${toDate}T03:00:00Z`);
  toDt.setUTCDate(toDt.getUTCDate() + 1);

  const groupAssetIds = groupAssets.map((a) => a.id);

  const [days, events] = await Promise.all([
    db.assetDriverDay.findMany({
      where: {
        assetId: { in: groupAssetIds },
        day: { gte: fromDt, lt: toDt },
      },
      select: {
        assetId: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
      },
    }),
    db.event.findMany({
      where: {
        assetId: { in: groupAssetIds },
        occurredAt: { gte: fromDt, lt: toDt },
        type: { in: DRIVING_BEHAVIOR_EVENT_TYPES },
      },
      select: { assetId: true },
    }),
  ]);

  // 4 · Agregar por asset
  const totals = new Map<
    string,
    { distanceKm: number; activeMin: number; tripCount: number; eventCount: number }
  >();
  for (const a of groupAssets) {
    totals.set(a.id, {
      distanceKm: 0,
      activeMin: 0,
      tripCount: 0,
      eventCount: 0,
    });
  }
  for (const d of days) {
    const t = totals.get(d.assetId);
    if (!t) continue;
    t.distanceKm += d.distanceKm;
    t.activeMin += d.activeMin;
    t.tripCount += d.tripCount;
  }
  for (const e of events) {
    const t = totals.get(e.assetId);
    if (!t) continue;
    t.eventCount += 1;
  }

  // 5 · Proyectar como GroupPeer[]
  const peers: GroupPeer[] = groupAssets.map((a) => {
    const t = totals.get(a.id)!;
    const eventsPer100km =
      t.distanceKm > 0 ? (t.eventCount / t.distanceKm) * 100 : 0;
    // Safety score proxy · 100 sin eventos, baja con frecuencia.
    // Calibrado para que >5 eventos cada 100 km lleve a < 60.
    const safetyScore = Math.max(0, Math.round(100 - eventsPer100km * 10));
    return {
      id: a.id,
      name: a.name,
      plate: a.plate,
      distanceKm: Math.round(t.distanceKm * 10) / 10,
      activeMin: t.activeMin,
      tripCount: t.tripCount,
      eventCount: t.eventCount,
      eventsPer100km: Math.round(eventsPer100km * 100) / 100,
      safetyScore,
    };
  });

  return {
    groupId,
    groupName: asset.group.name,
    activeId: assetId,
    peers,
  };
}
