// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";
import type { EventType, Severity } from "@/types/domain";

// ═══════════════════════════════════════════════════════════════
//  Trip detail · S5-T4
//  ─────────────────────────────────────────────────────────────
//  Devuelve los datos completos de un trip individual para
//  alimentar el recibo de viaje: trip + vehículo + conductor +
//  eventos ocurridos durante el trip (entre startedAt y endedAt).
//
//  Multi-tenant · si accountId está dado, restringe al asset
//  del account. Devuelve null si no existe o no pertenece.
// ═══════════════════════════════════════════════════════════════

export interface TripDetail {
  id: string;
  startedAt: Date;
  startedAtIso: string;
  endedAt: Date;
  endedAtIso: string;
  durationMs: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  idleMs: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  polylineJson: string;
  positionCount: number;

  // Asset
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  vehicleType: string;

  // Person (puede ser null)
  personId: string | null;
  personName: string | null;

  // Eventos del trip (resumen breve para el recibo)
  events: TripEventItem[];
  eventCount: number;
  highSeverityEventCount: number;
}

export interface TripEventItem {
  id: string;
  type: EventType;
  severity: Severity;
  occurredAt: Date;
  occurredAtIso: string;
  speedKmh: number | null;
  lat: number | null;
  lng: number | null;
}

export async function getTripById(
  tripId: string,
  accountId: string | null,
): Promise<TripDetail | null> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      asset: {
        select: {
          id: true,
          name: true,
          plate: true,
          vehicleType: true,
          accountId: true,
        },
      },
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!trip) return null;

  // Multi-tenant scope · si hay accountId, asegurar que el asset
  // pertenezca a esa cuenta
  if (accountId && trip.asset.accountId !== accountId) {
    return null;
  }

  // Eventos durante el trip · mismo asset, occurredAt en [startedAt, endedAt]
  const events = await db.event.findMany({
    where: {
      assetId: trip.assetId,
      occurredAt: {
        gte: trip.startedAt,
        lte: trip.endedAt,
      },
      // Excluir IGNITION_ON/IGNITION_OFF · son señales de operación,
      // no eventos de conducción/seguridad
      type: { notIn: ["IGNITION_ON", "IGNITION_OFF"] },
    },
    select: {
      id: true,
      type: true,
      severity: true,
      occurredAt: true,
      speedKmh: true,
      lat: true,
      lng: true,
    },
    orderBy: { occurredAt: "asc" },
  });

  const personName = trip.person
    ? `${trip.person.firstName} ${trip.person.lastName}`.trim()
    : null;

  return {
    id: trip.id,
    startedAt: trip.startedAt,
    startedAtIso: trip.startedAt.toISOString(),
    endedAt: trip.endedAt,
    endedAtIso: trip.endedAt.toISOString(),
    durationMs: trip.durationMs,
    distanceKm: trip.distanceKm,
    avgSpeedKmh: trip.avgSpeedKmh,
    maxSpeedKmh: trip.maxSpeedKmh,
    idleMs: trip.idleMs,
    startLat: trip.startLat,
    startLng: trip.startLng,
    endLat: trip.endLat,
    endLng: trip.endLng,
    polylineJson: trip.polylineJson,
    positionCount: trip.positionCount,

    assetId: trip.asset.id,
    assetName: trip.asset.name,
    assetPlate: trip.asset.plate,
    vehicleType: trip.asset.vehicleType,

    personId: trip.person?.id ?? null,
    personName,

    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      occurredAt: e.occurredAt,
      occurredAtIso: e.occurredAt.toISOString(),
      speedKmh: e.speedKmh,
      lat: e.lat,
      lng: e.lng,
    })),
    eventCount: events.length,
    highSeverityEventCount: events.filter(
      (e) => e.severity === "HIGH" || e.severity === "CRITICAL",
    ).length,
  };
}
