// ═══════════════════════════════════════════════════════════════
//  Conducción · computeInfractions
//  ─────────────────────────────────────────────────────────────
//  Detecta infracciones de velocidad sobre una secuencia de
//  Position de un asset. Una infracción es la agregación de
//  samples consecutivos donde `speedKmh > vmaxAplicable` con
//  duración total ≥ MIN_DURATION_SEC (2 minutos default).
//
//  Algoritmo · pasada lineal:
//    1. Iterar samples ordenados por recordedAt
//    2. Si `vel > vmax` · abrir o extender segmento candidato
//    3. Si `vel ≤ vmax` o gap temporal grande · cerrar segmento
//    4. Filtrar segmentos por duración mínima
//    5. Calcular metadata por segmento (pico, distancia, etc.)
//
//  Performance · O(N) en samples. Para 1M assets con 1 sample/min
//  esto corre por asset en background, no en request path.
// ═══════════════════════════════════════════════════════════════

import type { RoadType, VehicleType } from "@/types/domain";
import type {
  ComputedInfraction,
  ExcessSegment,
  ResolvedGeofence,
  SpeedSample,
} from "./types";
import { CONDUCCION_DEFAULTS, classifySeverity } from "./types";
import { resolveVmax } from "./resolve-vmax";

/// Gap máximo entre samples consecutivos para considerar que la
/// secuencia sigue · si hay un hueco mayor (ej. asset apagado),
/// el segmento se corta. 5 minutos cubre paradas cortas + lag de
/// reporte habitual sin meter falsos positivos.
const MAX_GAP_BETWEEN_SAMPLES_SEC = 5 * 60;

export interface ComputeInfractionsArgs {
  /// Samples del asset ordenados por recordedAt asc
  samples: SpeedSample[];
  vehicleType: VehicleType;
  /// Geofences activas del account · pre-cargadas en memoria
  geofences: ResolvedGeofence[];
  /// Override del umbral mínimo · default 120s. Útil para tests.
  minDurationSec?: number;
}

/// Procesa los samples y devuelve la lista de infracciones
/// detectadas (cumplen umbral de duración mínima).
export function computeInfractions(args: ComputeInfractionsArgs): ComputedInfraction[] {
  const minDurationSec = args.minDurationSec ?? CONDUCCION_DEFAULTS.MIN_DURATION_SEC;
  const segments = detectExcessSegments(args, minDurationSec);
  return segments.map(toComputedInfraction);
}

/// Primer paso · agrupa samples consecutivos en exceso en
/// segmentos crudos. No filtra por duración todavía.
function detectExcessSegments(
  args: ComputeInfractionsArgs,
  minDurationSec: number,
): ExcessSegment[] {
  const { samples, vehicleType, geofences } = args;
  if (samples.length === 0) return [];

  const out: ExcessSegment[] = [];
  let current: SpeedSample[] = [];
  let currentVmax: number | null = null;
  let currentRoadType: RoadType | null = null;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const resolution = resolveVmax({
      lat: s.lat,
      lng: s.lng,
      vehicleType,
      roadType: s.roadType,
      geofences,
    });
    const inExcess = resolution.vmaxKmh > 0 && s.speedKmh > resolution.vmaxKmh;

    // Detectar gap temporal con el último sample del segmento abierto.
    let gapTooLarge = false;
    if (current.length > 0) {
      const lastT = current[current.length - 1]!.recordedAt.getTime();
      gapTooLarge = (s.recordedAt.getTime() - lastT) / 1000 > MAX_GAP_BETWEEN_SAMPLES_SEC;
    }

    if (inExcess && !gapTooLarge) {
      // Extender segmento o abrir uno nuevo
      if (current.length === 0) {
        currentVmax = resolution.vmaxKmh;
        currentRoadType = resolution.roadType;
      }
      current.push(s);
    } else {
      // Cerrar segmento si tenía contenido
      if (current.length >= 2 && currentVmax != null && currentRoadType != null) {
        const seg = closeSegment(current, currentVmax, currentRoadType);
        if (seg.durationSec >= minDurationSec) out.push(seg);
      }
      current = [];
      currentVmax = null;
      currentRoadType = null;
      // Si el sample actual está en exceso pero hubo gap, abrimos nuevo
      if (inExcess && gapTooLarge) {
        currentVmax = resolution.vmaxKmh;
        currentRoadType = resolution.roadType;
        current.push(s);
      }
    }
  }

  // Cerrar último segmento si quedó abierto
  if (current.length >= 2 && currentVmax != null && currentRoadType != null) {
    const seg = closeSegment(current, currentVmax, currentRoadType);
    if (seg.durationSec >= minDurationSec) out.push(seg);
  }

  return out;
}

function closeSegment(
  samples: SpeedSample[],
  vmaxKmh: number,
  roadType: RoadType,
): ExcessSegment {
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const durationSec = Math.round((last.recordedAt.getTime() - first.recordedAt.getTime()) / 1000);

  let peakSpeedKmh = 0;
  for (const s of samples) {
    if (s.speedKmh > peakSpeedKmh) peakSpeedKmh = s.speedKmh;
  }
  const maxExcessKmh = peakSpeedKmh - vmaxKmh;

  // Distancia del segmento · suma de geo-distance entre samples
  // consecutivos. Aproximamos con haversine (ver helper abajo).
  let distanceMeters = 0;
  for (let i = 1; i < samples.length; i++) {
    distanceMeters += haversineMeters(
      samples[i - 1]!.lat,
      samples[i - 1]!.lng,
      samples[i]!.lat,
      samples[i]!.lng,
    );
  }

  return {
    samples,
    startedAt: first.recordedAt,
    endedAt: last.recordedAt,
    durationSec,
    vmaxKmh,
    peakSpeedKmh,
    maxExcessKmh,
    distanceMeters,
    roadType,
  };
}

function toComputedInfraction(seg: ExcessSegment): ComputedInfraction {
  // trackJson · array compacto de [lat, lon, isoT, vel] para
  // reconstruir polilínea + curva velocidad/tiempo en el recibo.
  const track = seg.samples.map((s) => [
    s.lat,
    s.lng,
    s.recordedAt.toISOString(),
    s.speedKmh,
  ]);
  return {
    ...seg,
    severity: classifySeverity(seg.maxExcessKmh),
    trackJson: JSON.stringify(track),
  };
}

// ═══════════════════════════════════════════════════════════════
//  Geometría · haversine distance
//  ─────────────────────────────────────────────────────────────
//  Distancia geodésica entre dos puntos en metros, asumiendo
//  Tierra esférica con radio medio 6371km. Suficientemente preciso
//  para distancias cortas entre samples GPS (típicamente < 10km).
// ═══════════════════════════════════════════════════════════════

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// ═══════════════════════════════════════════════════════════════
//  Heurística para asignar RoadType en seed
//  ─────────────────────────────────────────────────────────────
//  Cuando no tenemos OSM real (caso del seed), inferimos un
//  RoadType plausible de la velocidad observada en el segmento.
//  Es una heurística MUY cruda · solo sirve para que el demo
//  tenga datos coherentes hasta que llegue el ingestor real.
//
//  Reglas:
//    · vel > 100  → AUTOPISTA
//    · vel > 80   → SEMIAUTOPISTA o RURAL (vamos por RURAL · más común)
//    · vel > 50   → URBANO_AVENIDA
//    · vel ≤ 50   → URBANO_CALLE
//    · vel == 0   → DESCONOCIDO (parado, no informa)
// ═══════════════════════════════════════════════════════════════

export function inferRoadTypeFromSpeed(speedKmh: number): RoadType {
  if (speedKmh <= 0) return "DESCONOCIDO";
  if (speedKmh > 100) return "AUTOPISTA";
  if (speedKmh > 80) return "RURAL";
  if (speedKmh > 50) return "URBANO_AVENIDA";
  return "URBANO_CALLE";
}
