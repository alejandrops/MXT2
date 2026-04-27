// ═══════════════════════════════════════════════════════════════
//  Queries · Análisis temporal · matriz vehículos × tiempo
//  ─────────────────────────────────────────────────────────────
//  Una sola query · getFleetAnalysis · sirve a las 5 granularidades.
//  La data shape es uniforme · cambia solo la cantidad de columnas.
//
//  Cell = (vehículo, subdivisión temporal) → valor de la métrica.
//  Drill-down: click en celda → baja un nivel de zoom.
//
//  Granularidades:
//    · day-hours    · 24 cols  · drill: ninguno
//    · week-days    · 7 cols   · drill: day-hours
//    · month-days   · ~30 cols · drill: day-hours
//    · year-weeks   · 53 cols  · drill: week-days
//    · year-months  · 12 cols  · drill: month-days
//
//  Filtros · multi-select de grupos, tipos, choferes + search libre.
//  Cero lecturas a Position.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  iterDays,
  METRIC_LABELS,
  type ActivityMetric,
  type ActivityPeriod,
} from "./activity";

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
//  Tipos
// ═══════════════════════════════════════════════════════════════

export type AnalysisGranularity =
  | "day-hours"
  | "week-days"
  | "month-days"
  | "year-weeks"
  | "year-months";

export interface ScopeFilters {
  groupIds?: string[];
  vehicleTypes?: string[];
  personIds?: string[];
  search?: string;
}

export interface FleetCell {
  /** Posición de la celda (0-indexed) */
  col: number;
  value: number;
  /** ¿Esta celda corresponde al período actual? */
  isToday: boolean;
  isWeekend: boolean;
  /** ISO date AR-local del valor representado · null si futuro */
  drillDate: string | null;
  drillTo: AnalysisGranularity | null;
  /** Etiqueta legible para tooltip */
  fullLabel: string;
}

export interface FleetRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  groupName: string | null;
  vehicleType: string;
  cells: FleetCell[];
  /** Total · suma o max según métrica */
  total: number;
}

export interface ColLabel {
  /** En qué col va · 0-indexed */
  col: number;
  /** Texto a mostrar */
  label: string;
  /** Si es weekend (para layouts con días) */
  isWeekend?: boolean;
  /** Si es el actual (para layouts con tiempo) */
  isToday?: boolean;
}

export interface TrendPoint {
  label: string;
  value: number;
  iso: string;
}

export interface FleetAnalysisData {
  granularity: AnalysisGranularity;
  metric: ActivityMetric;
  metricLabel: string;
  /** UTC instants del período */
  periodFrom: Date;
  periodTo: Date;
  /** Etiquetas legibles · ej "Abril 2026" */
  periodLabel: string;
  periodSubLabel: string;
  /** Filas (vehículos) ordenadas por total desc */
  rows: FleetRow[];
  /** Etiquetas de columnas */
  colLabels: ColLabel[];
  colCount: number;
  /** Total de la flota seleccionada (suma o max de todas las filas) */
  total: number;
  previousTotal: number | null;
  deltaPct: number | null;
  /** Para el line chart de evolución (suma vertical por columna) */
  trend: TrendPoint[];
  /** Máximo de cualquier celda · usado para escala de color */
  maxCellValue: number;
  /** Promedio diario/semanal/mensual de la métrica · contextual */
  averageLabel: string;
  averageValue: number;
  /** Para nav prev/next/today */
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
  /** Filtros disponibles para los dropdowns */
  scope: {
    groups: { id: string; name: string }[];
    vehicleTypes: { value: string; label: string }[];
    drivers: { id: string; name: string }[];
  };
  /** Filtros aplicados (echo) */
  appliedScope: ScopeFilters;
  /** Si hay drill-down disponible para esta granularidad */
  hasDrill: boolean;
}

interface FleetParams {
  granularity: AnalysisGranularity;
  /** YYYY-MM-DD · ancla AR-local */
  anchor: string;
  metric: ActivityMetric;
  scope?: ScopeFilters;
  now?: number;
}

// ═══════════════════════════════════════════════════════════════
//  Public · getFleetAnalysis
// ═══════════════════════════════════════════════════════════════

export async function getFleetAnalysis(
  params: FleetParams,
): Promise<FleetAnalysisData> {
  const now = params.now ?? Date.now();
  const scope = params.scope ?? {};
  const anchor = parseArIso(params.anchor);

  // 1 · Resolver período según granularidad
  const periodSpec = computePeriodSpec(params.granularity, anchor, now);

  // 2 · Cargar opciones disponibles para los filtros (independiente del scope)
  const [allGroups, allDrivers] = await Promise.all([
    db.group.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.person.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  // 3 · Cargar vehículos del scope
  const assets = await loadAssets(scope);

  // 4 · Cargar datos crudos para cada granularidad
  const cells = await loadCellValues({
    granularity: params.granularity,
    metric: params.metric,
    period: periodSpec,
    assetIds: assets.map((a) => a.id),
    personIds: scope.personIds,
    now,
  });

  // 5 · Calcular previousTotal (rango anterior equivalente)
  const previousTotal = await calcPreviousTotal({
    granularity: params.granularity,
    metric: params.metric,
    anchor,
    now,
    assetIds: assets.map((a) => a.id),
    personIds: scope.personIds,
  });

  // 6 · Construir filas
  const rows: FleetRow[] = assets.map((a) => {
    const rowCells = periodSpec.cols.map((col): FleetCell => {
      const key = `${a.id}|${col.idx}`;
      return {
        col: col.idx,
        value: cells.get(key) ?? 0,
        isToday: col.isToday,
        isWeekend: col.isWeekend,
        drillDate: col.drillDate,
        drillTo: drillTargetFor(params.granularity),
        fullLabel: `${a.name} · ${col.fullLabel}`,
      };
    });
    const total =
      params.metric === "maxSpeedKmh"
        ? Math.max(0, ...rowCells.map((c) => c.value))
        : rowCells.reduce((acc, c) => acc + c.value, 0);
    return {
      assetId: a.id,
      assetName: a.name,
      assetPlate: a.plate,
      groupName: a.group?.name ?? null,
      vehicleType: a.vehicleType,
      cells: rowCells,
      total,
    };
  });

  // 7 · Filtrar filas con 0 actividad (a menos que el scope sea pequeño)
  const filteredRows =
    rows.length <= 30
      ? rows
      : rows.filter((r) => r.total > 0).slice(0, 50);

  // Sort by total desc
  filteredRows.sort((a, b) => b.total - a.total);

  // 8 · Trend agregado por columna (suma vertical)
  const trend: TrendPoint[] = periodSpec.cols.map((col) => {
    let sum = 0;
    let max = 0;
    for (const row of filteredRows) {
      const cell = row.cells[col.idx];
      if (!cell) continue;
      sum += cell.value;
      if (cell.value > max) max = cell.value;
    }
    return {
      label: col.shortLabel,
      value: params.metric === "maxSpeedKmh" ? max : sum,
      iso: col.drillDate ?? "",
    };
  });

  // 9 · Total general de la selección
  const total =
    params.metric === "maxSpeedKmh"
      ? Math.max(0, ...filteredRows.map((r) => r.total))
      : filteredRows.reduce((acc, r) => acc + r.total, 0);

  const maxCellValue = filteredRows.reduce((m, r) => {
    const rowMax = Math.max(0, ...r.cells.map((c) => c.value));
    return Math.max(m, rowMax);
  }, 0);

  // 10 · Promedio · sólo aplica a métricas tipo "sum"
  const avg = computeAverage(params.granularity, total, periodSpec, params.metric);

  return {
    granularity: params.granularity,
    metric: params.metric,
    metricLabel: METRIC_LABELS[params.metric],
    periodFrom: periodSpec.from,
    periodTo: periodSpec.to,
    periodLabel: periodSpec.periodLabel,
    periodSubLabel: periodSpec.periodSubLabel,
    rows: filteredRows,
    colLabels: periodSpec.colLabels,
    colCount: periodSpec.cols.length,
    total,
    previousTotal,
    deltaPct: pct(total, previousTotal),
    trend,
    maxCellValue,
    averageLabel: avg.label,
    averageValue: avg.value,
    anchorIso: periodSpec.anchorIso,
    prevAnchorIso: periodSpec.prevAnchorIso,
    nextAnchorIso: periodSpec.nextAnchorIso,
    scope: {
      groups: allGroups.map((g: any) => ({ id: g.id, name: g.name })),
      vehicleTypes: VEHICLE_TYPES,
      drivers: allDrivers.map((p: any) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
      })),
    },
    appliedScope: scope,
    hasDrill: drillTargetFor(params.granularity) !== null,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Period spec · una matriz de columnas por granularidad
// ═══════════════════════════════════════════════════════════════

interface PeriodCol {
  idx: number;
  /** Etiqueta corta (ej "Lun", "13h", "27", "S2", "Ene") */
  shortLabel: string;
  /** Etiqueta larga para tooltip */
  fullLabel: string;
  /** Si la columna corresponde a hoy/ahora */
  isToday: boolean;
  isWeekend: boolean;
  /** Para drill-down · ISO date del centro de la columna · null = futuro */
  drillDate: string | null;
  /** UTC instants para query · inicio inclusivo, fin exclusivo */
  from: Date;
  to: Date;
}

interface PeriodSpec {
  from: Date;
  to: Date;
  cols: PeriodCol[];
  colLabels: ColLabel[];
  periodLabel: string;
  periodSubLabel: string;
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
}

function computePeriodSpec(
  granularity: AnalysisGranularity,
  anchor: Date,
  now: number,
): PeriodSpec {
  switch (granularity) {
    case "day-hours":
      return spec_dayHours(anchor, now);
    case "week-days":
      return spec_weekDays(anchor, now);
    case "month-days":
      return spec_monthDays(anchor, now);
    case "year-weeks":
      return spec_yearWeeks(anchor, now);
    case "year-months":
      return spec_yearMonths(anchor, now);
  }
}

function spec_dayHours(anchor: Date, now: number): PeriodSpec {
  const from = anchor;
  const to = new Date(anchor.getTime() + MS_DAY);
  const todayHour = sameDayAr(anchor.getTime(), now)
    ? new Date(now - AR_OFFSET_MS).getUTCHours()
    : -1;
  const cols: PeriodCol[] = [];
  for (let h = 0; h < 24; h++) {
    cols.push({
      idx: h,
      shortLabel: `${String(h).padStart(2, "0")}h`,
      fullLabel: `${formatDayLong(anchor)} · ${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59`,
      isToday: h === todayHour,
      isWeekend: false,
      drillDate: null,
      from: new Date(anchor.getTime() + h * 60 * 60 * 1000),
      to: new Date(anchor.getTime() + (h + 1) * 60 * 60 * 1000),
    });
  }
  const colLabels: ColLabel[] = [
    { col: 0, label: "00h" },
    { col: 6, label: "06h" },
    { col: 12, label: "12h" },
    { col: 18, label: "18h" },
  ];
  return {
    from, to, cols, colLabels,
    periodLabel: formatDayLong(anchor),
    periodSubLabel: ymdAr(anchor.getTime()),
    anchorIso: ymdAr(anchor.getTime()),
    prevAnchorIso: ymdAr(anchor.getTime() - MS_DAY),
    nextAnchorIso:
      anchor.getTime() < arLocalMidnightUtc(now).getTime()
        ? ymdAr(anchor.getTime() + MS_DAY)
        : null,
  };
}

function spec_weekDays(anchor: Date, now: number): PeriodSpec {
  const monday = arLocalMondayUtc(anchor.getTime());
  const from = monday;
  const to = new Date(monday.getTime() + 7 * MS_DAY);
  const todayIso = ymdAr(now);
  const todayMidnight = arLocalMidnightUtc(now);
  const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const cols: PeriodCol[] = [];
  for (let i = 0; i < 7; i++) {
    const dayUtc = new Date(monday.getTime() + i * MS_DAY);
    const iso = ymdAr(dayUtc.getTime());
    cols.push({
      idx: i,
      shortLabel: DAY_LABELS[i]!,
      fullLabel: formatDayLong(dayUtc),
      isToday: iso === todayIso,
      isWeekend: i >= 5,
      drillDate: dayUtc.getTime() <= todayMidnight.getTime() ? iso : null,
      from: dayUtc,
      to: new Date(dayUtc.getTime() + MS_DAY),
    });
  }
  const colLabels: ColLabel[] = DAY_LABELS.map((label, i) => ({
    col: i,
    label,
    isWeekend: i >= 5,
    isToday: cols[i]!.isToday,
  }));
  const fmtShort = (d: Date) => {
    const local = new Date(d.getTime() - AR_OFFSET_MS);
    return `${String(local.getUTCDate()).padStart(2, "0")}/${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  return {
    from, to, cols, colLabels,
    periodLabel: `Semana del ${fmtShort(monday)} al ${fmtShort(new Date(to.getTime() - MS_DAY))}`,
    periodSubLabel: `${ymdAr(monday.getTime())} → ${ymdAr(to.getTime() - 1)}`,
    anchorIso: ymdAr(monday.getTime()),
    prevAnchorIso: ymdAr(monday.getTime() - 7 * MS_DAY),
    nextAnchorIso:
      monday.getTime() + 7 * MS_DAY <= todayMidnight.getTime()
        ? ymdAr(monday.getTime() + 7 * MS_DAY)
        : null,
  };
}

function spec_monthDays(anchor: Date, now: number): PeriodSpec {
  const local = new Date(anchor.getTime() - AR_OFFSET_MS);
  const monthStart = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + AR_OFFSET_MS,
  );
  const monthEnd = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) + AR_OFFSET_MS,
  );
  const days = Math.round((monthEnd.getTime() - monthStart.getTime()) / MS_DAY);
  const todayIso = ymdAr(now);
  const todayMidnight = arLocalMidnightUtc(now);
  const cols: PeriodCol[] = [];
  for (let i = 0; i < days; i++) {
    const dayUtc = new Date(monthStart.getTime() + i * MS_DAY);
    const iso = ymdAr(dayUtc.getTime());
    const dow = arLocalDow(dayUtc.getTime());
    cols.push({
      idx: i,
      shortLabel: String(i + 1),
      fullLabel: formatDayLong(dayUtc),
      isToday: iso === todayIso,
      isWeekend: dow >= 5,
      drillDate: dayUtc.getTime() <= todayMidnight.getTime() ? iso : null,
      from: dayUtc,
      to: new Date(dayUtc.getTime() + MS_DAY),
    });
  }
  const colLabels: ColLabel[] = [];
  for (let i = 0; i < days; i += 5) {
    colLabels.push({ col: i, label: String(i + 1) });
  }
  const prevMonthStart = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) + AR_OFFSET_MS,
  );
  return {
    from: monthStart,
    to: monthEnd,
    cols,
    colLabels,
    periodLabel: formatMonthLong(monthStart),
    periodSubLabel: `${days} días`,
    anchorIso: ymdAr(monthStart.getTime()),
    prevAnchorIso: ymdAr(prevMonthStart.getTime()),
    nextAnchorIso:
      monthEnd.getTime() <= todayMidnight.getTime() + MS_DAY
        ? ymdAr(monthEnd.getTime())
        : null,
  };
}

function spec_yearWeeks(_anchor: Date, now: number): PeriodSpec {
  // Un año termina hoy y arranca 52 semanas atrás (53 semanas total)
  const monday = arLocalMondayUtc(now);
  const startMonday = new Date(monday.getTime() - 52 * 7 * MS_DAY);
  const from = startMonday;
  const to = new Date(monday.getTime() + 7 * MS_DAY);
  const todayIso = ymdAr(now);
  const cols: PeriodCol[] = [];
  for (let w = 0; w < 53; w++) {
    const wkStart = new Date(startMonday.getTime() + w * 7 * MS_DAY);
    const wkEnd = new Date(wkStart.getTime() + 7 * MS_DAY);
    const wkIso = ymdAr(wkStart.getTime());
    const containsToday =
      wkStart.getTime() <= new Date(todayIso + "T00:00:00Z").getTime() &&
      wkEnd.getTime() > new Date(todayIso + "T00:00:00Z").getTime();
    const local = new Date(wkStart.getTime() - AR_OFFSET_MS);
    cols.push({
      idx: w,
      shortLabel: "",
      fullLabel: `Semana del ${String(local.getUTCDate()).padStart(2, "0")}/${String(local.getUTCMonth() + 1).padStart(2, "0")}/${local.getUTCFullYear()}`,
      isToday: containsToday,
      isWeekend: false,
      drillDate: wkIso,
      from: wkStart,
      to: wkEnd,
    });
  }
  // Col labels = primer mes que aparece en cada cambio
  const colLabels: ColLabel[] = [];
  let lastMonth = -1;
  for (let w = 0; w < 53; w++) {
    const wkStart = new Date(startMonday.getTime() + w * 7 * MS_DAY);
    const local = new Date(wkStart.getTime() - AR_OFFSET_MS);
    const m = local.getUTCMonth();
    if (m !== lastMonth) {
      lastMonth = m;
      colLabels.push({ col: w, label: MONTH_SHORT[m]! });
    }
  }
  const lastDayLocal = new Date(to.getTime() - MS_DAY - AR_OFFSET_MS);
  const startLocal = new Date(startMonday.getTime() - AR_OFFSET_MS);
  return {
    from, to, cols, colLabels,
    periodLabel: "Últimos 12 meses",
    periodSubLabel: `${MONTH_SHORT[startLocal.getUTCMonth()]} ${startLocal.getUTCFullYear()} → ${MONTH_SHORT[lastDayLocal.getUTCMonth()]} ${lastDayLocal.getUTCFullYear()}`,
    anchorIso: ymdAr(now),
    prevAnchorIso: ymdAr(now - 365 * MS_DAY),
    nextAnchorIso: null,
  };
}

function spec_yearMonths(anchor: Date, now: number): PeriodSpec {
  const local = new Date(anchor.getTime() - AR_OFFSET_MS);
  const year = local.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1) + AR_OFFSET_MS);
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1) + AR_OFFSET_MS);
  const todayLocal = new Date(now - AR_OFFSET_MS);
  const todayMonth = todayLocal.getUTCMonth();
  const todayYear = todayLocal.getUTCFullYear();
  const cols: PeriodCol[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(Date.UTC(year, m, 1) + AR_OFFSET_MS);
    const monthEnd = new Date(Date.UTC(year, m + 1, 1) + AR_OFFSET_MS);
    const isFuture = monthStart.getTime() > arLocalMidnightUtc(now).getTime();
    cols.push({
      idx: m,
      shortLabel: MONTH_SHORT[m]!,
      fullLabel: `${MONTH_LONG[m]!} ${year}`,
      isToday: !isFuture && year === todayYear && m === todayMonth,
      isWeekend: false,
      drillDate: isFuture
        ? null
        : `${year}-${String(m + 1).padStart(2, "0")}-01`,
      from: monthStart,
      to: monthEnd,
    });
  }
  const colLabels: ColLabel[] = MONTH_SHORT.map((label, i) => ({
    col: i,
    label,
    isToday: cols[i]!.isToday,
  }));
  return {
    from: yearStart,
    to: yearEnd,
    cols,
    colLabels,
    periodLabel: `Año ${year}`,
    periodSubLabel: "Por meses",
    anchorIso: `${year}-01-01`,
    prevAnchorIso: `${year - 1}-01-01`,
    nextAnchorIso: year < todayYear ? `${year + 1}-01-01` : null,
  };
}

function drillTargetFor(g: AnalysisGranularity): AnalysisGranularity | null {
  switch (g) {
    case "day-hours":
      return null;
    case "week-days":
      return "day-hours";
    case "month-days":
      return "day-hours";
    case "year-weeks":
      return "week-days";
    case "year-months":
      return "month-days";
  }
}

// ═══════════════════════════════════════════════════════════════
//  Loaders
// ═══════════════════════════════════════════════════════════════

async function loadAssets(scope: ScopeFilters): Promise<any[]> {
  const where: any = { mobilityType: "MOBILE" };
  if (scope.groupIds && scope.groupIds.length > 0) {
    where.groupId = { in: scope.groupIds };
  }
  if (scope.vehicleTypes && scope.vehicleTypes.length > 0) {
    where.vehicleType = { in: scope.vehicleTypes };
  }
  if (scope.search && scope.search.trim().length > 0) {
    const q = scope.search.trim();
    where.OR = [
      { name: { contains: q } },
      { plate: { contains: q } },
    ];
  }
  return db.asset.findMany({
    where,
    select: {
      id: true,
      name: true,
      plate: true,
      vehicleType: true,
      group: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
}

interface CellLoadParams {
  granularity: AnalysisGranularity;
  metric: ActivityMetric;
  period: PeriodSpec;
  assetIds: string[];
  personIds?: string[];
  now: number;
}

async function loadCellValues(
  p: CellLoadParams,
): Promise<Map<string, number>> {
  // Returns map: "assetId|colIdx" → value
  const out = new Map<string, number>();
  if (p.assetIds.length === 0) return out;

  if (p.granularity === "day-hours") {
    return loadHourly(p);
  }
  return loadDaily(p);
}

async function loadHourly(p: CellLoadParams): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const { period, metric, assetIds, personIds } = p;
  if (
    metric === "distanceKm" ||
    metric === "activeMin" ||
    metric === "tripCount" ||
    metric === "fuelLiters" ||
    metric === "maxSpeedKmh"
  ) {
    const trips = await db.trip.findMany({
      where: {
        assetId: { in: assetIds },
        startedAt: { gte: period.from, lt: period.to },
        ...(personIds && personIds.length > 0
          ? { personId: { in: personIds } }
          : {}),
      },
      select: {
        assetId: true,
        startedAt: true,
        endedAt: true,
        distanceKm: true,
        maxSpeedKmh: true,
      },
    });
    for (const t of trips as any[]) {
      const h = arLocalHour(t.startedAt.getTime());
      const key = `${t.assetId}|${h}`;
      const cur = out.get(key) ?? 0;
      let v = 0;
      if (metric === "distanceKm") v = t.distanceKm;
      else if (metric === "tripCount") v = 1;
      else if (metric === "activeMin")
        v = (t.endedAt.getTime() - t.startedAt.getTime()) / 60_000;
      else if (metric === "fuelLiters")
        v = ((t.endedAt.getTime() - t.startedAt.getTime()) / 60_000) * 0.12;
      if (metric === "maxSpeedKmh") {
        if (t.maxSpeedKmh > cur) out.set(key, t.maxSpeedKmh);
      } else {
        out.set(key, cur + v);
      }
    }
  } else {
    const events = await db.event.findMany({
      where: {
        assetId: { in: assetIds },
        occurredAt: { gte: period.from, lt: period.to },
        ...(personIds && personIds.length > 0
          ? { personId: { in: personIds } }
          : {}),
      },
      select: {
        assetId: true,
        occurredAt: true,
        type: true,
        severity: true,
      },
    });
    for (const ev of events as any[]) {
      if (metric === "highEventCount") {
        if (ev.severity !== "HIGH" && ev.severity !== "CRITICAL") continue;
      } else if (metric === "speedingCount") {
        if (!isSpeedingType(String(ev.type))) continue;
      }
      const h = arLocalHour(ev.occurredAt.getTime());
      const key = `${ev.assetId}|${h}`;
      out.set(key, (out.get(key) ?? 0) + 1);
    }
  }
  return out;
}

async function loadDaily(p: CellLoadParams): Promise<Map<string, number>> {
  const { granularity, period, metric, assetIds, personIds } = p;
  // 1 · cargar día×asset values
  const daily = new Map<string, number>(); // key "assetId|YYYY-MM-DD" → value

  if (
    metric === "distanceKm" ||
    metric === "activeMin" ||
    metric === "tripCount" ||
    metric === "fuelLiters"
  ) {
    const rows = await db.assetDriverDay.findMany({
      where: {
        assetId: { in: assetIds },
        day: { gte: period.from, lt: period.to },
        ...(personIds && personIds.length > 0
          ? { personId: { in: personIds } }
          : {}),
      },
      select: {
        assetId: true,
        day: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
      },
    });
    for (const r of rows as any[]) {
      const iso = ymdAr(r.day.getTime());
      const key = `${r.assetId}|${iso}`;
      let v = 0;
      if (metric === "distanceKm") v = r.distanceKm;
      else if (metric === "activeMin") v = r.activeMin;
      else if (metric === "tripCount") v = r.tripCount;
      else if (metric === "fuelLiters") v = r.activeMin * 0.12;
      daily.set(key, (daily.get(key) ?? 0) + v);
    }
  } else if (metric === "maxSpeedKmh") {
    const rows = await db.trip.findMany({
      where: {
        assetId: { in: assetIds },
        startedAt: { gte: period.from, lt: period.to },
        ...(personIds && personIds.length > 0
          ? { personId: { in: personIds } }
          : {}),
      },
      select: { assetId: true, startedAt: true, maxSpeedKmh: true },
    });
    for (const r of rows as any[]) {
      const iso = ymdAr(r.startedAt.getTime());
      const key = `${r.assetId}|${iso}`;
      const cur = daily.get(key) ?? 0;
      if (r.maxSpeedKmh > cur) daily.set(key, r.maxSpeedKmh);
    }
  } else {
    const rows = await db.event.findMany({
      where: {
        assetId: { in: assetIds },
        occurredAt: { gte: period.from, lt: period.to },
        ...(personIds && personIds.length > 0
          ? { personId: { in: personIds } }
          : {}),
      },
      select: {
        assetId: true,
        occurredAt: true,
        type: true,
        severity: true,
      },
    });
    for (const r of rows as any[]) {
      if (metric === "highEventCount") {
        if (r.severity !== "HIGH" && r.severity !== "CRITICAL") continue;
      } else if (metric === "speedingCount") {
        if (!isSpeedingType(String(r.type))) continue;
      }
      const iso = ymdAr(r.occurredAt.getTime());
      const key = `${r.assetId}|${iso}`;
      daily.set(key, (daily.get(key) ?? 0) + 1);
    }
  }

  // 2 · agregar daily values en columnas según granularidad
  const out = new Map<string, number>();
  for (const col of period.cols) {
    // columnas tienen rango from..to en UTC
    // recorremos los días dentro del rango de la columna
    const dayCount = Math.round(
      (col.to.getTime() - col.from.getTime()) / MS_DAY,
    );
    for (let d = 0; d < dayCount; d++) {
      const dayUtc = new Date(col.from.getTime() + d * MS_DAY);
      const iso = ymdAr(dayUtc.getTime());
      for (const aid of assetIds) {
        const v = daily.get(`${aid}|${iso}`);
        if (!v) continue;
        const k = `${aid}|${col.idx}`;
        if (metric === "maxSpeedKmh") {
          const cur = out.get(k) ?? 0;
          if (v > cur) out.set(k, v);
        } else {
          out.set(k, (out.get(k) ?? 0) + v);
        }
      }
    }
  }
  return out;
}

async function calcPreviousTotal(p: {
  granularity: AnalysisGranularity;
  metric: ActivityMetric;
  anchor: Date;
  now: number;
  assetIds: string[];
  personIds?: string[];
}): Promise<number | null> {
  if (p.assetIds.length === 0) return null;
  // Compute previous period range based on granularity
  const cur = computePeriodSpec(p.granularity, p.anchor, p.now);
  const len = cur.to.getTime() - cur.from.getTime();
  const prevFrom = new Date(cur.from.getTime() - len);
  const prevTo = cur.from;

  // Reuse loadCellValues but with a fake period spec of single col
  const fakeSpec: PeriodSpec = {
    from: prevFrom,
    to: prevTo,
    cols: [
      {
        idx: 0,
        shortLabel: "",
        fullLabel: "",
        isToday: false,
        isWeekend: false,
        drillDate: null,
        from: prevFrom,
        to: prevTo,
      },
    ],
    colLabels: [],
    periodLabel: "",
    periodSubLabel: "",
    anchorIso: "",
    prevAnchorIso: "",
    nextAnchorIso: null,
  };
  const cells = await loadCellValues({
    granularity: p.granularity === "day-hours" ? "week-days" : p.granularity,
    // For prev period we don't care about granularity layout, just the total
    // → use a granularity that triggers loadDaily for daily metrics
    metric: p.metric,
    period: fakeSpec,
    assetIds: p.assetIds,
    personIds: p.personIds,
    now: p.now,
  });

  let sum = 0;
  let max = 0;
  for (const v of cells.values()) {
    sum += v;
    if (v > max) max = v;
  }
  return p.metric === "maxSpeedKmh" ? max : sum;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers · constants
// ═══════════════════════════════════════════════════════════════

const VEHICLE_TYPES: { value: string; label: string }[] = [
  { value: "CAR", label: "Auto" },
  { value: "MOTORCYCLE", label: "Moto" },
  { value: "TRUCK", label: "Camión" },
  { value: "HEAVY_MACHINERY", label: "Maquinaria" },
  { value: "TRAILER", label: "Tráiler" },
  { value: "GENERIC", label: "Genérico" },
];

const MONTH_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const MONTH_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function computeAverage(
  g: AnalysisGranularity,
  total: number,
  spec: PeriodSpec,
  metric: ActivityMetric,
): { label: string; value: number } {
  if (metric === "maxSpeedKmh") return { label: "Pico", value: total };
  switch (g) {
    case "day-hours":
      return { label: "Promedio por hora", value: total / 24 };
    case "week-days":
      return { label: "Promedio diario", value: total / 7 };
    case "month-days": {
      const days = spec.cols.length;
      return { label: "Promedio diario", value: total / days };
    }
    case "year-weeks":
      return { label: "Promedio semanal", value: total / 52 };
    case "year-months":
      return { label: "Promedio mensual", value: total / 12 };
  }
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
  return new Date(ts - AR_OFFSET_MS).getUTCHours();
}

function arLocalDow(ts: number): number {
  const dow = new Date(ts - AR_OFFSET_MS).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

function arLocalMidnightUtc(ts: number): Date {
  const local = new Date(ts - AR_OFFSET_MS);
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
    ) + AR_OFFSET_MS,
  );
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

function sameDayAr(a: number, b: number): boolean {
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
