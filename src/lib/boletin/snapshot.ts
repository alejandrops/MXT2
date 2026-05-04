// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  src/lib/boletin/snapshot.ts · S1-L7 cron-scaffold
//  ─────────────────────────────────────────────────────────────
//  Helpers para leer y escribir BoletinSnapshot · la cache que
//  guarda los payloads pre-computados del boletín mensual.
//
//  Consumers:
//    · Cron `/api/cron/generate-boletines` (escribe)
//    · Page `/direccion/boletin/[period]` (lee primero, fallback)
//    · Endpoint manual de regeneración (escribe ad-hoc)
//
//  Convención del period:
//    "YYYY-MM"  · ej. "2026-04" para Abril 2026
// ═══════════════════════════════════════════════════════════════

const PERIOD_RX = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidPeriod(s: string): boolean {
  return PERIOD_RX.test(s);
}

/**
 * Período "actual" según el momento de la llamada · YYYY-MM
 * basado en hora local AR (UTC-3).
 *
 * Útil para el cron · "regenerar el snapshot del mes en curso".
 */
export function currentPeriodAR(): string {
  const ms = Date.now() - 3 * 60 * 60 * 1000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Período del mes anterior · útil para cron del primer día del mes
 * (genera snapshot definitivo del mes que cerró).
 */
export function previousPeriodAR(): string {
  const ms = Date.now() - 3 * 60 * 60 * 1000;
  const d = new Date(ms);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// ─── Read ────────────────────────────────────────────────────

/**
 * Devuelve el snapshot del period+accountId si existe, sino null.
 *
 * accountId === null significa "snapshot cross-tenant" (SA/MA preview).
 * Para clientes regulares, accountId es el id de su cuenta.
 */
export async function getBoletinSnapshot(
  period: string,
  accountId: string | null,
): Promise<{
  payload: unknown;
  generatedAt: Date;
  source: string;
} | null> {
  if (!isValidPeriod(period)) return null;
  const row = await db.boletinSnapshot.findUnique({
    where: {
      period_accountId: {
        period,
        accountId: accountId as any, // Prisma compound key con null
      },
    },
    select: {
      payload: true,
      generatedAt: true,
      source: true,
    },
  });
  return row ?? null;
}

// ─── Write ───────────────────────────────────────────────────

/**
 * Inserta o actualiza un snapshot · upsert por (period, accountId).
 */
export async function upsertBoletinSnapshot(args: {
  period: string;
  accountId: string | null;
  payload: unknown;
  source?: "cron" | "manual" | "onDemand";
}): Promise<void> {
  if (!isValidPeriod(args.period)) {
    throw new Error(`Invalid period format: ${args.period}`);
  }
  const source = args.source ?? "cron";

  await db.boletinSnapshot.upsert({
    where: {
      period_accountId: {
        period: args.period,
        accountId: args.accountId as any,
      },
    },
    create: {
      period: args.period,
      accountId: args.accountId,
      payload: args.payload as any,
      source,
    },
    update: {
      payload: args.payload as any,
      source,
      generatedAt: new Date(),
    },
  });
}

/**
 * Borra el snapshot · útil si el PO quiere forzar regeneración.
 */
export async function deleteBoletinSnapshot(
  period: string,
  accountId: string | null,
): Promise<void> {
  await db.boletinSnapshot.deleteMany({
    where: {
      period,
      accountId: accountId as any,
    },
  });
}
