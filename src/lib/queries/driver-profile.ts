import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  getDriverProfile · datos para el header slot del Libro Conductor
//  ─────────────────────────────────────────────────────────────
//  Trae info de identidad del conductor + ranking de safety score
//  contra la flota · permite mostrar "82 · top 15% de la flota"
//  como contexto.
//
//  Schema usado:
//    Person · firstName, lastName, document, hiredAt,
//             licenseExpiresAt, safetyScore
//    Asset count · cantidad de vehículos asignados a este driver
//                  vía Asset.currentDriverId (drivenAssets relation)
//    Person aggregate · para calcular percentil del safety score
// ═══════════════════════════════════════════════════════════════

export interface DriverProfileData {
  id: string;
  fullName: string;
  document: string | null;
  hiredAt: Date | null;
  licenseExpiresAt: Date | null;
  safetyScore: number;
  /** Vehículos que maneja activamente · resumen para header */
  drivenAssetCount: number;
  /** Percentil del safety score · 0-100 · 100 = el mejor */
  scorePercentile: number;
  /** Etiqueta legible del percentil · "top 15%", "promedio", etc */
  scoreContext: string;
  /** ¿Licencia vencida? */
  licenseExpired: boolean;
  /** ¿Licencia próxima a vencer (30 días)? */
  licenseExpiringSoon: boolean;
}

export async function getDriverProfile(
  personId: string,
): Promise<DriverProfileData | null> {
  const [person, drivenAssetCount, allScores] = await Promise.all([
    db.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        document: true,
        hiredAt: true,
        licenseExpiresAt: true,
        safetyScore: true,
      },
    }),
    db.asset.count({ where: { currentDriverId: personId } }),
    db.person.findMany({ select: { safetyScore: true } }),
  ]);

  if (!person) return null;

  const totalDrivers = allScores.length;
  const sortedAsc = allScores.map((p) => p.safetyScore).sort((a, b) => a - b);
  // Cuántos tienen score MENOR a este conductor · ese es su rank
  const lowerCount = sortedAsc.filter((s) => s < person.safetyScore).length;
  const scorePercentile =
    totalDrivers > 1 ? Math.round((lowerCount / (totalDrivers - 1)) * 100) : 50;

  // Contexto narrativo
  let scoreContext: string;
  if (scorePercentile >= 90) scoreContext = `top ${100 - scorePercentile}% de la flota`;
  else if (scorePercentile >= 75) scoreContext = "destacado";
  else if (scorePercentile >= 50) scoreContext = "promedio";
  else if (scorePercentile >= 25) scoreContext = "por debajo del promedio";
  else scoreContext = `bottom ${scorePercentile}% de la flota`;

  // Estado de licencia
  const now = Date.now();
  const expMs = person.licenseExpiresAt?.getTime() ?? null;
  const licenseExpired = expMs !== null && expMs < now;
  const licenseExpiringSoon =
    expMs !== null &&
    !licenseExpired &&
    expMs - now < 30 * 24 * 60 * 60 * 1000;

  return {
    id: person.id,
    fullName: `${person.firstName} ${person.lastName}`.trim(),
    document: person.document,
    hiredAt: person.hiredAt,
    licenseExpiresAt: person.licenseExpiresAt,
    safetyScore: person.safetyScore,
    drivenAssetCount,
    scorePercentile,
    scoreContext,
    licenseExpired,
    licenseExpiringSoon,
  };
}
