// ═══════════════════════════════════════════════════════════════
//  Queries · Análisis temporal
//  ─────────────────────────────────────────────────────────────
//  Una sola query · getAnalysisData · sirve a las 5 granularidades:
//    · day-hours    · 24 columnas
//    · week-days    · 7 columnas
//    · month-days   · grid calendario
//    · year-weeks   · 7 filas (DOW) × 53 cols · estilo GitHub
//    · year-months  · 12 columnas
//
//  Fuentes:
//    · day-hours  → Trip + Event (hora-grain dinámico)
//    · week-days, month-days, year-weeks → AssetDriverDay
//    · year-months → AssetWeeklyStats agregado a mes
//
//  Cero lecturas a Position.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  arLocalMidnightUtc,
  iterDays,
  METRIC_LABELS,
  type ActivityMetric,
  type ActivityPeriod,
} from "./activity";

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;
const MS_HOUR = 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
//  Tipos
// ═══════════════════════════════════════════════════════════════

export type AnalysisGranularity =
  | "day-hours"
  | "week-days"
  | "month-days"
  | "year-weeks"
  | "year-months";

export interface AnalysisCell {
  /** Identificador estable · usado como key React */
  key: string;
  /** Etiqueta corta dentro de la celda (ej "27", "Lun", "13:00") */
  shortLabel: string;
  /** Etiqueta larga para tooltip (ej "Lunes 27 abril 2026") */
  fullLabel: string;
  /** Valor de la métrica en esta celda */
  value: number;
  /** Posición row,col en el grid (0-indexed) */
  row: number;
  col: number;
  /** Si la celda representa una fecha real (false = hueco del calendario) */
  hasData: boolean;
  /** Si esta celda representa al día/hora actual */
  isToday: boolean;
  /** Si esta celda corresponde al fin de semana */
  isWeekend: boolean;
  /** ISO date AR-local · para drill-down (null si no se puede bajar) */
  drillDate: string | null;
  /** Granularidad a la que se baja al hacer click (null = no drill) */
  drillTo: AnalysisGranularity | null;
}

export interface TrendPoint {
  /** Etiqueta del punto (X axis) */
  label: string;
  /** Valor numérico */
  value: number;
  /** ISO date · usado para tooltip */
  iso: string;
}

export interface TopAssetRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  groupName: string | null;
  value: number;
}

export interface AnalysisData {
  granularity: AnalysisGranularity;
  metric: ActivityMetric;
  metricLabel: string;
  /** UTC instants del rango total */
  periodFrom: Date;
  periodTo: Date;
  /** Etiqueta legible (ej "Abril 2026", "Semana del 21/04 al 27/04") */
  periodLabel: string;
  /** "DD/MM/YYYY → DD/MM/YYYY" o similar */
  periodSubLabel: string;
  /** Valor total (suma o max según métrica) */
  total: number;
  /** Total del período anterior equivalente · null si no aplica */
  previousTotal: number | null;
  /** Delta % vs anterior · null si previo == 0 o null */
  deltaPct: number | null;
  /** Filas y columnas del grid · usadas por el componente Heatmap */
  rows: number;
  cols: number;
  /** Etiquetas de filas (ej DOW) · vacío si no hay row labels */
  rowLabels: string[];
  /** Etiquetas de columnas (ej meses, semanas) · vacío si no hay */
  colLabels: { label: string; col: number }[];
  /** Las celdas del heatmap */
  cells: AnalysisCell[];
  /** Máximo de las celdas · usado para escala de intensidad */
  maxCellValue: number;
  /** Datos para el line chart de evolución (granularidad = celda) */
  trend: TrendPoint[];
  /** Top 5 vehículos del período */
  topAssets: TopAssetRow[];
  /** ISO date del período centrado · usado por nav prev/next */
  anchorIso: string;
  /** Para nav · ISO date del período anterior y siguiente */
  prevAnchorIso: string;
  nextAnchorIso: string | null; // null si es futuro
}

interface AnalysisParams {
  granularity: AnalysisGranularity;
  /** ISO date YYYY-MM-DD · el ancla del período (interpretado AR-local) */
  anchor: string;
  metric: ActivityMetric;
  /** Para cálculo de "isToday" · default Date.now() */
  now?: number;
}

// ═══════════════════════════════════════════════════════════════
//  Public · getAnalysisData
// ═══════════════════════════════════════════════════════════════

export async function getAnalysisData(
  params: AnalysisParams,
): Promise<AnalysisData> {
  const now = params.now ?? Date.now();
  const anchorDate = parseArIso(params.anchor);

  switch (params.granularity) {
    case "day-hours":
      return buildDayHours(anchorDate, params.metric, now);
    case "week-days":
      return buildWeekDays(anchorDate, params.metric, now);
    case "month-days":
      return buildMonthDays(anchorDate, params.metric, now);
    case "year-weeks":
      return buildYearWeeks(anchorDate, params.metric, now);
    case "year-months":
      return buildYearMonths(anchorDate, params.metric, now);
  }
}

// ═══════════════════════════════════════════════════════════════
//  Day · 24 horas (Trip + Event grain dinámico)
// ═══════════════════════════════════════════════════════════════

async function buildDayHours(
  anchor: Date,
  metric: ActivityMetric,
  now: number,
): Promise<AnalysisData> {
  // Período: 24h AR-local del día anchor
  const periodFrom = anchor;
  const periodTo = new Date(anchor.getTime() + MS_DAY);

  // Hour bins
  const hourValues = new Array(24).fill(0) as number[];

  if (
    metric === "distanceKm" ||
    metric === "activeMin" ||
    metric === "tripCount" ||
    metric === "fuelLiters" ||
    metric === "maxSpeedKmh"
  ) {
    const trips = await db.trip.findMany({
      where: { startedAt: { gte: periodFrom, lt: periodTo } },
      select: {
        startedAt: true,
        endedAt: true,
        distanceKm: true,
        maxSpeedKmh: true,
      },
    });
    for (const t of trips as any[]) {
      const hour = arLocalHour(t.startedAt.getTime());
      if (metric === "distanceKm") hourValues[hour]! += t.distanceKm;
      else if (metric === "tripCount") hourValues[hour]! += 1;
      else if (metric === "activeMin") {
        const mins = (t.endedAt.getTime() - t.startedAt.getTime()) / 60_000;
        hourValues[hour]! += mins;
      } else if (metric === "fuelLiters") {
        const mins = (t.endedAt.getTime() - t.startedAt.getTime()) / 60_000;
        hourValues[hour]! += mins * 0.12;
      } else if (metric === "maxSpeedKmh") {
        if (t.maxSpeedKmh > hourValues[hour]!)
          hourValues[hour] = t.maxSpeedKmh;
      }
    }
  } else if (
    metric === "eventCount" ||
    metric === "highEventCount" ||
    metric === "speedingCount"
  ) {
    const events = await db.event.findMany({
      where: { occurredAt: { gte: periodFrom, lt: periodTo } },
      select: { occurredAt: true, type: true, severity: true },
    });
    for (const ev of events as any[]) {
      if (metric === "highEventCount") {
        if (ev.severity !== "HIGH" && ev.severity !== "CRITICAL") continue;
      } else if (metric === "speedingCount") {
        if (!isSpeedingType(String(ev.type))) continue;
      }
      const hour = arLocalHour(ev.occurredAt.getTime());
      hourValues[hour]! += 1;
    }
  }

  const total = hourValues.reduce((a, b) => a + b, 0);
  const maxCell = Math.max(0, ...hourValues);
  const todayHour =
    sameArLocalDay(anchor.getTime(), now) ? arLocalHour(now) : -1;

  const cells: AnalysisCell[] = hourValues.map((v, h) => ({
    key: `h-${h}`,
    shortLabel: `${String(h).padStart(2, "0")}h`,
    fullLabel: `${formatDayLong(anchor)} · ${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59`,
    value: v,
    row: 0,
    col: h,
    hasData: true,
    isToday: h === todayHour,
    isWeekend: false,
    drillDate: null,
    drillTo: null,
  }));

  const trend: TrendPoint[] = hourValues.map((v, h) => ({
    label: `${String(h).padStart(2, "0")}h`,
    value: v,
    iso: ymdAr(anchor.getTime()),
  }));

  const topAssets = await topAssetsForRange(periodFrom, periodTo, metric);
  const previousTotal = await totalForRange(
    new Date(periodFrom.getTime() - MS_DAY),
    periodFrom,
    metric,
  );

  return {
    granularity: "day-hours",
    metric,
    metricLabel: METRIC_LABELS[metric],
    periodFrom,
    periodTo,
    periodLabel: formatDayLong(anchor),
    periodSubLabel: ymdAr(anchor.getTime()),
    total,
    previousTotal,
    deltaPct: pct(total, previousTotal),
    rows: 1,
    cols: 24,
    rowLabels: [],
    colLabels: [
      { label: "00h", col: 0 },
      { label: "06h", col: 6 },
      { label: "12h", col: 12 },
      { label: "18h", col: 18 },
    ],
    cells,
    maxCellValue: maxCell,
    trend,
    topAssets,
    anchorIso: ymdAr(anchor.getTime()),
    prevAnchorIso: ymdAr(anchor.getTime() - MS_DAY),
    nextAnchorIso:
      anchor.getTime() + MS_DAY <= arLocalMidnightUtc(now).getTime() + MS_DAY
        ? ymdAr(anchor.getTime() + MS_DAY)
        : null,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Week · 7 días (AssetDriverDay)
// ═══════════════════════════════════════════════════════════════

async function buildWeekDays(
  anchor: Date,
  metric: ActivityMetric,
  now: number,
): Promise<AnalysisData> {
  // anchor = lunes de la semana
  const monday = arLocalMondayUtc(anchor.getTime());
  const periodFrom = monday;
  const periodTo = new Date(monday.getTime() + 7 * MS_DAY);

  const dayValues = await metricByDay(periodFrom, periodTo, metric);
  const total = sumValues(dayValues, metric);
  const maxCell = Math.max(0, ...dayValues.map((d) => d.value));
  const todayIso = ymdAr(now);

  const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const cells: AnalysisCell[] = dayValues.map((d, i) => ({
    key: `d-${d.iso}`,
    shortLabel: DAY_LABELS[i] ?? "",
    fullLabel: formatDayLong(parseArIso(d.iso)),
    value: d.value,
    row: 0,
    col: i,
    hasData: true,
    isToday: d.iso === todayIso,
    isWeekend: i >= 5,
    drillDate: d.iso,
    drillTo: "day-hours",
  }));

  const trend: TrendPoint[] = dayValues.map((d, i) => ({
    label: DAY_LABELS[i] ?? "",
    value: d.value,
    iso: d.iso,
  }));

  const topAssets = await topAssetsForRange(periodFrom, periodTo, metric);
  const previousTotal = await totalForRange(
    new Date(monday.getTime() - 7 * MS_DAY),
    monday,
    metric,
  );

  const fmtDay = (d: Date) => {
    const local = new Date(d.getTime() - AR_OFFSET_MS);
    return `${String(local.getUTCDate()).padStart(2, "0")}/${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const lastDay = new Date(periodTo.getTime() - 1);
  const isFutureWeek = monday.getTime() + 7 * MS_DAY > arLocalMidnightUtc(now).getTime();

  return {
    granularity: "week-days",
    metric,
    metricLabel: METRIC_LABELS[metric],
    periodFrom,
    periodTo,
    periodLabel: `Semana del ${fmtDay(monday)} al ${fmtDay(lastDay)}`,
    periodSubLabel: `${ymdAr(monday.getTime())} → ${ymdAr(lastDay.getTime())}`,
    total,
    previousTotal,
    deltaPct: pct(total, previousTotal),
    rows: 1,
    cols: 7,
    rowLabels: [],
    colLabels: [],
    cells,
    maxCellValue: maxCell,
    trend,
    topAssets,
    anchorIso: ymdAr(monday.getTime()),
    prevAnchorIso: ymdAr(monday.getTime() - 7 * MS_DAY),
    nextAnchorIso: isFutureWeek ? null : ymdAr(monday.getTime() + 7 * MS_DAY),
  };
}

// ═══════════════════════════════════════════════════════════════
//  Month · grid calendario (AssetDriverDay)
// ═══════════════════════════════════════════════════════════════

async function buildMonthDays(
  anchor: Date,
  metric: ActivityMetric,
  now: number,
): Promise<AnalysisData> {
  // First day of the month AR-local
  const firstLocal = new Date(anchor.getTime() - AR_OFFSET_MS);
  const monthStart = new Date(
    Date.UTC(firstLocal.getUTCFullYear(), firstLocal.getUTCMonth(), 1) +
      AR_OFFSET_MS,
  );
  const monthEnd = new Date(
    Date.UTC(firstLocal.getUTCFullYear(), firstLocal.getUTCMonth() + 1, 1) +
      AR_OFFSET_MS,
  );
  const daysInMonth = Math.round(
    (monthEnd.getTime() - monthStart.getTime()) / MS_DAY,
  );

  const dayValues = await metricByDay(monthStart, monthEnd, metric);
  const total = sumValues(dayValues, metric);
  const maxCell = Math.max(0, ...dayValues.map((d) => d.value));
  const todayIso = ymdAr(now);

  // Calendar grid: rows = weeks (5-6), cols = Mon-Sun
  // Determine the day of week of the 1st (AR-local · Mon=0..Sun=6)
  const firstDow = arLocalDow(monthStart.getTime());
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const rows = totalCells / 7;

  const valueByIso = new Map(dayValues.map((d) => [d.iso, d.value]));
  const cells: AnalysisCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOfMonth = i - firstDow + 1;
    const row = Math.floor(i / 7);
    const col = i % 7;
    if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
      cells.push({
        key: `pad-${i}`,
        shortLabel: "",
        fullLabel: "",
        value: 0,
        row,
        col,
        hasData: false,
        isToday: false,
        isWeekend: col >= 5,
        drillDate: null,
        drillTo: null,
      });
    } else {
      const dayUtc = new Date(monthStart.getTime() + (dayOfMonth - 1) * MS_DAY);
      const iso = ymdAr(dayUtc.getTime());
      cells.push({
        key: `d-${iso}`,
        shortLabel: String(dayOfMonth),
        fullLabel: formatDayLong(dayUtc),
        value: valueByIso.get(iso) ?? 0,
        row,
        col,
        hasData: true,
        isToday: iso === todayIso,
        isWeekend: col >= 5,
        drillDate: iso,
        drillTo: "day-hours",
      });
    }
  }

  const trend: TrendPoint[] = dayValues.map((d) => {
    const local = new Date(parseArIso(d.iso).getTime() - AR_OFFSET_MS);
    return {
      label: String(local.getUTCDate()),
      value: d.value,
      iso: d.iso,
    };
  });

  const topAssets = await topAssetsForRange(monthStart, monthEnd, metric);
  const prevMonthStart = new Date(
    Date.UTC(firstLocal.getUTCFullYear(), firstLocal.getUTCMonth() - 1, 1) +
      AR_OFFSET_MS,
  );
  const previousTotal = await totalForRange(prevMonthStart, monthStart, metric);

  const isFutureMonth = monthStart.getTime() > arLocalMidnightUtc(now).getTime();
  const nextMonthStart = monthEnd;

  return {
    granularity: "month-days",
    metric,
    metricLabel: METRIC_LABELS[metric],
    periodFrom: monthStart,
    periodTo: monthEnd,
    periodLabel: formatMonthLong(monthStart),
    periodSubLabel: `${daysInMonth} días`,
    total,
    previousTotal,
    deltaPct: pct(total, previousTotal),
    rows,
    cols: 7,
    rowLabels: [],
    colLabels: [],
    cells,
    maxCellValue: maxCell,
    trend,
    topAssets,
    anchorIso: ymdAr(monthStart.getTime()),
    prevAnchorIso: ymdAr(prevMonthStart.getTime()),
    nextAnchorIso:
      nextMonthStart.getTime() > arLocalMidnightUtc(now).getTime() + MS_DAY
        ? null
        : ymdAr(nextMonthStart.getTime()),
  };
}

// ═══════════════════════════════════════════════════════════════
//  Year · 53 semanas (estilo GitHub) · 7 filas DOW × 53 cols
// ═══════════════════════════════════════════════════════════════

async function buildYearWeeks(
  anchor: Date,
  metric: ActivityMetric,
  now: number,
): Promise<AnalysisData> {
  // El año termina hoy y arranca 364 días atrás (53 semanas inclusive)
  const todayMidnight = arLocalMidnightUtc(now);
  // El final de la grilla es el domingo de la semana actual
  const monday = arLocalMondayUtc(now);
  const sundayEnd = new Date(monday.getTime() + 7 * MS_DAY);
  // Inicio: 52 semanas atrás, ajustado al lunes
  const startMonday = new Date(monday.getTime() - 52 * 7 * MS_DAY);
  const periodFrom = startMonday;
  const periodTo = sundayEnd;

  const dayValues = await metricByDay(periodFrom, periodTo, metric);
  const valueByIso = new Map(dayValues.map((d) => [d.iso, d.value]));
  const todayIso = ymdAr(now);

  const cells: AnalysisCell[] = [];
  const colLabels: { label: string; col: number }[] = [];
  let currentMonth = -1;
  for (let week = 0; week < 53; week++) {
    for (let dow = 0; dow < 7; dow++) {
      const dayUtc = new Date(
        startMonday.getTime() + (week * 7 + dow) * MS_DAY,
      );
      const iso = ymdAr(dayUtc.getTime());
      const isFuture = dayUtc.getTime() >= todayMidnight.getTime() + MS_DAY;
      cells.push({
        key: `d-${iso}`,
        shortLabel: "",
        fullLabel: isFuture ? "" : formatDayLong(dayUtc),
        value: isFuture ? 0 : valueByIso.get(iso) ?? 0,
        row: dow,
        col: week,
        hasData: !isFuture,
        isToday: iso === todayIso,
        isWeekend: dow >= 5,
        drillDate: isFuture ? null : iso,
        drillTo: isFuture ? null : "day-hours",
      });
    }
    // Track month label · use the first of the week
    const weekStart = new Date(startMonday.getTime() + week * 7 * MS_DAY);
    const localMonth = new Date(weekStart.getTime() - AR_OFFSET_MS).getUTCMonth();
    if (localMonth !== currentMonth) {
      currentMonth = localMonth;
      colLabels.push({ label: MONTH_SHORT[localMonth]!, col: week });
    }
  }

  const total = sumValues(dayValues, metric);
  const maxCell = Math.max(
    0,
    ...cells.filter((c) => c.hasData).map((c) => c.value),
  );

  // Trend · una línea con 53 puntos (suma de la semana)
  const trend: TrendPoint[] = [];
  for (let week = 0; week < 53; week++) {
    const wkStart = new Date(startMonday.getTime() + week * 7 * MS_DAY);
    let sum = 0;
    let max = 0;
    for (let dow = 0; dow < 7; dow++) {
      const dUtc = new Date(wkStart.getTime() + dow * MS_DAY);
      if (dUtc.getTime() >= todayMidnight.getTime() + MS_DAY) break;
      const v = valueByIso.get(ymdAr(dUtc.getTime())) ?? 0;
      sum += v;
      if (v > max) max = v;
    }
    const localM = new Date(wkStart.getTime() - AR_OFFSET_MS);
    trend.push({
      label: `${String(localM.getUTCDate()).padStart(2, "0")}/${String(localM.getUTCMonth() + 1).padStart(2, "0")}`,
      value: metric === "maxSpeedKmh" ? max : sum,
      iso: ymdAr(wkStart.getTime()),
    });
  }

  const topAssets = await topAssetsForRange(periodFrom, periodTo, metric);
  // Previo · año anterior (mismas 53 semanas hacia atrás)
  const prevTotal = await totalForRange(
    new Date(periodFrom.getTime() - 365 * MS_DAY),
    periodFrom,
    metric,
  );

  return {
    granularity: "year-weeks",
    metric,
    metricLabel: METRIC_LABELS[metric],
    periodFrom,
    periodTo,
    periodLabel: "Últimos 12 meses · vista por días",
    periodSubLabel: `${formatMonthLong(periodFrom)} → ${formatMonthLong(new Date(periodTo.getTime() - MS_DAY))}`,
    total,
    previousTotal: prevTotal,
    deltaPct: pct(total, prevTotal),
    rows: 7,
    cols: 53,
    rowLabels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    colLabels,
    cells,
    maxCellValue: maxCell,
    trend,
    topAssets,
    anchorIso: ymdAr(now),
    prevAnchorIso: ymdAr(now - 365 * MS_DAY),
    nextAnchorIso: null,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Year · 12 meses (AssetWeeklyStats agregado a mes)
// ═══════════════════════════════════════════════════════════════

async function buildYearMonths(
  anchor: Date,
  metric: ActivityMetric,
  now: number,
): Promise<AnalysisData> {
  // Año = año del anchor
  const localAnchor = new Date(anchor.getTime() - AR_OFFSET_MS);
  const year = localAnchor.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1) + AR_OFFSET_MS);
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1) + AR_OFFSET_MS);

  // Get values per month (12 buckets)
  const monthValues = new Array(12).fill(0) as number[];

  if (
    metric === "distanceKm" ||
    metric === "activeMin" ||
    metric === "tripCount" ||
    metric === "fuelLiters" ||
    metric === "speedingCount" ||
    metric === "eventCount" ||
    metric === "highEventCount" ||
    metric === "maxSpeedKmh"
  ) {
    // Read AssetDriverDay for activeMin, distanceKm, tripCount
    // For other metrics fall back to AssetWeeklyStats month-bucketing
    const dayValues = await metricByDay(yearStart, yearEnd, metric);
    for (const d of dayValues) {
      const local = new Date(parseArIso(d.iso).getTime() - AR_OFFSET_MS);
      const m = local.getUTCMonth();
      if (metric === "maxSpeedKmh") {
        if (d.value > monthValues[m]!) monthValues[m] = d.value;
      } else {
        monthValues[m]! += d.value;
      }
    }
  }

  const total = metric === "maxSpeedKmh"
    ? Math.max(0, ...monthValues)
    : monthValues.reduce((a, b) => a + b, 0);
  const maxCell = Math.max(0, ...monthValues);
  const todayMonth = new Date(now - AR_OFFSET_MS).getUTCMonth();
  const todayYear = new Date(now - AR_OFFSET_MS).getUTCFullYear();

  const cells: AnalysisCell[] = monthValues.map((v, m) => {
    const monthStartLocal = Date.UTC(year, m, 1);
    const isFuture = monthStartLocal > now - AR_OFFSET_MS;
    return {
      key: `m-${m}`,
      shortLabel: MONTH_SHORT[m]!,
      fullLabel: `${MONTH_LONG[m]!} ${year}`,
      value: isFuture ? 0 : v,
      row: 0,
      col: m,
      hasData: !isFuture,
      isToday: year === todayYear && m === todayMonth,
      isWeekend: false,
      drillDate: ymdAr(new Date(monthStartLocal + AR_OFFSET_MS).getTime()),
      drillTo: isFuture ? null : "month-days",
    };
  });

  const trend: TrendPoint[] = monthValues.map((v, m) => ({
    label: MONTH_SHORT[m]!,
    value: v,
    iso: `${year}-${String(m + 1).padStart(2, "0")}-01`,
  }));

  const topAssets = await topAssetsForRange(yearStart, yearEnd, metric);
  const prevYearStart = new Date(Date.UTC(year - 1, 0, 1) + AR_OFFSET_MS);
  const previousTotal = await totalForRange(prevYearStart, yearStart, metric);

  return {
    granularity: "year-months",
    metric,
    metricLabel: METRIC_LABELS[metric],
    periodFrom: yearStart,
    periodTo: yearEnd,
    periodLabel: `Año ${year}`,
    periodSubLabel: "Vista por meses",
    total,
    previousTotal,
    deltaPct: pct(total, previousTotal),
    rows: 1,
    cols: 12,
    rowLabels: [],
    colLabels: [],
    cells,
    maxCellValue: maxCell,
    trend,
    topAssets,
    anchorIso: `${year}-01-01`,
    prevAnchorIso: `${year - 1}-01-01`,
    nextAnchorIso: year < todayYear ? `${year + 1}-01-01` : null,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers de queries
// ═══════════════════════════════════════════════════════════════

interface DayBucket {
  iso: string;
  value: number;
}

/** Suma una métrica por día AR-local en un rango */
async function metricByDay(
  from: Date,
  to: Date,
  metric: ActivityMetric,
): Promise<DayBucket[]> {
  // Build all day keys
  const period: ActivityPeriod = {
    from,
    to,
    dayCount: Math.round((to.getTime() - from.getTime()) / MS_DAY),
  };
  const keys = Array.from(iterDays(period));
  const map = new Map<string, number>(keys.map((k) => [k, 0]));

  if (
    metric === "distanceKm" ||
    metric === "activeMin" ||
    metric === "tripCount" ||
    metric === "fuelLiters"
  ) {
    const rows = await db.assetDriverDay.findMany({
      where: { day: { gte: from, lt: to } },
      select: { day: true, distanceKm: true, activeMin: true, tripCount: true },
    });
    for (const r of rows as any[]) {
      const iso = ymdAr(r.day.getTime());
      if (!map.has(iso)) continue;
      let v = 0;
      if (metric === "distanceKm") v = r.distanceKm;
      else if (metric === "activeMin") v = r.activeMin;
      else if (metric === "tripCount") v = r.tripCount;
      else if (metric === "fuelLiters") v = r.activeMin * 0.12;
      map.set(iso, (map.get(iso) ?? 0) + v);
    }
  } else if (
    metric === "eventCount" ||
    metric === "highEventCount" ||
    metric === "speedingCount"
  ) {
    const rows = await db.event.findMany({
      where: { occurredAt: { gte: from, lt: to } },
      select: { occurredAt: true, type: true, severity: true },
    });
    for (const r of rows as any[]) {
      if (metric === "highEventCount") {
        if (r.severity !== "HIGH" && r.severity !== "CRITICAL") continue;
      } else if (metric === "speedingCount") {
        if (!isSpeedingType(String(r.type))) continue;
      }
      const iso = ymdAr(r.occurredAt.getTime());
      if (!map.has(iso)) continue;
      map.set(iso, (map.get(iso) ?? 0) + 1);
    }
  } else if (metric === "maxSpeedKmh") {
    const rows = await db.trip.findMany({
      where: { startedAt: { gte: from, lt: to } },
      select: { startedAt: true, maxSpeedKmh: true },
    });
    for (const r of rows as any[]) {
      const iso = ymdAr(r.startedAt.getTime());
      if (!map.has(iso)) continue;
      const cur = map.get(iso) ?? 0;
      if (r.maxSpeedKmh > cur) map.set(iso, r.maxSpeedKmh);
    }
  }

  return keys.map((iso) => ({ iso, value: map.get(iso) ?? 0 }));
}

async function totalForRange(
  from: Date,
  to: Date,
  metric: ActivityMetric,
): Promise<number> {
  const days = await metricByDay(from, to, metric);
  return sumValues(days, metric);
}

function sumValues(days: DayBucket[], metric: ActivityMetric): number {
  if (metric === "maxSpeedKmh") {
    return Math.max(0, ...days.map((d) => d.value));
  }
  return days.reduce((a, b) => a + b.value, 0);
}

async function topAssetsForRange(
  from: Date,
  to: Date,
  metric: ActivityMetric,
): Promise<TopAssetRow[]> {
  // Para distanceKm/activeMin/tripCount usamos AssetDriverDay agg por asset
  // Para events usamos Event count por asset
  // Para maxSpeed usamos Trip max por asset
  // Para fuel · activeMin × 0.12

  if (
    metric === "distanceKm" ||
    metric === "activeMin" ||
    metric === "tripCount" ||
    metric === "fuelLiters"
  ) {
    const rows = await db.assetDriverDay.findMany({
      where: { day: { gte: from, lt: to } },
      select: {
        assetId: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
        asset: {
          select: {
            name: true,
            plate: true,
            group: { select: { name: true } },
          },
        },
      },
    });
    const agg = new Map<string, TopAssetRow>();
    for (const r of rows as any[]) {
      const cur = agg.get(r.assetId);
      let inc = 0;
      if (metric === "distanceKm") inc = r.distanceKm;
      else if (metric === "activeMin") inc = r.activeMin;
      else if (metric === "tripCount") inc = r.tripCount;
      else if (metric === "fuelLiters") inc = r.activeMin * 0.12;
      if (cur) cur.value += inc;
      else
        agg.set(r.assetId, {
          assetId: r.assetId,
          assetName: r.asset.name,
          assetPlate: r.asset.plate,
          groupName: r.asset.group?.name ?? null,
          value: inc,
        });
    }
    return Array.from(agg.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  if (
    metric === "eventCount" ||
    metric === "highEventCount" ||
    metric === "speedingCount"
  ) {
    const rows = await db.event.findMany({
      where: { occurredAt: { gte: from, lt: to } },
      select: {
        assetId: true,
        type: true,
        severity: true,
        asset: {
          select: {
            name: true,
            plate: true,
            group: { select: { name: true } },
          },
        },
      },
    });
    const agg = new Map<string, TopAssetRow>();
    for (const r of rows as any[]) {
      if (metric === "highEventCount") {
        if (r.severity !== "HIGH" && r.severity !== "CRITICAL") continue;
      } else if (metric === "speedingCount") {
        if (!isSpeedingType(String(r.type))) continue;
      }
      const cur = agg.get(r.assetId);
      if (cur) cur.value += 1;
      else
        agg.set(r.assetId, {
          assetId: r.assetId,
          assetName: r.asset.name,
          assetPlate: r.asset.plate,
          groupName: r.asset.group?.name ?? null,
          value: 1,
        });
    }
    return Array.from(agg.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  // maxSpeedKmh
  const rows = await db.trip.findMany({
    where: { startedAt: { gte: from, lt: to } },
    select: {
      assetId: true,
      maxSpeedKmh: true,
      asset: {
        select: {
          name: true,
          plate: true,
          group: { select: { name: true } },
        },
      },
    },
  });
  const agg = new Map<string, TopAssetRow>();
  for (const r of rows as any[]) {
    const cur = agg.get(r.assetId);
    if (cur) {
      if (r.maxSpeedKmh > cur.value) cur.value = r.maxSpeedKmh;
    } else {
      agg.set(r.assetId, {
        assetId: r.assetId,
        assetName: r.asset.name,
        assetPlate: r.asset.plate,
        groupName: r.asset.group?.name ?? null,
        value: r.maxSpeedKmh,
      });
    }
  }
  return Array.from(agg.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════
//  Date helpers
// ═══════════════════════════════════════════════════════════════

function parseArIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) throw new Error(`Invalid iso ${iso}`);
  return new Date(Date.UTC(y, m - 1, d) + AR_OFFSET_MS);
}

function ymdAr(ts: number): string {
  const local = new Date(ts - AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function arLocalHour(ts: number): number {
  const local = new Date(ts - AR_OFFSET_MS);
  return local.getUTCHours();
}

/** Day-of-week AR-local · 0=Mon, 6=Sun */
function arLocalDow(ts: number): number {
  const local = new Date(ts - AR_OFFSET_MS);
  const dow = local.getUTCDay(); // 0=Sun..6=Sat
  return dow === 0 ? 6 : dow - 1;
}

function arLocalMondayUtc(ts: number): Date {
  const dow = arLocalDow(ts);
  const local = new Date(ts - AR_OFFSET_MS);
  const mondayLocalMs =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
    ) -
    dow * MS_DAY;
  return new Date(mondayLocalMs + AR_OFFSET_MS);
}

function sameArLocalDay(a: number, b: number): boolean {
  return ymdAr(a) === ymdAr(b);
}

function pct(cur: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return (cur - prev) / prev;
}

function isSpeedingType(t: string): boolean {
  return (
    t === "SPEEDING" ||
    t === "OVER_SPEED" ||
    t === "OVERSPEEDING" ||
    t.includes("SPEED")
  );
}

const MONTH_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const MONTH_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatMonthLong(d: Date): string {
  const local = new Date(d.getTime() - AR_OFFSET_MS);
  return `${MONTH_LONG[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
}

function formatDayLong(d: Date): string {
  const local = new Date(d.getTime() - AR_OFFSET_MS);
  const dow = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][
    local.getUTCDay()
  ];
  return `${dow} ${local.getUTCDate()} ${MONTH_LONG[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
}
