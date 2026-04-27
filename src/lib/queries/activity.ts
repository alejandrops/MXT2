// ═══════════════════════════════════════════════════════════════
//  Queries · Módulo Actividad
//  ─────────────────────────────────────────────────────────────
//  Fuente de verdad para las 4 sub-pantallas:
//    · Resumen      → getActivitySummary
//    · Comparativas → getActivityTimeSeries
//    · Línea tiempo → getActivityTimeline (stub · A5)
//    · Reportes     → getActivityPivot
//
//  Todas las queries leen de tablas precalculadas:
//    · AssetDriverDay  · día × asset × person
//    · AssetWeeklyStats· semana × asset (NUEVO · A1)
//    · Event           · para infracciones / eventos detallados
//    · Trip            · cuando hace falta detalle por viaje
//
//  NUNCA leen Position directamente (regla del proyecto).
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

// AR offset (UTC-3 · sin DST)
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
//  Tipos compartidos
// ═══════════════════════════════════════════════════════════════

/**
 * Período de análisis. Todas las queries del módulo aceptan un
 * rango [from, to] · medido en UTC pero los buckets diarios
 * respetan AR-local (00:00 AR = 03:00 UTC).
 */
export interface ActivityPeriod {
  /** UTC instant inclusive (00:00 AR del día desde) */
  from: Date;
  /** UTC instant exclusive (24:00 AR del día hasta) */
  to: Date;
  /** Cantidad de días que cubre el rango (inclusive) */
  dayCount: number;
}

/** Métrica agregable que se puede pivotear en Reportes */
export type ActivityMetric =
  | "distanceKm"
  | "activeMin"
  | "idleMin"
  | "tripCount"
  | "eventCount"
  | "highEventCount"
  | "speedingCount"
  | "maxSpeedKmh"
  | "fuelLiters";

export const METRIC_LABELS: Record<ActivityMetric, string> = {
  distanceKm: "Distancia (km)",
  activeMin: "Tiempo activo (min)",
  idleMin: "Ralentí (min)",
  tripCount: "Viajes",
  eventCount: "Eventos",
  highEventCount: "Eventos severos",
  speedingCount: "Infracciones",
  maxSpeedKmh: "Velocidad máx. (km/h)",
  fuelLiters: "Combustible (L)",
};

/** Cómo se agrega cuando se pivota a un total de período */
export const METRIC_AGG: Record<ActivityMetric, "sum" | "max"> = {
  distanceKm: "sum",
  activeMin: "sum",
  idleMin: "sum",
  tripCount: "sum",
  eventCount: "sum",
  highEventCount: "sum",
  speedingCount: "sum",
  maxSpeedKmh: "max",
  fuelLiters: "sum",
};

// ═══════════════════════════════════════════════════════════════
//  Period helpers
// ═══════════════════════════════════════════════════════════════

export type ActivityPreset = "today" | "yesterday" | "7d" | "30d" | "custom";

/**
 * Construye un ActivityPeriod desde un preset o desde fechas
 * ISO `YYYY-MM-DD` (rango inclusivo). Las fechas se interpretan
 * como AR-local · el `to` cubre hasta las 23:59 de ese día.
 */
export function buildPeriod(
  preset: ActivityPreset,
  customFromIso?: string,
  customToIso?: string,
  now: number = Date.now(),
): ActivityPeriod {
  const todayMidnight = arLocalMidnightUtc(now);

  if (preset === "custom" && customFromIso && customToIso) {
    const from = parseArIsoDate(customFromIso);
    const toExclusive = new Date(parseArIsoDate(customToIso).getTime() + MS_DAY);
    const dayCount = Math.max(
      1,
      Math.round((toExclusive.getTime() - from.getTime()) / MS_DAY),
    );
    return { from, to: toExclusive, dayCount };
  }

  if (preset === "today") {
    return {
      from: todayMidnight,
      to: new Date(todayMidnight.getTime() + MS_DAY),
      dayCount: 1,
    };
  }
  if (preset === "yesterday") {
    return {
      from: new Date(todayMidnight.getTime() - MS_DAY),
      to: todayMidnight,
      dayCount: 1,
    };
  }
  if (preset === "7d") {
    return {
      from: new Date(todayMidnight.getTime() - 6 * MS_DAY),
      to: new Date(todayMidnight.getTime() + MS_DAY),
      dayCount: 7,
    };
  }
  // 30d default
  return {
    from: new Date(todayMidnight.getTime() - 29 * MS_DAY),
    to: new Date(todayMidnight.getTime() + MS_DAY),
    dayCount: 30,
  };
}

/**
 * Devuelve el período inmediatamente anterior con la misma duración.
 * Si el rango actual es [from, to) y dura D días, esto devuelve
 * [from - D, from).
 */
export function previousPeriod(p: ActivityPeriod): ActivityPeriod {
  const len = p.to.getTime() - p.from.getTime();
  return {
    from: new Date(p.from.getTime() - len),
    to: p.from,
    dayCount: p.dayCount,
  };
}

/** AR-local 00:00 del día que contiene `ts`, expresado en UTC */
export function arLocalMidnightUtc(ts: number): Date {
  const localMs = ts - AR_OFFSET_MS;
  const local = new Date(localMs);
  const localMidnightLocalMs = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  return new Date(localMidnightLocalMs + AR_OFFSET_MS);
}

/** "YYYY-MM-DD" AR-local → UTC instant 00:00 AR de ese día */
function parseArIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) throw new Error(`Invalid date ${iso}`);
  const localMidnightLocalMs = Date.UTC(y, m - 1, d);
  return new Date(localMidnightLocalMs + AR_OFFSET_MS);
}

/** UTC instant → "YYYY-MM-DD" AR-local */
export function ymdAr(ts: number): string {
  const local = new Date(ts - AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Itera todos los días AR-local dentro del período · devuelve los YMD */
export function* iterDays(p: ActivityPeriod): Generator<string> {
  let cursor = p.from.getTime();
  const end = p.to.getTime();
  while (cursor < end) {
    yield ymdAr(cursor);
    cursor += MS_DAY;
  }
}

// ═══════════════════════════════════════════════════════════════
//  getActivityPivot · usado por la pantalla Reportes
// ═══════════════════════════════════════════════════════════════

export interface ActivityPivotRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  vehicleType: string;
  groupId: string | null;
  groupName: string | null;
  /** Por día (clave YYYY-MM-DD) · valor según métrica seleccionada */
  byDay: Record<string, number>;
  /** Total de la fila (sum o max según METRIC_AGG[metric]) */
  total: number;
}

export interface ActivityPivot {
  period: ActivityPeriod;
  metric: ActivityMetric;
  metricLabel: string;
  /** Lista ordenada de YYYY-MM-DD que cubren el período */
  days: string[];
  rows: ActivityPivotRow[];
  /** Total de cada día (suma o máx · según métrica) */
  dayTotals: Record<string, number>;
  /** Total general · suma/max de los totales por día */
  grandTotal: number;
}

interface PivotParams {
  period: ActivityPeriod;
  metric: ActivityMetric;
  /** Filtros opcionales (futuro) */
  groupId?: string | null;
  vehicleType?: string | null;
}

/**
 * Pivotea (asset, day) → métrica para la pantalla Reportes.
 * Lee de AssetDriverDay para las métricas operativas básicas (km,
 * activeMin, tripCount). Para las métricas de eventos/velocidad
 * se complementa con Event (eventCount, highEventCount, speeding,
 * maxSpeed). Idle y fuel se aproximan de momento.
 */
export async function getActivityPivot(
  params: PivotParams,
): Promise<ActivityPivot> {
  const { period, metric } = params;
  const days = Array.from(iterDays(period));

  // 1 · cargar todos los assets activos del account (mobile)
  const assets = await db.asset.findMany({
    where: {
      mobilityType: "MOBILE",
      ...(params.groupId ? { groupId: params.groupId } : {}),
      ...(params.vehicleType ? { vehicleType: params.vehicleType } : {}),
    },
    select: {
      id: true,
      name: true,
      plate: true,
      vehicleType: true,
      groupId: true,
      group: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  // 2 · cargar AssetDriverDay del rango
  const driverDays = await db.assetDriverDay.findMany({
    where: {
      day: { gte: period.from, lt: period.to },
      asset: { mobilityType: "MOBILE" },
    },
    select: {
      assetId: true,
      day: true,
      distanceKm: true,
      activeMin: true,
      tripCount: true,
    },
  });

  // 3 · si la métrica lo requiere, cargar Event aggregations
  const needEvents =
    metric === "eventCount" ||
    metric === "highEventCount" ||
    metric === "speedingCount";
  const eventsByAssetDay = new Map<string, Map<string, number>>();
  if (needEvents) {
    const events = await db.event.findMany({
      where: {
        occurredAt: { gte: period.from, lt: period.to },
      },
      select: {
        assetId: true,
        type: true,
        severity: true,
        occurredAt: true,
      },
    });
    for (const ev of events as any[]) {
      if (metric === "highEventCount") {
        if (ev.severity !== "HIGH" && ev.severity !== "CRITICAL") continue;
      } else if (metric === "speedingCount") {
        if (!isSpeedingType(ev.type)) continue;
      }
      const ymd = ymdAr(ev.occurredAt.getTime());
      let inner = eventsByAssetDay.get(ev.assetId);
      if (!inner) {
        inner = new Map();
        eventsByAssetDay.set(ev.assetId, inner);
      }
      inner.set(ymd, (inner.get(ymd) ?? 0) + 1);
    }
  }

  // 4 · si la métrica es maxSpeed, leer Trip.maxSpeedKmh agregado
  const speedByAssetDay = new Map<string, Map<string, number>>();
  if (metric === "maxSpeedKmh") {
    const trips = await db.trip.findMany({
      where: {
        startedAt: { gte: period.from, lt: period.to },
        asset: { mobilityType: "MOBILE" },
      },
      select: {
        assetId: true,
        startedAt: true,
        maxSpeedKmh: true,
      },
    });
    for (const t of trips as any[]) {
      const ymd = ymdAr(t.startedAt.getTime());
      let inner = speedByAssetDay.get(t.assetId);
      if (!inner) {
        inner = new Map();
        speedByAssetDay.set(t.assetId, inner);
      }
      const cur = inner.get(ymd) ?? 0;
      if (t.maxSpeedKmh > cur) inner.set(ymd, t.maxSpeedKmh);
    }
  }

  // 5 · build rows
  const rows: ActivityPivotRow[] = assets.map((a: any) => {
    const byDay: Record<string, number> = {};
    for (const d of days) byDay[d] = 0;
    return {
      assetId: a.id,
      assetName: a.name,
      assetPlate: a.plate,
      vehicleType: a.vehicleType ?? "GENERIC",
      groupId: a.groupId,
      groupName: a.group?.name ?? null,
      byDay,
      total: 0,
    };
  });
  const rowById = new Map(rows.map((r) => [r.assetId, r]));

  // Populate from driverDays
  for (const dd of driverDays as any[]) {
    const row = rowById.get(dd.assetId);
    if (!row) continue;
    const ymd = ymdAr(dd.day.getTime());
    if (!(ymd in row.byDay)) continue;
    if (metric === "distanceKm")
      row.byDay[ymd] = (row.byDay[ymd] ?? 0) + dd.distanceKm;
    else if (metric === "activeMin")
      row.byDay[ymd] = (row.byDay[ymd] ?? 0) + dd.activeMin;
    else if (metric === "tripCount")
      row.byDay[ymd] = (row.byDay[ymd] ?? 0) + dd.tripCount;
    else if (metric === "idleMin") {
      // idle is not tracked per day yet · approximate as 0 here
      // (will be filled when AssetWeeklyStats's idleMin gets a
      // daily counterpart). For now Reportes shows 0 for idle.
    } else if (metric === "fuelLiters") {
      // approximate · 0.12 L/min of activeMin (~7 L/h)
      row.byDay[ymd] = (row.byDay[ymd] ?? 0) + dd.activeMin * 0.12;
    }
  }

  // Populate from event maps
  if (needEvents) {
    for (const [assetId, inner] of eventsByAssetDay) {
      const row = rowById.get(assetId);
      if (!row) continue;
      for (const [ymd, count] of inner) {
        if (ymd in row.byDay)
          row.byDay[ymd] = (row.byDay[ymd] ?? 0) + count;
      }
    }
  }
  if (metric === "maxSpeedKmh") {
    for (const [assetId, inner] of speedByAssetDay) {
      const row = rowById.get(assetId);
      if (!row) continue;
      for (const [ymd, sp] of inner) {
        if (ymd in row.byDay) row.byDay[ymd] = sp;
      }
    }
  }

  // Compute totals
  const agg = METRIC_AGG[metric];
  for (const row of rows) {
    if (agg === "sum") {
      row.total = days.reduce((acc, d) => acc + (row.byDay[d] ?? 0), 0);
    } else {
      row.total = days.reduce(
        (acc, d) => Math.max(acc, row.byDay[d] ?? 0),
        0,
      );
    }
  }

  // Day totals across all rows
  const dayTotals: Record<string, number> = {};
  for (const d of days) {
    if (agg === "sum") {
      dayTotals[d] = rows.reduce((acc, r) => acc + (r.byDay[d] ?? 0), 0);
    } else {
      dayTotals[d] = rows.reduce(
        (acc, r) => Math.max(acc, r.byDay[d] ?? 0),
        0,
      );
    }
  }
  const grandTotal =
    agg === "sum"
      ? Object.values(dayTotals).reduce((a, b) => a + b, 0)
      : Object.values(dayTotals).reduce((a, b) => Math.max(a, b), 0);

  // Sort rows by total desc · most-active first (always meaningful)
  rows.sort((a, b) => b.total - a.total);

  return {
    period,
    metric,
    metricLabel: METRIC_LABELS[metric],
    days,
    rows,
    dayTotals,
    grandTotal,
  };
}

/** Heuristic: which Event types count as "infracciones" (speeding) */
function isSpeedingType(t: string): boolean {
  return (
    t === "SPEEDING" ||
    t === "OVER_SPEED" ||
    t === "OVERSPEEDING" ||
    t.includes("SPEED")
  );
}

// ═══════════════════════════════════════════════════════════════
//  getActivitySummary · usado por la pantalla Resumen
// ═══════════════════════════════════════════════════════════════

export interface HeadlineKpi {
  metric: ActivityMetric;
  label: string;
  current: number;
  previous: number | null;
  /** delta como ratio · null si no hay prev o prev==0 */
  deltaPct: number | null;
}

export interface OutlierRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  /** Cuál métrica disparó el outlier */
  metric: ActivityMetric;
  metricLabel: string;
  /** Valor del período actual */
  currentValue: number;
  /** Promedio histórico (semanas previas en AssetWeeklyStats) */
  baselineValue: number;
  /** Ratio current / baseline · 1.0 = igual al promedio */
  ratio: number;
  /** Tipo de anomalía */
  kind: "spike-high" | "spike-low";
  /** Razón legible */
  reason: string;
}

export interface TopRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  groupName: string | null;
  value: number;
}

export interface SparklineRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  /** Valores diarios de la métrica para el período actual */
  series: number[];
  /** Total · suma o max según métrica */
  total: number;
  /** Etiqueta del día con valor pico (YYYY-MM-DD) */
  peakDay: string | null;
}

export interface ActivitySummary {
  period: ActivityPeriod;
  previousPeriod: ActivityPeriod;
  headlines: HeadlineKpi[];
  outliers: OutlierRow[];
  topByMetric: {
    metric: ActivityMetric;
    metricLabel: string;
    rows: TopRow[];
  };
  sparklines: SparklineRow[];
}

interface SummaryParams {
  period: ActivityPeriod;
  /** Métrica para Top-5 · default distanceKm */
  topMetric?: ActivityMetric;
  /** Métrica para sparklines · default distanceKm */
  sparkMetric?: ActivityMetric;
}

/**
 * Carga el snapshot del Resumen en una sola pasada.
 *
 * Estrategia:
 *   1. Pivot del período actual (todas las métricas headline)
 *   2. Pivot del período anterior (mismo, para deltas)
 *   3. Para outliers · leer AssetWeeklyStats · promedio de las
 *      últimas N semanas previas como baseline. Comparar contra
 *      el período actual. Marcar spike si ratio fuera de [0.4, 2.0].
 *   4. Top-5 · ordenar el pivot por total desc
 *   5. Sparklines · reusar el pivot per-day
 */
export async function getActivitySummary(
  params: SummaryParams,
): Promise<ActivitySummary> {
  const { period } = params;
  const topMetric = params.topMetric ?? "distanceKm";
  const sparkMetric = params.sparkMetric ?? "distanceKm";
  const prev = previousPeriod(period);

  // Headlines: 4 métricas clave en una sola pasada por pivot
  const HEADLINE_METRICS: ActivityMetric[] = [
    "distanceKm",
    "activeMin",
    "fuelLiters",
    "speedingCount",
  ];

  const [curPivots, prevPivots, sparkPivot] = await Promise.all([
    Promise.all(
      HEADLINE_METRICS.map((m) =>
        getActivityPivot({ period, metric: m }),
      ),
    ),
    Promise.all(
      HEADLINE_METRICS.map((m) =>
        getActivityPivot({ period: prev, metric: m }),
      ),
    ),
    sparkMetric === topMetric
      ? null
      : getActivityPivot({ period, metric: sparkMetric }),
  ]);

  // Build headlines
  const headlines: HeadlineKpi[] = HEADLINE_METRICS.map((m, i) => {
    const cur = curPivots[i]!.grandTotal;
    const prv = prevPivots[i]!.grandTotal;
    const deltaPct = prv === 0 ? null : (cur - prv) / prv;
    return {
      metric: m,
      label: METRIC_LABELS[m],
      current: cur,
      previous: prv,
      deltaPct,
    };
  });

  // Top-5 by topMetric: reuse cur pivot if matches, else fetch
  let topPivot =
    HEADLINE_METRICS.indexOf(topMetric) >= 0
      ? curPivots[HEADLINE_METRICS.indexOf(topMetric)]!
      : await getActivityPivot({ period, metric: topMetric });
  const topByMetric = {
    metric: topMetric,
    metricLabel: METRIC_LABELS[topMetric],
    rows: topPivot.rows.slice(0, 5).map((r): TopRow => ({
      assetId: r.assetId,
      assetName: r.assetName,
      assetPlate: r.assetPlate,
      groupName: r.groupName,
      value: r.total,
    })),
  };

  // Sparklines: reuse if same metric, else use the dedicated sparkPivot
  const sparkSource =
    sparkMetric === topMetric
      ? topPivot
      : (sparkPivot as ActivityPivot);
  const sparklines: SparklineRow[] = sparkSource.rows
    .filter((r) => r.total > 0)
    .map((r): SparklineRow => {
      const series = sparkSource.days.map((d) => r.byDay[d] ?? 0);
      const peakIdx = series.reduce(
        (best, v, i) => (v > series[best]! ? i : best),
        0,
      );
      return {
        assetId: r.assetId,
        assetName: r.assetName,
        assetPlate: r.assetPlate,
        series,
        total: r.total,
        peakDay: sparkSource.days[peakIdx] ?? null,
      };
    })
    .slice(0, 30); // limit · si hace falta más, sale a Reportes

  // Outliers · usar AssetWeeklyStats como baseline
  const outliers = await detectOutliers(period, curPivots);

  return {
    period,
    previousPeriod: prev,
    headlines,
    outliers,
    topByMetric,
    sparklines,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Outlier detection
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta vehículos cuyas métricas del período actual se salen
 * fuera de banda [0.4×, 2.0×] del promedio de las 4 semanas
 * previas (en AssetWeeklyStats).
 *
 * Solo se reportan outliers en métricas operativas significativas:
 * distanceKm, activeMin, speedingCount.
 *
 * Para que el outlier sea válido el baseline debe ser >= un piso
 * mínimo (sino "0 km la semana pasada → 1 km esta semana" sale
 * como spike de infinito).
 */
async function detectOutliers(
  period: ActivityPeriod,
  curPivots: ActivityPivot[],
): Promise<OutlierRow[]> {
  // Index headline pivots by metric
  const curByMetric: Record<string, ActivityPivot> = {};
  for (const p of curPivots) curByMetric[p.metric] = p;

  // Compute period length in days · used to scale baseline weekly
  // averages to the same window.
  const periodDays = period.dayCount;
  const periodWeekScale = periodDays / 7;

  // Read the last 4 weeks of AssetWeeklyStats prior to the period.
  // We want weeks whose weekStart < period.from but >= period.from - 28d.
  const baselineFrom = new Date(period.from.getTime() - 28 * MS_DAY);
  const weeklyRows = await db.assetWeeklyStats.findMany({
    where: {
      weekStart: { gte: baselineFrom, lt: period.from },
    },
    select: {
      assetId: true,
      distanceKm: true,
      activeMin: true,
      speedingCount: true,
    },
  });

  // Aggregate baseline per asset · simple mean per week
  interface Baseline {
    weekCount: number;
    distanceKm: number;
    activeMin: number;
    speedingCount: number;
  }
  const baselineByAsset = new Map<string, Baseline>();
  for (const w of weeklyRows as any[]) {
    const cur = baselineByAsset.get(w.assetId);
    if (cur) {
      cur.weekCount += 1;
      cur.distanceKm += w.distanceKm;
      cur.activeMin += w.activeMin;
      cur.speedingCount += w.speedingCount;
    } else {
      baselineByAsset.set(w.assetId, {
        weekCount: 1,
        distanceKm: w.distanceKm,
        activeMin: w.activeMin,
        speedingCount: w.speedingCount,
      });
    }
  }

  const FLOORS: Record<string, number> = {
    distanceKm: 50, // si manejaba <50 km/sem en promedio, ignorar
    activeMin: 60, // <60 min/sem
    speedingCount: 1, // necesita al menos 1 evento/sem para considerar
  };

  const out: OutlierRow[] = [];
  const seenAssetIds = new Set<string>();

  for (const metric of ["distanceKm", "activeMin", "speedingCount"] as const) {
    const pivot = curByMetric[metric];
    if (!pivot) continue;
    for (const row of pivot.rows) {
      const baseline = baselineByAsset.get(row.assetId);
      if (!baseline) continue;
      const baselineWeekly = baseline[metric] / baseline.weekCount;
      if (baselineWeekly < FLOORS[metric]!) continue;
      const expected = baselineWeekly * periodWeekScale;
      if (expected <= 0) continue;
      const ratio = row.total / expected;
      let kind: OutlierRow["kind"] | null = null;
      let reason = "";
      if (ratio >= 2.0) {
        kind = "spike-high";
        reason = `${formatRatio(ratio)} de su promedio (${METRIC_LABELS[metric]})`;
      } else if (ratio <= 0.4 && metric !== "speedingCount") {
        // No marcamos "drop" en speeding · que baje las
        // infracciones es bueno, no anomalía a investigar.
        kind = "spike-low";
        reason = `${formatRatio(ratio)} de su promedio (${METRIC_LABELS[metric]})`;
      }
      if (!kind) continue;
      // Avoid duplicate · sólo el primer hit por asset
      if (seenAssetIds.has(row.assetId)) continue;
      seenAssetIds.add(row.assetId);
      out.push({
        assetId: row.assetId,
        assetName: row.assetName,
        assetPlate: row.assetPlate,
        metric,
        metricLabel: METRIC_LABELS[metric],
        currentValue: row.total,
        baselineValue: expected,
        ratio,
        kind,
        reason,
      });
    }
  }

  // Sort by absolute ratio distance from 1.0 · más anómalos primero
  out.sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1));
  return out.slice(0, 8);
}

function formatRatio(ratio: number): string {
  if (ratio >= 1) return `${ratio.toFixed(1)}×`;
  return `${Math.round(ratio * 100)}%`;
}
