// ═══════════════════════════════════════════════════════════════
//  Conducción · types compartidos
//  ─────────────────────────────────────────────────────────────
//  S4-L3a · módulo de detección de infracciones de velocidad
//  basado en metodología Geotab Driver Safety Scorecard adaptada
//  a Argentina (Ley Nacional de Tránsito 24.449 art. 51).
// ═══════════════════════════════════════════════════════════════

import type { RoadType, VehicleType } from "@/types/domain";

/// Sample puntual usado por el algoritmo de detección. Subset
/// mínimo de Position para no atar el algoritmo al schema.
export interface SpeedSample {
  recordedAt: Date;
  lat: number;
  lng: number;
  speedKmh: number;
  /// Tipo de vía precomputado en ingest/seed · si null, fallback
  roadType: RoadType | null;
}

/// Polígono GeoJSON típico de una Geofence almacenada
export interface GeofencePolygon {
  type: "Polygon";
  coordinates: number[][][]; // [outer ring, ...holes]
}

/// Override de vmax por tipo de vehículo · valor stringified en
/// Geofence.vmaxOverrideJson. Las claves son VehicleType del enum.
export type VmaxOverride = Partial<Record<VehicleType, number>>;

/// Geofence precargada en memoria para lookup eficiente
export interface ResolvedGeofence {
  id: string;
  name: string;
  polygon: GeofencePolygon;
  vmaxOverride: VmaxOverride | null;
  priority: number;
}

/// Resultado del lookup de vmax aplicable a una posición
export interface VmaxResolution {
  vmaxKmh: number;
  /// Origen del valor · útil para debug y para mostrar en el
  /// recibo de infracción ("¿por qué este vmax?")
  source: "GEOFENCE_OVERRIDE" | "ROAD_TYPE_TABLE" | "FALLBACK";
  /// Si vino de geofence override · cuál
  geofenceId: string | null;
  /// Tipo de vía asumido (tabla aplicada, o el inferido)
  roadType: RoadType;
}

/// Segmento candidato a infracción · output del primer paso del
/// algoritmo (samples consecutivos en exceso). Se filtra después
/// por duración mínima.
export interface ExcessSegment {
  samples: SpeedSample[];
  /// Datos derivados · calculados una vez al cerrar el segmento
  startedAt: Date;
  endedAt: Date;
  durationSec: number;
  vmaxKmh: number;
  peakSpeedKmh: number;
  maxExcessKmh: number;
  distanceMeters: number;
  roadType: RoadType;
}

/// Output final del algoritmo · listo para persistir como Infraction
export interface ComputedInfraction extends ExcessSegment {
  /// LEVE | MEDIA | GRAVE según maxExcessKmh
  severity: "LEVE" | "MEDIA" | "GRAVE";
  /// Polilínea + curva velocidad/tiempo · ya stringified
  trackJson: string;
}

/// Umbrales del módulo · valores por defecto MVP, configurables
/// en el futuro vía AccountSettings o tabla de configuración global.
export const CONDUCCION_DEFAULTS = {
  /// Duración mínima en segundos para que una secuencia de
  /// excesos consecutivos se considere infracción. Geotab default
  /// es 20s · Maxtracker es más conservador (3 samples consecutivos
  /// asumiendo 1 ping/min) para evitar falsos positivos en LATAM
  /// donde el GPS puede dar lecturas imprecisas en zonas pobladas.
  MIN_DURATION_SEC: 120,

  /// Umbrales de severidad sobre el pico de exceso (peakSpeed - vmax).
  /// Heredados del sistema legacy (Maxtracker AVL).
  SEVERITY_LEVE_MAX_KMH: 9,
  SEVERITY_MEDIA_MAX_KMH: 17,
  // GRAVE = ≥ 18 km/h

  /// Multiplier del Violation Percentage Method (Geotab).
  /// Lineal en MVP · 10 significa que 10% del km en exceso → score 0.
  VIOLATION_PCT_MULTIPLIER: 10,

  /// Bandas de score (heredadas del sistema legacy)
  SCORE_BAND_BUENO_MIN: 80, // > 80 verde
  SCORE_BAND_MEDIO_MIN: 60, // 60-80 amarillo · < 60 rojo

  /// Distancia mínima recorrida para calcular score · si el
  /// conductor manejó menos, devolvemos "Sin kms" en lugar de 100.
  MIN_DISTANCE_FOR_SCORE_KM: 1,
} as const;

/// Helper · clasifica severity a partir de maxExcessKmh
export function classifySeverity(maxExcessKmh: number): "LEVE" | "MEDIA" | "GRAVE" {
  if (maxExcessKmh <= CONDUCCION_DEFAULTS.SEVERITY_LEVE_MAX_KMH) return "LEVE";
  if (maxExcessKmh <= CONDUCCION_DEFAULTS.SEVERITY_MEDIA_MAX_KMH) return "MEDIA";
  return "GRAVE";
}
