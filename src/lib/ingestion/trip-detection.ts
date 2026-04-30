import { db } from "@/lib/db";
import { haversineKm, decimate } from "./geo";

// ═══════════════════════════════════════════════════════════════
//  Trip detection (I3)
//  ─────────────────────────────────────────────────────────────
//  Estrategia: "cierre por cambio de ignición".
//
//  Cuando llega una position para un asset, después de persistir,
//  revisamos su LivePosition. Si está en ignition=false, buscamos
//  hacia atrás en el tiempo el último bloque contiguo de positions
//  con ignition=true (desde el último Trip cerrado o desde el
//  origen). Si ese bloque cumple los criterios mínimos (puntos,
//  duración, distancia), creamos un Trip cerrado.
//
//  Por qué inline en el endpoint y no async:
//   · v1 tiene volumen modesto (100 vehículos)
//   · evita complejidad de jobs / colas
//   · si se vuelve cuello de botella, se puede mover a worker
//     después leyendo `LivePosition` y operando idénticamente.
//
//  Por qué cierre solo (sin abrir trip explícito):
//   · El "trip abierto" es implícito · existe siempre que hay
//     positions con ignition=true posteriores al último Trip.
//   · UI futura puede consultar LivePosition + Trip último y
//     calcular "trip en curso" sin necesidad de tabla extra.
//
//  Filtros mínimos para evitar artefactos GPS:
//   · ≥ 2 puntos
//   · duración ≥ 60 segundos
//   · distancia ≥ 50 metros
//
//  Si una de esas condiciones no se cumple, descartamos · el bloque
//  de ignition=true se considera "stand-by con ruido" y no se crea
//  Trip. Las positions quedan en la tabla Position igualmente.
// ═══════════════════════════════════════════════════════════════

const MIN_TRIP_POINTS = 2;
const MIN_TRIP_DURATION_MS = 60_000;
const MIN_TRIP_DISTANCE_KM = 0.05;
const IDLE_SPEED_THRESHOLD_KMH = 5;
const POLYLINE_MAX_POINTS = 80;

interface PositionPoint {
  recordedAt: Date;
  lat: number;
  lng: number;
  speedKmh: number;
  ignition: boolean;
}

export interface TripDetectionSummary {
  /** Cuántos assets se evaluaron. */
  assetsChecked: number;
  /** Trips creados en esta corrida. */
  tripsCreated: number;
  /** Trips descartados por no cumplir filtros mínimos. */
  tripsDiscarded: number;
  /** Errores encontrados (no bloquean el resto). */
  errors: { assetId: string; message: string }[];
}

/**
 * Procesa detection para un set de assetIds afectados por una
 * batch de ingestion. Devuelve summary para logging / debugging.
 */
export async function processTripDetection(
  assetIds: string[],
): Promise<TripDetectionSummary> {
  const summary: TripDetectionSummary = {
    assetsChecked: 0,
    tripsCreated: 0,
    tripsDiscarded: 0,
    errors: [],
  };

  for (const assetId of assetIds) {
    summary.assetsChecked++;
    try {
      const result = await tryCloseTripForAsset(assetId);
      if (result === "created") summary.tripsCreated++;
      else if (result === "discarded") summary.tripsDiscarded++;
    } catch (err) {
      summary.errors.push({
        assetId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}

type CloseResult = "created" | "discarded" | "skipped";

async function tryCloseTripForAsset(assetId: string): Promise<CloseResult> {
  // ── 1. Estado actual del asset (LivePosition) ──────────────────
  const live = await db.livePosition.findUnique({ where: { assetId } });
  if (!live) return "skipped";

  // Si la última position tiene ignition=true, el trip sigue abierto
  // · no cerramos nada todavía.
  if (live.ignition) return "skipped";

  // ── 2. Encontrar el último Trip cerrado de este asset ────────
  // Necesitamos solo positions DESPUÉS de ese Trip · evitamos
  // recalcular trips ya creados.
  const lastTrip = await db.trip.findFirst({
    where: { assetId },
    orderBy: { endedAt: "desc" },
    select: { endedAt: true },
  });
  const since = lastTrip?.endedAt ?? new Date(0);

  // ── 3. Cargar positions desde ese cutoff hasta ahora ─────────
  const positions = await db.position.findMany({
    where: {
      assetId,
      recordedAt: { gt: since },
    },
    orderBy: { recordedAt: "asc" },
    select: {
      recordedAt: true,
      lat: true,
      lng: true,
      speedKmh: true,
      ignition: true,
    },
  });

  if (positions.length < MIN_TRIP_POINTS) return "skipped";

  // ── 4. Encontrar último bloque contiguo de ignition=true ─────
  // Recorremos de ATRÁS HACIA ADELANTE: la última position tiene
  // ignition=false (la que disparó este check). Saltamos las
  // ignition=false del final y tomamos el bloque ignition=true
  // anterior, hasta que aparezca otro ignition=false.
  const tripPoints = extractLastIgnitionOnRun(positions);

  if (tripPoints.length < MIN_TRIP_POINTS) return "skipped";

  // ── 5. Calcular stats ────────────────────────────────────────
  const stats = computeTripStats(tripPoints);

  if (
    stats.durationMs < MIN_TRIP_DURATION_MS ||
    stats.distanceKm < MIN_TRIP_DISTANCE_KM
  ) {
    return "discarded";
  }

  // ── 6. Driver actual del asset (snapshot) ────────────────────
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: { currentDriverId: true },
  });

  // ── 7. Crear Trip ─────────────────────────────────────────────
  await db.trip.create({
    data: {
      assetId,
      personId: asset?.currentDriverId ?? null,
      startedAt: stats.startedAt,
      endedAt: stats.endedAt,
      durationMs: stats.durationMs,
      distanceKm: stats.distanceKm,
      avgSpeedKmh: stats.avgSpeedKmh,
      maxSpeedKmh: stats.maxSpeedKmh,
      idleMs: stats.idleMs,
      startLat: stats.startLat,
      startLng: stats.startLng,
      endLat: stats.endLat,
      endLng: stats.endLng,
      positionCount: stats.positionCount,
      polylineJson: JSON.stringify(stats.polyline),
      eventCount: 0,
      highSeverityEventCount: 0,
    },
  });

  return "created";
}

/**
 * Dado un array ordenado por recordedAt, devuelve el último bloque
 * contiguo de positions con ignition=true (desde el final hacia
 * atrás).
 *
 * Casos:
 *  - [F]                       → []  (no hay tramo de ignition)
 *  - [T, T, T]                 → [T,T,T] (todo ON · raro porque
 *                                 entramos solo si la última es F)
 *  - [T, T, F]                 → [T,T]
 *  - [F, T, T, F]              → [T,T]
 *  - [T, F, T, T, F, F]        → [T,T] (ignoramos el primer T
 *                                 porque tiene un F intermedio)
 *  - [T, T, F, F, F]           → [T,T] (los F finales se ignoran)
 *
 * F intermedios cortos (apagones momentáneos): no los reagrupamos.
 * Para esa lógica más sofisticada (smoothing de ignition con
 * gap-tolerance) habría que parametrizar y se difiere a v1.1.
 */
function extractLastIgnitionOnRun(
  positions: PositionPoint[],
): PositionPoint[] {
  // Buscar el último índice con ignition=true
  let lastOnIdx = -1;
  for (let i = positions.length - 1; i >= 0; i--) {
    if (positions[i].ignition) {
      lastOnIdx = i;
      break;
    }
  }
  if (lastOnIdx === -1) return [];

  // Ir hacia atrás mientras siga siendo ignition=true
  let firstOnIdx = lastOnIdx;
  while (firstOnIdx > 0 && positions[firstOnIdx - 1].ignition) {
    firstOnIdx--;
  }

  return positions.slice(firstOnIdx, lastOnIdx + 1);
}

interface TripStats {
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  idleMs: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  positionCount: number;
  polyline: [number, number][];
}

function computeTripStats(points: PositionPoint[]): TripStats {
  const first = points[0];
  const last = points[points.length - 1];
  const startedAt = first.recordedAt;
  const endedAt = last.recordedAt;
  const durationMs = endedAt.getTime() - startedAt.getTime();

  let distanceKm = 0;
  let maxSpeedKmh = 0;
  let idleMs = 0;
  let speedSum = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.speedKmh > maxSpeedKmh) maxSpeedKmh = p.speedKmh;
    speedSum += p.speedKmh;

    if (i > 0) {
      const prev = points[i - 1];
      distanceKm += haversineKm(prev.lat, prev.lng, p.lat, p.lng);

      // Sumar idle si la velocidad promedio del tramo es baja
      const segmentSpeed = (prev.speedKmh + p.speedKmh) / 2;
      if (segmentSpeed < IDLE_SPEED_THRESHOLD_KMH) {
        idleMs += p.recordedAt.getTime() - prev.recordedAt.getTime();
      }
    }
  }

  const avgSpeedKmh = points.length > 0 ? speedSum / points.length : 0;

  // Polyline · decimación a max 80 puntos
  const polyline: [number, number][] = decimate(
    points.map((p) => [p.lat, p.lng] as [number, number]),
    POLYLINE_MAX_POINTS,
  );

  return {
    startedAt,
    endedAt,
    durationMs,
    distanceKm,
    avgSpeedKmh,
    maxSpeedKmh,
    idleMs,
    startLat: first.lat,
    startLng: first.lng,
    endLat: last.lat,
    endLng: last.lng,
    positionCount: points.length,
    polyline,
  };
}
