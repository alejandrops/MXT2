// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  currentPeriodAR,
  upsertBoletinSnapshot,
} from "@/lib/boletin/snapshot";
import {
  loadBoletinData,
  periodToDateRange,
} from "@/lib/queries/boletin-data";

// ═══════════════════════════════════════════════════════════════
//  /api/cron/generate-boletines · S1-L7 + S2-L1
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
//  S2-L1 · ahora genera payloads REALES llamando a loadBoletinData.
//  El page del boletín verifica el shape (isValidBoletinPayload) y
//  cuando pasa el check, sirve el snapshot directo (instantáneo).
//
//  Manual run:
//    curl -H "Authorization: Bearer $CRON_SECRET" \
//      "https://mxt-2.vercel.app/api/cron/generate-boletines"
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
  const range = periodToDateRange(period);
  if (!range) {
    return NextResponse.json(
      { error: `Invalid period: ${period}` },
      { status: 500 },
    );
  }

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
      durationMs?: number;
      error?: string;
    }> = [];

    // ── 3. Por cada account · generar payload real y persistir ──
    // Procesamos secuencialmente para no saturar Postgres con
    // queries paralelas (loadBoletinData hace ~15 queries internas).
    for (const account of accounts) {
      const accStarted = Date.now();
      try {
        const payload = await loadBoletinData({
          monthStart: range.monthStart,
          monthEnd: range.monthEnd,
          prevStart: range.prevStart,
          prevEnd: range.prevEnd,
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
          durationMs: Date.now() - accStarted,
        });
      } catch (err) {
        results.push({
          accountId: account.id,
          accountName: account.name,
          ok: false,
          durationMs: Date.now() - accStarted,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const totalDurationMs = Date.now() - startedAt;
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    console.log(
      `[cron/generate-boletines] period=${period} accounts=${accounts.length} ok=${ok} failed=${failed} durationMs=${totalDurationMs}`,
    );

    return NextResponse.json({
      period,
      accounts: accounts.length,
      ok,
      failed,
      totalDurationMs,
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
