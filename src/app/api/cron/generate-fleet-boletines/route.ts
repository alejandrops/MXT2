// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parsePeriod } from "@/lib/conduccion/boletin-driver-text";
import { getGroupBoletinData } from "@/lib/queries/group-boletin-data";
import { getAccountBoletinData } from "@/lib/queries/account-boletin-data";

// ═══════════════════════════════════════════════════════════════
//  /api/cron/generate-fleet-boletines · S5-E2b + S5-E3b
//  ─────────────────────────────────────────────────────────────
//  Pre-genera los boletines a nivel grupo y empresa.
//  Análogo a /api/cron/generate-driver-boletines pero un nivel
//  más arriba.
//
//  Lógica de generación:
//    · Diaria · regenera el mes en curso para todos los grupos
//      y todas las cuentas activas
//    · Día 1 de cada mes · también regenera el mes anterior
//      (queda definitivo) y el ANUAL del año en curso
//    · 1 de enero · también regenera el ANUAL del año anterior
//
//  Activo · cuenta/grupo con al menos un assetDriverDay en los
//  últimos 60 días.
//
//  Falla suave por entidad · si un grupo o cuenta puntual falla,
//  sigue con el siguiente.
//
//  Vercel cron config (vercel.json) · agregar:
//    {
//      "crons": [
//        {
//          "path": "/api/cron/generate-fleet-boletines",
//          "schedule": "30 6 * * *"
//        }
//      ]
//    }
//
//  El schedule está 30 min después del cron de drivers para no
//  competir por recursos en simultáneo.
//
//  Auth · Bearer $CRON_SECRET (mismo que los otros crons).
//
//  Manual run para testing:
//    curl -H "Authorization: Bearer $CRON_SECRET" \
//      http://localhost:3000/api/cron/generate-fleet-boletines
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface EntityResult {
  kind: "group" | "account";
  id: string;
  name: string;
  generated: string[];
  errors: string[];
}

export async function GET(request: Request) {
  // ── Auth ───────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  // ── Períodos a regenerar (mismo cálculo que driver cron) ─
  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const year = todayLocal.getUTCFullYear();
  const month = todayLocal.getUTCMonth() + 1;
  const day = todayLocal.getUTCDate();

  const periodsToGenerate: string[] = [
    `${year}-${String(month).padStart(2, "0")}`,
  ];

  if (day === 1) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    periodsToGenerate.unshift(
      `${prevYear}-${String(prevMonth).padStart(2, "0")}`,
    );
    // Día 1 de cualquier mes · también el ANUAL en curso
    periodsToGenerate.push(String(year));
  }

  if (day === 1 && month === 1) {
    // 1 de enero · año anterior cerrado
    periodsToGenerate.push(String(year - 1));
  }

  // ── Listar entidades activas ───────────────────────────
  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  // Grupos activos · tienen al menos un assetDriverDay reciente en sus assets
  const activeAssetIds = await db.assetDriverDay.findMany({
    where: { day: { gte: since60d } },
    select: { assetId: true },
    distinct: ["assetId"],
  });
  const assetIdSet = activeAssetIds.map((r: any) => r.assetId);

  const activeGroups = await db.group.findMany({
    where: {
      assets: {
        some: { id: { in: assetIdSet } },
      },
    },
    select: {
      id: true,
      name: true,
      accountId: true,
    },
  });

  // Cuentas con grupos activos
  const activeAccountIds = Array.from(
    new Set(activeGroups.map((g: any) => g.accountId)),
  );
  const activeAccounts = await db.account.findMany({
    where: { id: { in: activeAccountIds } },
    select: { id: true, name: true },
  });

  // ── Generar boletines ──────────────────────────────────
  const results: EntityResult[] = [];
  let totalGenerated = 0;
  let totalErrors = 0;

  // GRUPOS
  for (const group of activeGroups) {
    const r: EntityResult = {
      kind: "group",
      id: group.id,
      name: group.name,
      generated: [],
      errors: [],
    };

    for (const rawPeriod of periodsToGenerate) {
      try {
        const period = parsePeriod(rawPeriod);
        if (!period) {
          r.errors.push(`${rawPeriod}: invalid period`);
          totalErrors++;
          continue;
        }

        const data = await getGroupBoletinData({
          groupId: group.id,
          period,
          accountId: group.accountId,
        });
        if (!data) {
          r.errors.push(`${rawPeriod}: data not found`);
          totalErrors++;
          continue;
        }

        try {
          await db.groupBoletinSnapshot.upsert({
            where: {
              groupId_period: { groupId: group.id, period: rawPeriod },
            },
            create: {
              groupId: group.id,
              period: rawPeriod,
              accountId: group.accountId,
              payload: data as any,
              source: "cron",
            },
            update: {
              payload: data as any,
              generatedAt: new Date(),
              source: "cron",
            },
          });
          r.generated.push(rawPeriod);
          totalGenerated++;
        } catch (e: any) {
          r.errors.push(`${rawPeriod}: ${e.message ?? "upsert failed"}`);
          totalErrors++;
        }
      } catch (e: any) {
        r.errors.push(`${rawPeriod}: ${e.message ?? "unknown"}`);
        totalErrors++;
      }
    }

    if (r.generated.length > 0 || r.errors.length > 0) {
      results.push(r);
    }
  }

  // CUENTAS
  for (const account of activeAccounts) {
    const r: EntityResult = {
      kind: "account",
      id: account.id,
      name: account.name,
      generated: [],
      errors: [],
    };

    for (const rawPeriod of periodsToGenerate) {
      try {
        const period = parsePeriod(rawPeriod);
        if (!period) {
          r.errors.push(`${rawPeriod}: invalid period`);
          totalErrors++;
          continue;
        }

        const data = await getAccountBoletinData({
          accountId: account.id,
          period,
        });
        if (!data) {
          r.errors.push(`${rawPeriod}: data not found`);
          totalErrors++;
          continue;
        }

        try {
          await db.accountBoletinSnapshot.upsert({
            where: {
              accountId_period: {
                accountId: account.id,
                period: rawPeriod,
              },
            },
            create: {
              accountId: account.id,
              period: rawPeriod,
              payload: data as any,
              source: "cron",
            },
            update: {
              payload: data as any,
              generatedAt: new Date(),
              source: "cron",
            },
          });
          r.generated.push(rawPeriod);
          totalGenerated++;
        } catch (e: any) {
          r.errors.push(`${rawPeriod}: ${e.message ?? "upsert failed"}`);
          totalErrors++;
        }
      } catch (e: any) {
        r.errors.push(`${rawPeriod}: ${e.message ?? "unknown"}`);
        totalErrors++;
      }
    }

    if (r.generated.length > 0 || r.errors.length > 0) {
      results.push(r);
    }
  }

  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    ok: true,
    elapsedMs,
    elapsedSec: Math.round(elapsedMs / 1000),
    periodsAttempted: periodsToGenerate,
    groupsTotal: activeGroups.length,
    accountsTotal: activeAccounts.length,
    boletinesGenerated: totalGenerated,
    errors: totalErrors,
    details: totalErrors > 0 ? results.filter((r) => r.errors.length > 0) : undefined,
  });
}
