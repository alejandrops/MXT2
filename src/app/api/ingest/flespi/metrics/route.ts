import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestionMetrics } from "@/lib/ingestion/metrics";

// ═══════════════════════════════════════════════════════════════
//  GET /api/ingest/flespi/metrics (I4)
//  ─────────────────────────────────────────────────────────────
//  Devuelve:
//   · Snapshot del counter in-memory (totals, skipsByReason, etc)
//   · Conteos de devices silenciosos por threshold (5 min, 1h, 24h)
//
//  Sin auth · es solo lectura, agnóstico de tenant · útil para
//  monitoring básico durante testing. En producción debería estar
//  detrás de auth de admin o accesible solo desde la red interna.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const snapshot = ingestionMetrics.getSnapshot();

  // ── Devices silenciosos · solo INSTALLED con asset asignado ──
  const now = Date.now();
  const FIVE_MIN_AGO = new Date(now - 5 * 60 * 1000);
  const ONE_HOUR_AGO = new Date(now - 60 * 60 * 1000);
  const ONE_DAY_AGO = new Date(now - 24 * 60 * 60 * 1000);

  const [totalInstalled, silent5min, silent1h, silent24h, neverReported] =
    await Promise.all([
      db.device.count({
        where: { status: "INSTALLED", assetId: { not: null } },
      }),
      db.device.count({
        where: {
          status: "INSTALLED",
          assetId: { not: null },
          lastSeenAt: { lt: FIVE_MIN_AGO },
        },
      }),
      db.device.count({
        where: {
          status: "INSTALLED",
          assetId: { not: null },
          lastSeenAt: { lt: ONE_HOUR_AGO },
        },
      }),
      db.device.count({
        where: {
          status: "INSTALLED",
          assetId: { not: null },
          lastSeenAt: { lt: ONE_DAY_AGO },
        },
      }),
      db.device.count({
        where: {
          status: "INSTALLED",
          assetId: { not: null },
          lastSeenAt: null,
        },
      }),
    ]);

  return NextResponse.json({
    ...snapshot,
    devices: {
      totalInstalled,
      neverReported,
      silentMoreThan5min: silent5min,
      silentMoreThan1hour: silent1h,
      silentMoreThan24hours: silent24h,
    },
  });
}
