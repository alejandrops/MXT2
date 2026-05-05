// @ts-nocheck · pre-existing patterns (Prisma types stale, leaflet.heat sin types)
// ═══════════════════════════════════════════════════════════════
//  events-list · S4-L2 · listado cross-fleet de eventos
//  ─────────────────────────────────────────────────────────────
//  Listado tabular de Events del enterprise, con filtros:
//    · rango de fechas (granularity + anchor del PeriodNavigator)
//    · multi-select tipos
//    · multi-select severidades
//    · multi-select vehículos
//    · multi-select grupos
//    · multi-select conductores
//    · search (libre · matchea contra plate, name, type)
//
//  Diferente de listEventsByAsset · que es per-vehículo y solo paginado.
//  Esta query alimenta la pantalla nueva /actividad/eventos.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { EventType, Severity } from "@/types/domain";
import type { Prisma } from "@prisma/client";

export interface ListEventsParams {
  /** Rango UTC */
  startUtc: Date;
  endUtc: Date;
  /** Filtros */
  types?: EventType[];
  severities?: Severity[];
  assetIds?: string[];
  groupIds?: string[];
  personIds?: string[];
  search?: string;
  /** Multi-tenant scope */
  accountId?: string | null;
  /** Paginación */
  page?: number;
  pageSize?: number;
  /** Para vista heatmap · necesitamos todos los puntos sin paginar */
  noPagination?: boolean;
}

export interface EventListRow {
  id: string;
  type: EventType;
  severity: Severity;
  occurredAt: Date;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  metadata: string | null;
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  personId: string | null;
  personName: string | null;
}

export interface ListEventsResult {
  rows: EventListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listEvents(
  params: ListEventsParams,
): Promise<ListEventsResult> {
  const {
    startUtc,
    endUtc,
    types,
    severities,
    assetIds,
    groupIds,
    personIds,
    search,
    accountId,
    page = 1,
    pageSize = 50,
    noPagination = false,
  } = params;

  // Resolver assetIds finales · combina filter directo + assets de los grupos
  let resolvedAssetIds: string[] | null = null;
  if (assetIds && assetIds.length > 0) {
    resolvedAssetIds = assetIds.slice();
  }
  if (groupIds && groupIds.length > 0) {
    const assetsInGroups = await db.asset.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true },
    });
    const groupAssetIds = assetsInGroups.map((a) => a.id);
    resolvedAssetIds =
      resolvedAssetIds === null
        ? groupAssetIds
        : Array.from(new Set([...resolvedAssetIds, ...groupAssetIds]));
  }

  const where: Prisma.EventWhereInput = {
    occurredAt: { gte: startUtc, lte: endUtc },
    ...(types && types.length > 0 ? { type: { in: types } } : {}),
    ...(severities && severities.length > 0
      ? { severity: { in: severities } }
      : {}),
    ...(resolvedAssetIds !== null
      ? { assetId: { in: resolvedAssetIds } }
      : {}),
    ...(personIds && personIds.length > 0
      ? { personId: { in: personIds } }
      : {}),
    // Multi-tenant scope · vía Asset.accountId
    ...(accountId ? { asset: { accountId } } : {}),
    // Search · matchea contra Asset.plate, Asset.name, Person fullName
    ...(search && search.length > 0
      ? {
          OR: [
            { asset: { plate: { contains: search, mode: "insensitive" } } },
            { asset: { name: { contains: search, mode: "insensitive" } } },
            {
              person: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      ...(noPagination
        ? {}
        : { skip: (page - 1) * pageSize, take: pageSize }),
      include: {
        asset: {
          select: { id: true, name: true, plate: true },
        },
        person: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);

  const rows: EventListRow[] = items.map((e) => ({
    id: e.id,
    type: e.type,
    severity: e.severity,
    occurredAt: e.occurredAt,
    lat: e.lat,
    lng: e.lng,
    speedKmh: e.speedKmh,
    metadata: e.metadata,
    assetId: e.assetId,
    assetName: e.asset.name,
    assetPlate: e.asset.plate,
    personId: e.personId,
    personName: e.person
      ? `${e.person.firstName} ${e.person.lastName}`.trim()
      : null,
  }));

  return {
    rows,
    total,
    page: noPagination ? 1 : page,
    pageSize: noPagination ? total : pageSize,
    pageCount: noPagination ? 1 : Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Versión optimizada para heatmap · solo lat/lng/type · todos los rows
 * sin paginación. NO incluye joins de asset/person · solo lo que necesita
 * el mapa.
 */
export interface EventHeatPoint {
  lat: number;
  lng: number;
  type: EventType;
  severity: Severity;
}

export async function listEventsForHeatmap(
  params: ListEventsParams,
): Promise<EventHeatPoint[]> {
  const {
    startUtc,
    endUtc,
    types,
    severities,
    assetIds,
    groupIds,
    personIds,
    search,
    accountId,
  } = params;

  let resolvedAssetIds: string[] | null = null;
  if (assetIds && assetIds.length > 0) {
    resolvedAssetIds = assetIds.slice();
  }
  if (groupIds && groupIds.length > 0) {
    const assetsInGroups = await db.asset.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true },
    });
    const groupAssetIds = assetsInGroups.map((a) => a.id);
    resolvedAssetIds =
      resolvedAssetIds === null
        ? groupAssetIds
        : Array.from(new Set([...resolvedAssetIds, ...groupAssetIds]));
  }

  const where: Prisma.EventWhereInput = {
    occurredAt: { gte: startUtc, lte: endUtc },
    // Solo eventos con coordenadas
    lat: { not: null },
    lng: { not: null },
    ...(types && types.length > 0 ? { type: { in: types } } : {}),
    ...(severities && severities.length > 0
      ? { severity: { in: severities } }
      : {}),
    ...(resolvedAssetIds !== null
      ? { assetId: { in: resolvedAssetIds } }
      : {}),
    ...(personIds && personIds.length > 0
      ? { personId: { in: personIds } }
      : {}),
    ...(accountId ? { asset: { accountId } } : {}),
    ...(search && search.length > 0
      ? {
          OR: [
            { asset: { plate: { contains: search, mode: "insensitive" } } },
            { asset: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const events = await db.event.findMany({
    where,
    select: { lat: true, lng: true, type: true, severity: true },
    // Cap defensivo · 10k puntos = limit razonable para Leaflet
    take: 10000,
  });

  return events
    .filter((e) => e.lat !== null && e.lng !== null)
    .map((e) => ({
      lat: e.lat as number,
      lng: e.lng as number,
      type: e.type,
      severity: e.severity,
    }));
}
