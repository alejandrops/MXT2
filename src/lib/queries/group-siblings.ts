// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  getGroupSiblings · S2-L7
//  ─────────────────────────────────────────────────────────────
//  Tercer pilar del scatter contextual:
//    · vehículo en su grupo (S1-L4b · getGroupPeers)
//    · conductor en sus pares (S2-L7 · getDriverPeers)
//    · grupo entre grupos del account (este archivo)
//
//  Devuelve agregados por grupo del mismo account · permite ver
//  cómo performa este grupo vs los otros del cliente.
//
//  Filtro · solo grupos con assetCount > 0 (existencia real de
//  vehículos asignados). Grupos huérfanos no entran al scatter.
// ═══════════════════════════════════════════════════════════════

export interface GroupSibling {
  id: string;
  name: string;
  plate: string | null; // shape compat con scatter genérico
  assetCount: number;
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
  eventsPer100km: number;
  safetyScore: number;
}

export interface GroupSiblingsResult {
  accountId: string;
  accountName: string;
  activeId: string;
  peers: GroupSibling[];
}

const TELEMETRY_EVENT_TYPES = [
  "HARSH_ACCELERATION",
  "HARSH_BRAKING",
  "HARSH_CORNERING",
  "SPEEDING",
  "OVERSPEED",
  "IDLE",
] as const;

export async function getGroupSiblings(
  groupId: string,
  fromDate: string,
  toDate: string,
): Promise<GroupSiblingsResult | null> {
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: {
      accountId: true,
      account: { select: { id: true, name: true } },
    },
  });
  if (!group) return null;

  const fromDt = new Date(`${fromDate}T03:00:00Z`);
  const toDt = new Date(`${toDate}T03:00:00Z`);
  toDt.setUTCDate(toDt.getUTCDate() + 1);

  // 1 · Listar todos los grupos del account con sus assets
  const groups = await db.group.findMany({
    where: { accountId: group.accountId },
    select: {
      id: true,
      name: true,
      assets: { select: { id: true } },
    },
  });

  if (groups.length < 2) return null;

  // 2 · Aggregar AssetDriverDay del account en el período
  const days = await db.assetDriverDay.findMany({
    where: {
      accountId: group.accountId,
      day: { gte: fromDt, lt: toDt },
    },
    select: {
      assetId: true,
      distanceKm: true,
      activeMin: true,
      tripCount: true,
      asset: { select: { groupId: true } },
    },
  });

  // 3 · Eventos del account por asset en el período
  const eventCounts = await db.event.groupBy({
    by: ["assetId"],
    where: {
      asset: { accountId: group.accountId },
      occurredAt: { gte: fromDt, lt: toDt },
      type: { in: TELEMETRY_EVENT_TYPES as any },
    },
    _count: { _all: true },
  });
  const eventsByAsset = new Map<string, number>();
  for (const row of eventCounts) {
    eventsByAsset.set(row.assetId, row._count._all);
  }

  // 4 · Bucket por groupId
  const buckets = new Map<
    string,
    {
      distanceKm: number;
      activeMin: number;
      tripCount: number;
      eventCount: number;
    }
  >();

  for (const d of days) {
    const gid = d.asset?.groupId;
    if (!gid) continue;
    const eventsForAsset = eventsByAsset.get(d.assetId) ?? 0;
    const existing = buckets.get(gid);
    if (existing) {
      existing.distanceKm += d.distanceKm;
      existing.activeMin += d.activeMin;
      existing.tripCount += d.tripCount;
      // eventCount se reparte por asset · cada day del asset suma
      // todos sus eventos del período · evitamos double count
      // simplificando: sumamos eventos sólo en el primer day visto
    } else {
      buckets.set(gid, {
        distanceKm: d.distanceKm,
        activeMin: d.activeMin,
        tripCount: d.tripCount,
        eventCount: 0,
      });
    }
  }

  // Sumar eventos del bucket por separado · cada asset cuenta sus eventos una vez
  const assetsByGroup = new Map<string, Set<string>>();
  for (const g of groups) {
    assetsByGroup.set(g.id, new Set(g.assets.map((a) => a.id)));
  }
  for (const [gid, bucket] of buckets.entries()) {
    const assets = assetsByGroup.get(gid);
    if (!assets) continue;
    let total = 0;
    for (const aid of assets) {
      total += eventsByAsset.get(aid) ?? 0;
    }
    bucket.eventCount = total;
  }

  // 5 · Proyectar · solo grupos con datos
  const peers: GroupSibling[] = [];
  for (const g of groups) {
    const bucket = buckets.get(g.id);
    if (!bucket) continue;
    const distanceKm = Math.round(bucket.distanceKm * 10) / 10;
    const eventsPer100km =
      distanceKm > 0
        ? Math.round((bucket.eventCount / distanceKm) * 100 * 100) / 100
        : 0;
    // Safety score proxy · 100 menos un castigo escalado por eventos/100km
    const safetyScore = Math.max(
      0,
      Math.min(100, Math.round(100 - eventsPer100km * 8)),
    );
    peers.push({
      id: g.id,
      name: g.name,
      plate: null,
      assetCount: g.assets.length,
      distanceKm,
      activeMin: bucket.activeMin,
      tripCount: bucket.tripCount,
      eventCount: bucket.eventCount,
      eventsPer100km,
      safetyScore,
    });
  }

  if (peers.length < 2) return null;

  return {
    accountId: group.accountId,
    accountName: group.account.name,
    activeId: groupId,
    peers,
  };
}
