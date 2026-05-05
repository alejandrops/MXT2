// ═══════════════════════════════════════════════════════════════
//  Conducción · resolveVmax
//  ─────────────────────────────────────────────────────────────
//  Determina la velocidad máxima permitida para una posición
//  dada, aplicando las siguientes prioridades en orden:
//
//    1. Geofence override · si la posición está dentro de una
//       geocerca activa con vmaxOverride para el tipo de vehículo,
//       ese valor gana. En caso de solapamiento gana la geofence
//       de mayor priority.
//
//    2. RoadType de la Position · si vino precomputado del seed
//       o del ingestor (OSM tag highway), aplicamos la tabla
//       Ley 24.449 mapeada por (RoadType × VehicleType).
//
//    3. Fallback · si no hay datos, RoadType.DESCONOCIDO con
//       vmax conservador.
//
//  En MVP el lookup OSM en tiempo real no se hace · la Position
//  trae el roadType ya computado del seed. Cuando llegue el
//  ingestor de Flespi el ingestor poblará Position.roadType vía
//  Overpass API + caché. Eso es trabajo del ingestor, no de este
//  módulo.
// ═══════════════════════════════════════════════════════════════

import type { RoadType, VehicleType } from "@/types/domain";
import type { ResolvedGeofence, VmaxOverride, VmaxResolution } from "./types";
import { vmaxFromTable } from "./vmax-table";

/// Resuelve el vmax aplicable a un sample considerando geofences
/// pre-cargadas y el roadType del sample.
///
/// `geofences` es la lista de geofences activas del account, ya
/// pre-cargada en memoria · este módulo NO consulta BD (debe
/// llamarse desde código que tenga las geocercas a mano para
/// evitar N+1 queries en el bucle del algoritmo).
export function resolveVmax(args: {
  lat: number;
  lng: number;
  vehicleType: VehicleType;
  roadType: RoadType | null;
  geofences: ResolvedGeofence[];
}): VmaxResolution {
  const { lat, lng, vehicleType, geofences } = args;
  const roadType: RoadType = args.roadType ?? "DESCONOCIDO";

  // ─── 1. Geofence override ──────────────────────────────────
  // Buscamos la geofence de mayor priority que (a) contenga el
  // punto y (b) tenga override para este vehicleType.
  let bestMatch: { geofence: ResolvedGeofence; vmax: number } | null = null;
  for (const gf of geofences) {
    if (!gf.vmaxOverride) continue;
    const override = gf.vmaxOverride[vehicleType];
    if (override == null) continue;
    if (!pointInPolygon(lat, lng, gf.polygon.coordinates[0]!)) continue;
    if (bestMatch == null || gf.priority > bestMatch.geofence.priority) {
      bestMatch = { geofence: gf, vmax: override };
    }
  }
  if (bestMatch != null) {
    return {
      vmaxKmh: bestMatch.vmax,
      source: "GEOFENCE_OVERRIDE",
      geofenceId: bestMatch.geofence.id,
      roadType,
    };
  }

  // ─── 2. Tabla por RoadType × VehicleType ───────────────────
  const tableValue = vmaxFromTable(roadType, vehicleType);

  // ─── 3. Fallback explícito · roadType desconocido ──────────
  if (roadType === "DESCONOCIDO") {
    return {
      vmaxKmh: tableValue,
      source: "FALLBACK",
      geofenceId: null,
      roadType,
    };
  }

  return {
    vmaxKmh: tableValue,
    source: "ROAD_TYPE_TABLE",
    geofenceId: null,
    roadType,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Geometría · point-in-polygon
//  ─────────────────────────────────────────────────────────────
//  Algoritmo ray casting estándar. Funciona para polígonos
//  simples (sin huecos) en coordenadas geográficas para los
//  tamaños de geocerca típicos (yacimientos, predios) sin
//  necesidad de proyección. Para polígonos muy grandes (más de
//  unos 100km de extensión) habría que considerar la curvatura,
//  pero no es el caso de uso esperado.
// ═══════════════════════════════════════════════════════════════

/// `polygon` es el outer ring · array de [lng, lat] (formato GeoJSON).
function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i] as [number, number]; // [lng, lat]
    const [xj, yj] = polygon[j] as [number, number];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers para parsear los datos guardados como JSON stringified
//  (necesario porque Geofence.polygonGeoJson y vmaxOverrideJson
//  son String en el schema actual · cuando se migre a JSONB en
//  Postgres dejan de necesitarse estos helpers).
// ═══════════════════════════════════════════════════════════════

export function parseGeofence(row: {
  id: string;
  name: string;
  polygonGeoJson: string;
  vmaxOverrideJson: string | null;
  priority: number;
}): ResolvedGeofence {
  return {
    id: row.id,
    name: row.name,
    polygon: JSON.parse(row.polygonGeoJson),
    vmaxOverride: row.vmaxOverrideJson
      ? (JSON.parse(row.vmaxOverrideJson) as VmaxOverride)
      : null,
    priority: row.priority,
  };
}
