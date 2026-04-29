import { NextRequest, NextResponse } from "next/server";
import {
  getFleetAnalysis,
  getFleetMultiMetric,
  type ActivityMetric,
  type AnalysisGranularity,
  type ScopeFilters,
} from "@/lib/queries";

// ═══════════════════════════════════════════════════════════════
//  GET /api/v1/fleet/analysis
//  ─────────────────────────────────────────────────────────────
//  Devuelve los datos de análisis de flota como JSON.
//  Auth: Bearer token en header Authorization.
//  En el demo cualquier token con prefijo "mxt_" funciona.
//
//  Query params:
//    granularity · day-hours | week-days | month-days | year-weeks | year-months
//    metric      · distanceKm | activeMin | idleMin | tripCount | eventCount | speedingCount | maxSpeedKmh | fuelLiters
//    anchor      · YYYY-MM-DD (default hoy)
//    layout      · time (default) | metrics (multi-métrica)
//    grp         · group ids csv
//    type        · vehicle types csv
// ═══════════════════════════════════════════════════════════════

const VALID_G: AnalysisGranularity[] = [
  "day-hours",
  "week-days",
  "month-days",
  "year-weeks",
  "year-months",
];
const VALID_M: ActivityMetric[] = [
  "distanceKm",
  "activeMin",
  "idleMin",
  "tripCount",
  "eventCount",
  "highEventCount",
  "speedingCount",
  "maxSpeedKmh",
  "fuelLiters",
];

export async function GET(req: NextRequest) {
  // Auth · bearer token (demo · cualquier mxt_ funciona)
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing Authorization header. Use: Bearer <token>" },
      { status: 401 },
    );
  }
  const token = auth.slice(7).trim();
  if (!token.startsWith("mxt_") || token.length < 8) {
    return NextResponse.json(
      { error: "Invalid token. Demo accepts any token starting with 'mxt_'." },
      { status: 401 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const get = (k: string) => sp.get(k);
  const csv = (k: string) => {
    const v = get(k);
    if (!v) return undefined;
    return v.split(",").filter(Boolean);
  };

  const gRaw = get("granularity");
  const granularity: AnalysisGranularity =
    gRaw && (VALID_G as string[]).includes(gRaw)
      ? (gRaw as AnalysisGranularity)
      : "month-days";

  const mRaw = get("metric");
  const metric: ActivityMetric =
    mRaw && (VALID_M as string[]).includes(mRaw)
      ? (mRaw as ActivityMetric)
      : "distanceKm";

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(
    todayLocal.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const anchor = get("anchor") ?? todayIso;

  const scope: ScopeFilters = {
    groupIds: csv("grp"),
    vehicleTypes: csv("type"),
  };

  const layout = get("layout");

  try {
    if (layout === "metrics") {
      const data = await getFleetMultiMetric({
        granularity,
        anchor,
        metric,
        scope,
      });
      return NextResponse.json({
        version: "v1",
        layout: "metrics",
        granularity: data.granularity,
        period: {
          from: data.periodFrom,
          to: data.periodTo,
          label: data.periodLabel,
          subLabel: data.periodSubLabel,
        },
        rows: data.rows.map((r) => ({
          assetId: r.assetId,
          assetName: r.assetName,
          assetPlate: r.assetPlate,
          groupName: r.groupName,
          vehicleType: r.vehicleType,
          metrics: r.metrics,
        })),
        totals: data.totals,
      });
    }

    const data = await getFleetAnalysis({
      granularity,
      anchor,
      metric,
      scope,
    });
    return NextResponse.json({
      version: "v1",
      layout: "time",
      granularity: data.granularity,
      metric: data.metric,
      metricLabel: data.metricLabel,
      period: {
        from: data.periodFrom,
        to: data.periodTo,
        label: data.periodLabel,
        subLabel: data.periodSubLabel,
      },
      total: data.total,
      previousTotal: data.previousTotal,
      deltaPct: data.deltaPct,
      colLabels: data.colLabels,
      rows: data.rows.map((r) => ({
        assetId: r.assetId,
        assetName: r.assetName,
        assetPlate: r.assetPlate,
        groupName: r.groupName,
        total: r.total,
        previousTotal: r.previousTotal,
        previousDeltaPct: r.previousDeltaPct,
        cells: r.cells.map((c) => ({ col: c.col, value: c.value })),
      })),
      trend: data.trend,
      anomalies: data.anomalies,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Internal error", detail: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
