// ═══════════════════════════════════════════════════════════════
//  src/lib/mock-can/resolve.ts · S2-L3
//  ─────────────────────────────────────────────────────────────
//  Bridge entre el mock determinístico (S1-L3) y el canData real
//  persistido en Position.canData (S2-L3).
//
//  Política · prefer real over mock:
//    1. Si hay canData persistido con shape válido → usar ese
//    2. Si no hay (o el shape no valida) → fallback al mock
//
//  Cuándo se usa cada uno:
//    · Producción real con Flespi · Position.canData populated →
//      usa el persistido
//    · Demo / pre-Flespi · Position.canData = null → mock
//    · Vehículos sin CAN bus (FMB920/Legacy) · siempre null en
//      ambos caminos · UI muestra placeholder
// ═══════════════════════════════════════════════════════════════

import { generateCanSnapshot } from "./generate";
import type { CanSnapshot } from "./types";

/**
 * Devuelve el CanSnapshot a mostrar para un ping/sample dado.
 *
 * @param persisted   `Position.canData` leído de Prisma · puede ser null
 * @param args.assetId Para alimentar el mock determinístico
 * @param args.speedKmh, ignition · estado del momento (mock)
 * @param args.wallClockMs · timestamp del momento (mock)
 *
 * @returns CanSnapshot | null
 *   · null si el dispositivo no tiene CAN (mock devuelve null)
 *   · CanSnapshot del campo persistido si era válido
 *   · CanSnapshot generado por mock si no había persistido
 */
export function resolveCanSnapshot(
  persisted: unknown | null | undefined,
  args: {
    assetId: string;
    speedKmh: number;
    ignition: boolean;
    wallClockMs: number;
  },
): CanSnapshot | null {
  if (persisted && isValidSnapshotShape(persisted)) {
    return persisted as CanSnapshot;
  }
  return generateCanSnapshot(
    args.assetId,
    args.speedKmh,
    args.ignition,
    args.wallClockMs,
  );
}

/**
 * Valida que el JSON persistido tenga shape de CanSnapshot.
 * Discriminador · check de campos requeridos clave.
 */
function isValidSnapshotShape(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  // Mínimo · si tiene rpm + fuelLevelPct + odometerKm es plausible
  return (
    typeof p.rpm === "number" &&
    typeof p.fuelLevelPct === "number" &&
    typeof p.odometerKm === "number"
  );
}
