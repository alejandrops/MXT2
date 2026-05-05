// @ts-nocheck · Prisma client types stale en sandbox · valida en máquina con prisma generate
// ═══════════════════════════════════════════════════════════════
//  Conducción · listInfractions / listInfractionsForHeatmap
//  ─────────────────────────────────────────────────────────────
//  Listado paginado con filtros para la pantalla
//  /conduccion/infracciones (S4-L3c). Sigue el patrón de
//  events-list.ts.
//
//  Filtros soportados:
//    · severities  · LEVE | MEDIA | GRAVE
//    · groupIds    · grupos del scope (vía asset.groupId)
//    · vehicleTypes· tipos de vehículo
//    · personIds   · conductores específicos
//    · search      · búsqueda libre en nombre/patente del vehículo
//                    o nombre del conductor
//    · status      · ACTIVE (default) o ALL para auditoría
//
//  Multi-tenant scope · accountId obligatorio cuando se invoca
//  desde la UI (lo resuelve el page server-side con session).
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type InfractionSeverityFilter = "LEVE" | "MEDIA" | "GRAVE";

export interface ListInfractionsParams {
  /** Rango UTC */
  startUtc: Date;
  endUtc: Date;
  /** Filtros */
  severities?: InfractionSeverityFilter[];
  groupIds?: string[];
  vehicleTypes?: string[];
  personIds?: string[];
  search?: string;
  /** Multi-tenant scope */
  accountId?: string | null;
  /** Status · default ACTIVE (las DISCARDED quedan ocultas en MVP) */
  includeDiscarded?: boolean;
  /** Paginación */
  page?: number;
  pageSize?: number;
}

export interface InfractionListRow {
  id: string;
  severity: InfractionSeverityFilter;
  startedAt: Date;
  endedAt: Date;
  durationSec: number;
  vmaxKmh: number;
  peakSpeedKmh: number;
  maxExcessKmh: number;
  distanceMeters: number;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  startAddress: string | null;
  endAddress: string | null;
  vehicleType: string;
  roadType: string;
  trackJson: string;
  status: "ACTIVE" | "DISCARDED";
  discardReason: string | null;
  discardedAt: Date | null;
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  personId: string | null;
  personName: string | null;
}

export interface ListInfractionsResult {
  rows: InfractionListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function buildWhere(params: ListInfractionsParams): Prisma.InfractionWhereInput {
  const where: Prisma.InfractionWhereInput = {
    startedAt: { gte: params.startUtc, lte: params.endUtc },
  };

  if (!params.includeDiscarded) {
    where.status = "ACTIVE";
  }

  if (params.accountId !== undefined && params.accountId !== null) {
    where.accountId = params.accountId;
  }

  if (params.severities && params.severities.length > 0) {
    where.severity = { in: params.severities };
  }

  // Filtros vía la relación con Asset
  const assetWhere: Prisma.AssetWhereInput = {};
  if (params.groupIds && params.groupIds.length > 0) {
    assetWhere.groupId = { in: params.groupIds };
  }
  if (params.vehicleTypes && params.vehicleTypes.length > 0) {
    assetWhere.vehicleType = { in: params.vehicleTypes as any };
  }
  if (Object.keys(assetWhere).length > 0) {
    where.asset = assetWhere;
  }

  // Conductor específico
  if (params.personIds && params.personIds.length > 0) {
    where.driverId = { in: params.personIds };
  }

  // Búsqueda libre · nombre o patente del vehículo, nombre del conductor
  if (params.search && params.search.trim().length > 0) {
    const q = params.search.trim();
    where.OR = [
      { asset: { name: { contains: q, mode: "insensitive" } } },
      { asset: { plate: { contains: q, mode: "insensitive" } } },
      { driver: { firstName: { contains: q, mode: "insensitive" } } },
      { driver: { lastName: { contains: q, mode: "insensitive" } } },
    ];
  }

  return where;
}

export async function listInfractions(
  params: ListInfractionsParams,
): Promise<ListInfractionsResult> {
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
  const where = buildWhere(params);

  const [rows, total] = await Promise.all([
    db.infraction.findMany({
      where,
      orderBy: [
        // GRAVE → MEDIA → LEVE (Postgres ordena enum por orden de
        // declaración · GRAVE es el último → desc lo trae primero)
        { severity: "desc" },
        { startedAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        severity: true,
        startedAt: true,
        endedAt: true,
        durationSec: true,
        vmaxKmh: true,
        peakSpeedKmh: true,
        maxExcessKmh: true,
        distanceMeters: true,
        startLat: true,
        startLon: true,
        endLat: true,
        endLon: true,
        startAddress: true,
        endAddress: true,
        vehicleType: true,
        roadType: true,
        trackJson: true,
        status: true,
        discardReason: true,
        discardedAt: true,
        assetId: true,
        driverId: true,
        asset: { select: { name: true, plate: true } },
        driver: { select: { firstName: true, lastName: true } },
      },
    }),
    db.infraction.count({ where }),
  ]);

  const mapped: InfractionListRow[] = rows.map((r) => ({
    id: r.id,
    severity: r.severity,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    durationSec: r.durationSec,
    vmaxKmh: r.vmaxKmh,
    peakSpeedKmh: r.peakSpeedKmh,
    maxExcessKmh: r.maxExcessKmh,
    distanceMeters: r.distanceMeters,
    startLat: r.startLat,
    startLon: r.startLon,
    endLat: r.endLat,
    endLon: r.endLon,
    startAddress: r.startAddress,
    endAddress: r.endAddress,
    vehicleType: r.vehicleType,
    roadType: r.roadType,
    trackJson: r.trackJson,
    status: r.status,
    discardReason: r.discardReason,
    discardedAt: r.discardedAt,
    assetId: r.assetId,
    assetName: r.asset.name,
    assetPlate: r.asset.plate,
    personId: r.driverId,
    personName: r.driver
      ? `${r.driver.firstName ?? ""} ${r.driver.lastName ?? ""}`.trim()
      : null,
  }));

  return {
    rows: mapped,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ═══════════════════════════════════════════════════════════════
//  listInfractionsForHeatmap · todos los puntos sin paginar
//  ─────────────────────────────────────────────────────────────
//  Solo trae lo que el heatmap necesita · lat/lng inicio +
//  severity. Para no transferir miles de track JSONs.
// ═══════════════════════════════════════════════════════════════

export interface InfractionHeatPoint {
  id: string;
  lat: number;
  lng: number;
  severity: InfractionSeverityFilter;
}

export async function listInfractionsForHeatmap(
  params: Omit<ListInfractionsParams, "page" | "pageSize">,
): Promise<InfractionHeatPoint[]> {
  const where = buildWhere({ ...params, page: undefined, pageSize: undefined });

  const rows = await db.infraction.findMany({
    where,
    select: {
      id: true,
      severity: true,
      startLat: true,
      startLon: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    lat: r.startLat,
    lng: r.startLon,
    severity: r.severity,
  }));
}

// ═══════════════════════════════════════════════════════════════
//  getInfractionById · S4-L3d
//  ─────────────────────────────────────────────────────────────
//  Fetcher de una infracción individual con todos los detalles
//  necesarios para el recibo PDF imprimible. Incluye el operador
//  que la descartó (si aplica · necesario para el footer del
//  recibo "Descartado por X el Y").
//
//  Multi-tenant · si se pasa accountId no-null, garantiza que
//  la infracción pertenece a esa cuenta · si no coincide
//  devuelve null (efectivamente "no encontrada" para el caller).
// ═══════════════════════════════════════════════════════════════

export interface InfractionDetail extends InfractionListRow {
  startedAtIso: string;
  endedAtIso: string;
  discardedByName: string | null;
}

export async function getInfractionById(
  id: string,
  accountId?: string | null,
): Promise<InfractionDetail | null> {
  const r = await db.infraction.findUnique({
    where: { id },
    select: {
      id: true,
      severity: true,
      startedAt: true,
      endedAt: true,
      durationSec: true,
      vmaxKmh: true,
      peakSpeedKmh: true,
      maxExcessKmh: true,
      distanceMeters: true,
      startLat: true,
      startLon: true,
      endLat: true,
      endLon: true,
      startAddress: true,
      endAddress: true,
      vehicleType: true,
      roadType: true,
      trackJson: true,
      status: true,
      discardReason: true,
      discardedAt: true,
      discardedById: true,
      accountId: true,
      assetId: true,
      driverId: true,
      asset: { select: { name: true, plate: true } },
      driver: { select: { firstName: true, lastName: true } },
    },
  });

  if (!r) return null;
  if (accountId !== undefined && accountId !== null && r.accountId !== accountId) {
    return null;
  }

  // Si está descartada, traer el nombre del usuario que la descartó
  let discardedByName: string | null = null;
  if (r.discardedById) {
    const u = await db.user.findUnique({
      where: { id: r.discardedById },
      select: { firstName: true, lastName: true },
    });
    if (u) {
      discardedByName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || null;
    }
  }

  return {
    id: r.id,
    severity: r.severity,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    startedAtIso: r.startedAt.toISOString(),
    endedAtIso: r.endedAt.toISOString(),
    durationSec: r.durationSec,
    vmaxKmh: r.vmaxKmh,
    peakSpeedKmh: r.peakSpeedKmh,
    maxExcessKmh: r.maxExcessKmh,
    distanceMeters: r.distanceMeters,
    startLat: r.startLat,
    startLon: r.startLon,
    endLat: r.endLat,
    endLon: r.endLon,
    startAddress: r.startAddress,
    endAddress: r.endAddress,
    vehicleType: r.vehicleType,
    roadType: r.roadType,
    trackJson: r.trackJson,
    status: r.status,
    discardReason: r.discardReason,
    discardedAt: r.discardedAt,
    assetId: r.assetId,
    assetName: r.asset.name,
    assetPlate: r.asset.plate,
    personId: r.driverId,
    personName: r.driver
      ? `${r.driver.firstName ?? ""} ${r.driver.lastName ?? ""}`.trim()
      : null,
    discardedByName,
  };
}
