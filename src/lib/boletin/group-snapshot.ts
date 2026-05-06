// @ts-nocheck · pre-existing patterns (Prisma types stale, GroupBoletinSnapshot pendiente migrar)
// ═══════════════════════════════════════════════════════════════
//  Group boletín snapshot · S5-E2b
//  ─────────────────────────────────────────────────────────────
//  Pre-generación con fallback on-demand:
//    1. Intenta leer de GroupBoletinSnapshot
//    2. Si no existe (o la tabla no migró aún), computa desde queries
//    3. Si la tabla existe, intenta guardar el snapshot · si falla,
//       sigue funcionando
//
//  Mismo patrón que driver-snapshot.ts.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  getGroupBoletinData,
  type GroupBoletinData,
} from "@/lib/queries/group-boletin-data";
import type { ParsedPeriod } from "@/lib/conduccion/boletin-driver-text";

interface SnapshotArgs {
  groupId: string;
  period: ParsedPeriod;
  /** rawPeriod · "YYYY-MM" o "YYYY" · usado como key del snapshot */
  rawPeriod: string;
  accountId: string | null;
}

interface SnapshotResult {
  data: GroupBoletinData;
  source: "snapshot-cache" | "on-demand-saved" | "on-demand-no-cache";
  generatedAtIso: string;
}

export async function getOrGenerateGroupBoletin(
  args: SnapshotArgs,
): Promise<SnapshotResult | null> {
  const { groupId, rawPeriod, period, accountId } = args;

  // ── 1. Intentar leer snapshot ───────────────────────
  let cached: { payload: any; generatedAt: Date } | null = null;
  try {
    cached = await db.groupBoletinSnapshot.findUnique({
      where: {
        groupId_period: {
          groupId,
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
      data: cached.payload as GroupBoletinData,
      source: "snapshot-cache",
      generatedAtIso: cached.generatedAt.toISOString(),
    };
  }

  // ── 2. Computar on-demand ─────────────────────────────
  const data = await getGroupBoletinData({ groupId, period, accountId });
  if (!data) return null;

  const generatedAtIso = new Date().toISOString();

  // ── 3. Intentar guardar · si la tabla existe ──────────
  try {
    await db.groupBoletinSnapshot.upsert({
      where: {
        groupId_period: {
          groupId,
          period: rawPeriod,
        },
      },
      create: {
        groupId,
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
    return {
      data,
      source: "on-demand-no-cache",
      generatedAtIso,
    };
  }
}

function isValidPayload(p: any): boolean {
  if (!p || typeof p !== "object") return false;
  if (!p.group || !p.summary || !p.infractions) return false;
  if (typeof p.summary.score !== "number") return false;
  if (!Array.isArray(p.evolution?.scoreSeries)) return false;
  return true;
}
