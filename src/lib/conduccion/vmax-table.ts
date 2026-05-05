// ═══════════════════════════════════════════════════════════════
//  Conducción · vmax-table
//  ─────────────────────────────────────────────────────────────
//  Tabla de velocidades máximas según Ley Nacional de Tránsito
//  Argentina 24.449 art. 51, mapeada a las 9 categorías de
//  VehicleType de Maxtracker.
//
//  Fuente · https://www.argentina.gob.ar/justicia/derechofacil/leysimple/circulacion-vial
//
//  No es configurable por cliente · es una tabla legal nacional.
//  Los casos especiales (yacimientos, predios, caminos internos)
//  se modelan como Geofence con vmaxOverride · ver schema.prisma
//  modelo Geofence.
//
//  Casos especiales de la ley NO modelados en MVP (requieren
//  geodata extra que no tenemos):
//    · Encrucijada urbana sin semáforo · 30 precautoria
//    · Paso a nivel sin barrera · 20
//    · Proximidad escolar/deportiva · 20 en horario activo
//  Se manejarán con Geofence categoría ZONA_ESCOLAR post-MVP.
// ═══════════════════════════════════════════════════════════════

import type { RoadType, VehicleType } from "@/types/domain";

/// Mapa (RoadType × VehicleType) → vmax (km/h)
export const VMAX_KMH: Record<RoadType, Record<VehicleType, number>> = {
  URBANO_CALLE: {
    MOTOCICLETA: 40,
    LIVIANO: 40,
    UTILITARIO: 40,
    PASAJEROS: 40,
    CAMION_LIVIANO: 40,
    CAMION_PESADO: 40,
    SUSTANCIAS_PELIGROSAS: 40,
    MAQUINA_VIAL: 40,
    ASSET_FIJO: 0,
  },
  URBANO_AVENIDA: {
    MOTOCICLETA: 60,
    LIVIANO: 60,
    UTILITARIO: 60,
    PASAJEROS: 60,
    CAMION_LIVIANO: 60,
    CAMION_PESADO: 60,
    SUSTANCIAS_PELIGROSAS: 60,
    MAQUINA_VIAL: 60,
    ASSET_FIJO: 0,
  },
  RURAL: {
    MOTOCICLETA: 110,
    LIVIANO: 110,
    UTILITARIO: 110,
    PASAJEROS: 90,
    CAMION_LIVIANO: 90,
    CAMION_PESADO: 80,
    SUSTANCIAS_PELIGROSAS: 80,
    MAQUINA_VIAL: 80,
    ASSET_FIJO: 0,
  },
  SEMIAUTOPISTA: {
    MOTOCICLETA: 120,
    LIVIANO: 120,
    UTILITARIO: 120,
    PASAJEROS: 90,
    CAMION_LIVIANO: 90,
    CAMION_PESADO: 80,
    SUSTANCIAS_PELIGROSAS: 80,
    MAQUINA_VIAL: 80,
    ASSET_FIJO: 0,
  },
  AUTOPISTA: {
    MOTOCICLETA: 130,
    LIVIANO: 130,
    UTILITARIO: 130,
    PASAJEROS: 100,
    CAMION_LIVIANO: 100,
    CAMION_PESADO: 80,
    SUSTANCIAS_PELIGROSAS: 80,
    MAQUINA_VIAL: 80,
    ASSET_FIJO: 0,
  },
  CAMINO_RURAL: {
    // Camino rural no pavimentado · default LATAM 60 km/h.
    // No está en la ley con valor explícito · es práctica.
    MOTOCICLETA: 60,
    LIVIANO: 60,
    UTILITARIO: 60,
    PASAJEROS: 60,
    CAMION_LIVIANO: 60,
    CAMION_PESADO: 60,
    SUSTANCIAS_PELIGROSAS: 60,
    MAQUINA_VIAL: 40,
    ASSET_FIJO: 0,
  },
  DESCONOCIDO: {
    // Fallback conservador · cuando OSM no aporta datos.
    // Aplicamos un valor intermedio que sirve a la mayoría
    // de casos sin ser ni muy laxo ni muy estricto.
    MOTOCICLETA: 80,
    LIVIANO: 80,
    UTILITARIO: 80,
    PASAJEROS: 80,
    CAMION_LIVIANO: 80,
    CAMION_PESADO: 80,
    SUSTANCIAS_PELIGROSAS: 80,
    MAQUINA_VIAL: 60,
    ASSET_FIJO: 0,
  },
};

/// Lookup directo en la tabla. No considera Geofence overrides
/// ni tag maxspeed de OSM · para eso ver resolveVmax().
export function vmaxFromTable(roadType: RoadType, vehicleType: VehicleType): number {
  // Non-null assertion · el Record está completo para todas las
  // combinaciones del enum y `noUncheckedIndexedAccess` no puede
  // probarlo en tiempo de compilación.
  return VMAX_KMH[roadType]![vehicleType]!;
}
