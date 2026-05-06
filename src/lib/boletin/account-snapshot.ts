// @ts-nocheck · pre-existing patterns (Prisma types stale, AccountBoletinSnapshot pendiente migrar)
// ═══════════════════════════════════════════════════════════════
//  Account boletín snapshot · S5-E3b
//  ─────────────────────────────────────────────────────────────
//  Pre-generación con fallback on-demand para boletín ejecutivo
//  de empresa. Coexiste con BoletinSnapshot del S1 (operativo).
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  getAccountBoletinData,
  type AccountBoletinData,
} from "@/lib/queries/account-boletin-data";
import type { ParsedPeriod } from "@/lib/conduccion/boletin-driver-text";

interface SnapshotArgs {
  accountId: string;
  period: ParsedPeriod;
  rawPeriod: string;
}

interface SnapshotResult {
  data: AccountBoletinData;
  source: "snapshot-cache" | "on-demand-saved" | "on-demand-no-cache";
  generatedAtIso: string;
}

export async function getOrGenerateAccountBoletin(
  args: SnapshotArgs,
): Promise<SnapshotResult | null> {
  const { accountId, rawPeriod, period } = args;

  let cached: { payload: any; generatedAt: Date } | null = null;
  try {
    cached = await db.accountBoletinSnapshot.findUnique({
      where: {
        accountId_period: {
          accountId,
          period: rawPeriod,
        },
      },
      select: { payload: true, generatedAt: true },
    });
  } catch {
    cached = null;
  }

  if (cached?.payload && isValidPayload(cached.payload)) {
    return {
      data: cached.payload as AccountBoletinData,
      source: "snapshot-cache",
      generatedAtIso: cached.generatedAt.toISOString(),
    };
  }

  const data = await getAccountBoletinData({ accountId, period });
  if (!data) return null;

  const generatedAtIso = new Date().toISOString();

  try {
    await db.accountBoletinSnapshot.upsert({
      where: {
        accountId_period: {
          accountId,
          period: rawPeriod,
        },
      },
      create: {
        accountId,
        period: rawPeriod,
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
    return {
      data,
      source: "on-demand-no-cache",
      generatedAtIso,
    };
  }
}

function isValidPayload(p: any): boolean {
  if (!p || typeof p !== "object") return false;
  if (!p.account || !p.summary || !p.infractions) return false;
  if (typeof p.summary.score !== "number") return false;
  if (!Array.isArray(p.evolution?.scoreSeries)) return false;
  return true;
}
