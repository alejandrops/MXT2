// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parsePeriod } from "@/lib/conduccion/boletin-driver-text";
import { getDriverBoletinData } from "@/lib/queries/driver-boletin-data";

// ═══════════════════════════════════════════════════════════════
//  /api/cron/generate-driver-boletines · S5-E1b
//  ─────────────────────────────────────────────────────────────
//  Endpoint invocado por Vercel Cron para pre-generar los
//  boletines de conductores. Análogo al cron de boletines de
//  cuenta pero por driver.
//
//  Ejecución sugerida:
//    · Diaria a las 06:00 UTC = 03:00 ART
//    · Regenera el boletín MENSUAL del mes en curso para todos
//      los drivers activos
//    · El primer día de cada mes, también regenera el mes
//      anterior (que queda definitivo)
//    · El primer día del año, también regenera el ANUAL del
//      año anterior
//
//  Vercel cron config (vercel.json):
//    {
//      "crons": [
//        {
//          "path": "/api/cron/generate-driver-boletines",
//          "schedule": "0 6 * * *"
//        }
//      ]
//    }
//
//  Auth · Header Authorization: Bearer $CRON_SECRET
//
//  Manual run:
//    curl -H "Authorization: Bearer $CRON_SECRET" \
//      https://app.maxtracker.io/api/cron/generate-driver-boletines
//
//  Como puede tardar mucho con muchos drivers, retorna logs
//  estructurados y NO falla si un driver puntual falla · sigue
//  con el siguiente.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min · ajustable según volumen

interface DriverResult {
  driverId: string;
  driverName: string;
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
  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const year = todayLocal.getUTCFullYear();
  const month = todayLocal.getUTCMonth() + 1;
  const day = todayLocal.getUTCDate();

  // Períodos a regenerar
  const periodsToGenerate: string[] = [
    // Siempre · mes en curso (mensual)
    `${year}-${String(month).padStart(2, "0")}`,
  ];

  // Día 1 del mes · regenerar también el mes anterior (queda definitivo)
  if (day === 1) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    periodsToGenerate.unshift(
      `${prevYear}-${String(prevMonth).padStart(2, "0")}`,
    );
  }

  // 1 de enero · regenerar también el ANUAL del año anterior
  if (day === 1 && month === 1) {
    periodsToGenerate.push(String(year - 1));
  }

  // ── Listar drivers activos ─────────────────────────────
  // Activo = tiene al menos un assetDriverDay en los últimos 60 días
  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const activeDriverIds = await db.assetDriverDay.findMany({
    where: { day: { gte: since60d } },
    select: { personId: true },
    distinct: ["personId"],
  });
  const driverIds = activeDriverIds
    .map((r: any) => r.personId)
    .filter((id: string | null) => id !== null) as string[];

  const driverDetails = await db.person.findMany({
    where: { id: { in: driverIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      accountId: true,
    },
  });

  // ── Generar boletines · uno por driver y por período ───
  const results: DriverResult[] = [];
  let totalGenerated = 0;
  let totalErrors = 0;

  for (const driver of driverDetails) {
    const driverResult: DriverResult = {
      driverId: driver.id,
      driverName: `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() || "—",
      generated: [],
      errors: [],
    };

    for (const rawPeriod of periodsToGenerate) {
      try {
        const period = parsePeriod(rawPeriod);
        if (!period) {
          driverResult.errors.push(`${rawPeriod}: invalid period format`);
          totalErrors++;
          continue;
        }

        const data = await getDriverBoletinData({
          driverId: driver.id,
          period,
          accountId: driver.accountId,
        });

        if (!data) {
          driverResult.errors.push(`${rawPeriod}: driver not found`);
          totalErrors++;
          continue;
        }

        // Upsert en DriverBoletinSnapshot
        try {
          await db.driverBoletinSnapshot.upsert({
            where: {
              driverId_period: {
                driverId: driver.id,
                period: rawPeriod,
              },
            },
            create: {
              driverId: driver.id,
              period: rawPeriod,
              accountId: driver.accountId,
              payload: data as any,
              source: "cron",
            },
            update: {
              payload: data as any,
              generatedAt: new Date(),
              source: "cron",
            },
          });
          driverResult.generated.push(rawPeriod);
          totalGenerated++;
        } catch (e: any) {
          driverResult.errors.push(`${rawPeriod}: ${e.message ?? "upsert failed"}`);
          totalErrors++;
        }
      } catch (e: any) {
        driverResult.errors.push(`${rawPeriod}: ${e.message ?? "unknown error"}`);
        totalErrors++;
      }
    }

    if (driverResult.generated.length > 0 || driverResult.errors.length > 0) {
      results.push(driverResult);
    }
  }

  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    ok: true,
    elapsedMs,
    elapsedSec: Math.round(elapsedMs / 1000),
    periodsAttempted: periodsToGenerate,
    driversTotal: driverDetails.length,
    boletinesGenerated: totalGenerated,
    errors: totalErrors,
    // Solo incluir driver-level details si hay errores · evitar response gigante
    details: totalErrors > 0 ? results.filter((r) => r.errors.length > 0) : undefined,
  });
}
