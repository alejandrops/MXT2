// @ts-nocheck · pre-existing patterns (Prisma types stale, DriverBoletinSnapshot pendiente migrar)
// ═══════════════════════════════════════════════════════════════
//  Driver boletín snapshot · S5-E1
//  ─────────────────────────────────────────────────────────────
//  Pre-generación con fallback on-demand:
//    1. Intenta leer de DriverBoletinSnapshot
//    2. Si no existe (o la tabla no migró aún), computa desde queries
//    3. Si la tabla existe, intenta guardar el snapshot · si falla,
//       sigue funcionando
//
//  Este patrón permite que el lote se aplique aunque el usuario no
//  haya corrido `prisma migrate dev` todavía. La performance es
//  on-demand (~200-500ms) en ese caso, instantánea con la tabla.
//
//  Para cron de pre-generación al cierre · ver S5-E1b.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  getDriverBoletinData,
  type DriverBoletinData,
} from "@/lib/queries/driver-boletin-data";
import type { ParsedPeriod } from "@/lib/conduccion/boletin-driver-text";

interface SnapshotArgs {
  driverId: string;
  period: ParsedPeriod;
  /** rawPeriod · "YYYY-MM" o "YYYY" · usado como key del snapshot */
  rawPeriod: string;
  accountId: string | null;
}

interface SnapshotResult {
  data: DriverBoletinData;
  /** Quién/qué generó este resultado · para debugging */
  source: "snapshot-cache" | "on-demand-saved" | "on-demand-no-cache";
  generatedAtIso: string;
}

/**
 * Lee de cache · si no existe o no es válido, computa y guarda.
 * Si la tabla DriverBoletinSnapshot no existe (no migró), cae a
 * on-demand sin guardar (no rompe el flujo).
 */
export async function getOrGenerateDriverBoletin(
  args: SnapshotArgs,
): Promise<SnapshotResult | null> {
  const { driverId, rawPeriod, period, accountId } = args;

  // ── 1. Intentar leer snapshot ───────────────────────
  let cached: { payload: any; generatedAt: Date } | null = null;
  try {
    cached = await db.driverBoletinSnapshot.findUnique({
      where: {
        driverId_period: {
          driverId,
          period: rawPeriod,
        },
      },
      select: { payload: true, generatedAt: true },
    });
  } catch {
    // Tabla no existe (no migró) · seguir a on-demand
    cached = null;
  }

  if (cached?.payload && isValidPayload(cached.payload)) {
    return {
      data: cached.payload as DriverBoletinData,
      source: "snapshot-cache",
      generatedAtIso: cached.generatedAt.toISOString(),
    };
  }

  // ── 2. Computar on-demand ─────────────────────────────
  const data = await getDriverBoletinData({ driverId, period, accountId });
  if (!data) return null;

  const generatedAtIso = new Date().toISOString();

  // ── 3. Intentar guardar · si la tabla existe ──────────
  try {
    await db.driverBoletinSnapshot.upsert({
      where: {
        driverId_period: {
          driverId,
          period: rawPeriod,
        },
      },
      create: {
        driverId,
        period: rawPeriod,
        accountId,
        payload: data as any,
        source: "onDemand",
      },
      update: {
        payload: data as any,
        generatedAt: new Date(),
        source: "onDemand",
      },
    });
    return {
      data,
      source: "on-demand-saved",
      generatedAtIso,
    };
  } catch {
    // Tabla no existe · servir sin guardar
    return {
      data,
      source: "on-demand-no-cache",
      generatedAtIso,
    };
  }
}

/**
 * Valida que un payload tenga la shape esperada.
 * Útil cuando se cambia DriverBoletinData entre versiones · invalida
 * snapshots viejos automáticamente.
 */
function isValidPayload(p: any): boolean {
  if (!p || typeof p !== "object") return false;
  if (!p.driver || !p.summary || !p.infractions) return false;
  if (typeof p.summary.score !== "number") return false;
  if (!Array.isArray(p.evolution?.scoreSeries)) return false;
  return true;
}
