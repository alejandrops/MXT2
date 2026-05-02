// ═══════════════════════════════════════════════════════════════
//  Geo helpers (I3)
//  ─────────────────────────────────────────────────────────────
//  Cálculo de distancia entre coordenadas y simplificación de
//  polylines · ambas operaciones puras, sin DB.
// ═══════════════════════════════════════════════════════════════

const EARTH_RADIUS_KM = 6371;

/** Convierte grados a radianes. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Distancia en kilómetros entre dos puntos lat/lng (haversine).
 * Aproximación esférica · suficiente para distancias de hasta ~1000km
 * con error < 0.5%.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Decima una lista de puntos a no más de `maxPoints` muestreando
 * uniformemente en el array. Conserva siempre el primer y último
 * punto.
 *
 * NO es Douglas-Peucker · es una decimación simple que sirve para
 * reducir ruido visual de polylines largos sin perder forma general.
 * Para v1 alcanza · si después se quiere algo más sofisticado, se
 * cambia esta función sin tocar lo demás.
 */
export function decimate<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    // Math · round(i*step) con i ∈ [0, maxPoints-1] · resultado ∈ [0, points.length-1]
    out.push(points[Math.round(i * step)]!);
  }
  return out;
}
