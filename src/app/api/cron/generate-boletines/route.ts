// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  currentPeriodAR,
  upsertBoletinSnapshot,
} from "@/lib/boletin/snapshot";

// ═══════════════════════════════════════════════════════════════
//  /api/cron/generate-boletines · S1-L7 cron-scaffold
//  ─────────────────────────────────────────────────────────────
//  Endpoint invocado por Vercel Cron diariamente a las 06:00 UTC
//  (= 03:00 AR) · regenera el snapshot del MES EN CURSO para
//  cada account activo.
//
//  Auth:
//    · Vercel envía header `Authorization: Bearer $CRON_SECRET`
//    · El secret debe estar configurado como env var en Vercel:
//      Settings → Environment Variables → CRON_SECRET
//
//  Estado del lote (S1-L7 scaffold):
//    · Infraestructura completa · auth, lista de accounts, persist
//    · Generación REAL del payload · placeholder por ahora
//      (refactor de loadBoletinData del page.tsx llega en Sprint 2)
//
//  Sprint 2 TODO:
//    · Mover loadBoletinData a src/lib/queries/boletin-data.ts
//    · Reemplazar buildPlaceholderPayload por la lógica real
//    · Agregar regeneración de mes anterior el día 1
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // ── 1. Auth · solo Vercel cron debería poder invocar ─────
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const period = currentPeriodAR();

  try {
    // ── 2. Listar accounts activos ───────────────────────
    const accounts = await db.account.findMany({
      where: {
        // Ajustar cuando exista campo de status/active
      },
      select: { id: true, name: true },
    });

    const results: Array<{
      accountId: string;
      accountName: string;
      ok: boolean;
      error?: string;
    }> = [];

    // ── 3. Para cada account, generar y persistir snapshot ──
    for (const account of accounts) {
      try {
        // PLACEHOLDER · payload mínimo por ahora
        // En Sprint 2, reemplazar por loadBoletinData refactorizado
        const payload = await buildPlaceholderPayload({
          period,
          accountId: account.id,
        });

        await upsertBoletinSnapshot({
          period,
          accountId: account.id,
          payload,
          source: "cron",
        });

        results.push({
          accountId: account.id,
          accountName: account.name,
          ok: true,
        });
      } catch (err) {
        results.push({
          accountId: account.id,
          accountName: account.name,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    console.log(
      `[cron/generate-boletines] period=${period} accounts=${accounts.length} ok=${ok} failed=${failed} duration=${durationMs}ms`,
    );

    return NextResponse.json({
      period,
      accounts: accounts.length,
      ok,
      failed,
      durationMs,
      results,
    });
  } catch (err) {
    console.error("[cron/generate-boletines] failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        period,
      },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  PLACEHOLDER · sustituir en Sprint 2 por payload real del boletín
// ═══════════════════════════════════════════════════════════════

async function buildPlaceholderPayload(args: {
  period: string;
  accountId: string;
}): Promise<{
  period: string;
  accountId: string;
  status: "placeholder";
  generatedAt: string;
  notes: string;
}> {
  return {
    period: args.period,
    accountId: args.accountId,
    status: "placeholder",
    generatedAt: new Date().toISOString(),
    notes:
      "S1-L7 scaffold · payload completo en Sprint 2 cuando refactor de loadBoletinData",
  };
}
