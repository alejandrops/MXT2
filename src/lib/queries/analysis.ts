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
  /**
   * Multi-tenant scope (U1b). Si está seteado, restringe la
   * consulta a los assets de este account · usado para enforcement
   * de scope OWN_ACCOUNT en CA y OP. Calculado por la página vía
   * resolveAccountScope.
   */
  accountId?: string | null;
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
  /** Total del período anterior equivalente · null si no hay datos */
  previousTotal: number | null;
  /** Delta % vs período anterior · null si previo es 0 o null */
  previousDeltaPct: number | null;
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

export interface AnomalyRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  groupName: string | null;
  /** Valor del período actual */
  currentValue: number;
  /** Media de los N períodos previos del mismo tipo */
  historicalMean: number;
  /** Desvío estándar histórico */
  historicalStd: number;
  /** Z-score signed · (current - mean) / std */
  zScore: number;
  /** "high" si zScore > 0, "low" si < 0 */
  direction: "high" | "low";
  /** "critical" si |z| ≥ 3, "warning" si entre 2 y 3 */
  severity: "warning" | "critical";
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
  /** Anomalías detectadas · solo en granularidades day/week/month */
  anomalies: AnomalyRow[];
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
      where: scope.accountId ? { accountId: scope.accountId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.person.findMany({
      where: scope.accountId ? { accountId: scope.accountId } : undefined,
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

  // 5b · Cargar totales por vehículo del período ANTERIOR
  // (para calcular delta vs previo en cada fila · usado por Reportes)
  const periodLenMs =
    periodSpec.to.getTime() - periodSpec.from.getTime();
  const prevFrom = new Date(periodSpec.from.getTime() - periodLenMs);
  const prevTo = periodSpec.from;
  const prevTotalsByAsset =
    assets.length > 0
      ? await totalsByAssetForRange({
          from: prevFrom,
          to: prevTo,
          metric: params.metric,
          assetIds: assets.map((a) => a.id),
          personIds: scope.personIds,
        })
      : new Map<string, number>();

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
    const prevTotal = prevTotalsByAsset.get(a.id) ?? 0;
    const hasPrev = prevTotalsByAsset.has(a.id);
    return {
      assetId: a.id,
      assetName: a.name,
      assetPlate: a.plate,
      groupName: a.group?.name ?? null,
      vehicleType: a.vehicleType,
      cells: rowCells,
      total,
      previousTotal: hasPrev ? prevTotal : null,
      previousDeltaPct:
        hasPrev && prevTotal > 0 ? (total - prevTotal) / prevTotal : null,
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

  // 11 · Detección de anomalías · solo en granularidades day/week/month
  const anomalies = await detectAnomalies({
    granularity: params.granularity,
    metric: params.metric,
    periodSpec,
    rows: filteredRows,
    personIds: scope.personIds,
    now,
  });

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
    anomalies,
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
  // Multi-tenant scope (U1b)
  if (scope.accountId) {
    where.accountId = scope.accountId;
  }
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
//  Anomaly detection · z-score vs historical mean
//  ─────────────────────────────────────────────────────────────
//  Para cada vehículo del período actual, calcula media y desvío
//  estándar de los últimos N períodos del MISMO TIPO. Si el valor
//  actual cae fuera de ±2σ, lo marca como anomalía.
//
//  Solo aplica para granularidades day/week/month. Para year-* no
//  habría histórico suficiente (necesitaríamos 6 años de datos).
// ═══════════════════════════════════════════════════════════════

const HISTORY_LEN = 6;

async function detectAnomalies(p: {
  granularity: AnalysisGranularity;
  metric: ActivityMetric;
  periodSpec: PeriodSpec;
  rows: FleetRow[];
  personIds?: string[];
  now: number;
}): Promise<AnomalyRow[]> {
  // Las granularidades anuales no tienen histórico suficiente
  if (p.granularity === "year-weeks" || p.granularity === "year-months") {
    return [];
  }
  if (p.rows.length === 0) return [];

  const periodLenMs =
    p.periodSpec.to.getTime() - p.periodSpec.from.getTime();
  const assetIds = p.rows.map((r) => r.assetId);

  // Cargar totales por vehículo para los HISTORY_LEN períodos previos
  const historicals: Map<string, number>[] = [];
  for (let i = 1; i <= HISTORY_LEN; i++) {
    const from = new Date(p.periodSpec.from.getTime() - i * periodLenMs);
    const to = new Date(p.periodSpec.from.getTime() - (i - 1) * periodLenMs);
    const totals = await totalsByAssetForRange({
      from,
      to,
      metric: p.metric,
      assetIds,
      personIds: p.personIds,
    });
    historicals.push(totals);
  }

  // Calcular z-score por vehículo
  const out: AnomalyRow[] = [];
  for (const row of p.rows) {
    const samples = historicals.map((m) => m.get(row.assetId) ?? 0);
    // Si todas las muestras son 0 y el actual también es 0, skip
    const allZero = samples.every((s) => s === 0) && row.total === 0;
    if (allZero) continue;

    const mean = average(samples);
    const std = stdDev(samples, mean);
    // Floor del std para evitar divisiones por casi-cero
    // si el vehículo tiene operación muy uniforme
    const minStd = Math.max(std, mean * 0.1, 0.5);
    const z = (row.total - mean) / minStd;

    if (Math.abs(z) >= 2) {
      out.push({
        assetId: row.assetId,
        assetName: row.assetName,
        assetPlate: row.assetPlate,
        groupName: row.groupName,
        currentValue: row.total,
        historicalMean: mean,
        historicalStd: std,
        zScore: z,
        direction: z > 0 ? "high" : "low",
        severity: Math.abs(z) >= 3 ? "critical" : "warning",
      });
    }
  }

  // Sort por |z| desc · más anómalos primero
  out.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  return out;
}

async function totalsByAssetForRange(p: {
  from: Date;
  to: Date;
  metric: ActivityMetric;
  assetIds: string[];
  personIds?: string[];
}): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (p.assetIds.length === 0) return out;

  const personFilter =
    p.personIds && p.personIds.length > 0
      ? { personId: { in: p.personIds } }
      : {};

  if (
    p.metric === "distanceKm" ||
    p.metric === "activeMin" ||
    p.metric === "tripCount" ||
    p.metric === "fuelLiters"
  ) {
    const rows = await db.assetDriverDay.findMany({
      where: {
        assetId: { in: p.assetIds },
        day: { gte: p.from, lt: p.to },
        ...personFilter,
      },
      select: {
        assetId: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
      },
    });
    for (const r of rows as any[]) {
      let v = 0;
      if (p.metric === "distanceKm") v = r.distanceKm;
      else if (p.metric === "activeMin") v = r.activeMin;
      else if (p.metric === "tripCount") v = r.tripCount;
      else if (p.metric === "fuelLiters") v = r.activeMin * 0.12;
      out.set(r.assetId, (out.get(r.assetId) ?? 0) + v);
    }
  } else if (p.metric === "maxSpeedKmh") {
    const rows = await db.trip.findMany({
      where: {
        assetId: { in: p.assetIds },
        startedAt: { gte: p.from, lt: p.to },
        ...personFilter,
      },
      select: { assetId: true, maxSpeedKmh: true },
    });
    for (const r of rows as any[]) {
      const cur = out.get(r.assetId) ?? 0;
      if (r.maxSpeedKmh > cur) out.set(r.assetId, r.maxSpeedKmh);
    }
  } else {
    // event-based metrics
    const rows = await db.event.findMany({
      where: {
        assetId: { in: p.assetIds },
        occurredAt: { gte: p.from, lt: p.to },
        ...personFilter,
      },
      select: { assetId: true, type: true, severity: true },
    });
    for (const r of rows as any[]) {
      if (p.metric === "highEventCount") {
        if (r.severity !== "HIGH" && r.severity !== "CRITICAL") continue;
      } else if (p.metric === "speedingCount") {
        if (!isSpeedingType(String(r.type))) continue;
      }
      out.set(r.assetId, (out.get(r.assetId) ?? 0) + 1);
    }
  }
  return out;
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], mean: number): number {
  if (arr.length === 0) return 0;
  const variance =
    arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// ═══════════════════════════════════════════════════════════════
//  Helpers · constants
// ═══════════════════════════════════════════════════════════════

const VEHICLE_TYPES: { value: string; label: string }[] = [
  { value: "MOTOCICLETA", label: "Motocicleta" },
  { value: "LIVIANO", label: "Liviano" },
  { value: "UTILITARIO", label: "Utilitario" },
  { value: "PASAJEROS", label: "Pasajeros" },
  { value: "CAMION_LIVIANO", label: "Camión liviano" },
  { value: "CAMION_PESADO", label: "Camión pesado" },
  { value: "SUSTANCIAS_PELIGROSAS", label: "Sust. peligrosas" },
  { value: "MAQUINA_VIAL", label: "Máquina vial" },
  { value: "ASSET_FIJO", label: "Asset fijo" },
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

// ═══════════════════════════════════════════════════════════════
//  Multi-metric · todas las métricas por vehículo en una pasada
//  ─────────────────────────────────────────────────────────────
//  Modo "foto fija" del período · 1 fila por vehículo · N
//  columnas, una por cada métrica relevante. Cada celda incluye
//  el valor del período y el delta vs período anterior.
//
//  Para escalar a flotas grandes se podría cachear o pre-agregar
//  en una tabla rollup, pero para 30-50 vehículos las 14 queries
//  paralelas (7 métricas × 2 períodos) son aceptables.
// ═══════════════════════════════════════════════════════════════

export const MULTI_METRIC_KEYS: ActivityMetric[] = [
  "distanceKm",
  "activeMin",
  "idleMin",
  "tripCount",
  "eventCount",
  "speedingCount",
  "maxSpeedKmh",
  "fuelLiters",
];

export interface MultiMetricCell {
  value: number;
  /** delta vs período anterior · null si no hay histórico */
  deltaPct: number | null;
}

export interface MultiMetricRow {
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  groupName: string | null;
  vehicleType: string;
  metrics: Record<ActivityMetric, MultiMetricCell>;
}

export interface FleetMultiMetricData {
  granularity: AnalysisGranularity;
  periodFrom: Date;
  periodTo: Date;
  periodLabel: string;
  periodSubLabel: string;
  rows: MultiMetricRow[];
  /** Totales agregados por métrica */
  totals: Record<ActivityMetric, MultiMetricCell>;
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
  scope: {
    groups: { id: string; name: string }[];
    vehicleTypes: { value: string; label: string }[];
    drivers: { id: string; name: string }[];
  };
  appliedScope: ScopeFilters;
}

export async function getFleetMultiMetric(
  params: FleetParams,
): Promise<FleetMultiMetricData> {
  const now = params.now ?? Date.now();
  const scope = params.scope ?? {};
  const anchor = parseArIso(params.anchor);

  const periodSpec = computePeriodSpec(params.granularity, anchor, now);

  const [allGroups, allDrivers] = await Promise.all([
    db.group.findMany({
      where: scope.accountId ? { accountId: scope.accountId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.person.findMany({
      where: scope.accountId ? { accountId: scope.accountId } : undefined,
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const assets = await loadAssets(scope);
  const assetIds = assets.map((a) => a.id);

  const periodLenMs =
    periodSpec.to.getTime() - periodSpec.from.getTime();
  const prevFrom = new Date(periodSpec.from.getTime() - periodLenMs);
  const prevTo = periodSpec.from;

  // 7 métricas × 2 períodos · 14 fetches en paralelo
  const [currentMaps, previousMaps] = await Promise.all([
    Promise.all(
      MULTI_METRIC_KEYS.map((m) =>
        totalsByAssetForRange({
          from: periodSpec.from,
          to: periodSpec.to,
          metric: m,
          assetIds,
          personIds: scope.personIds,
        }),
      ),
    ),
    Promise.all(
      MULTI_METRIC_KEYS.map((m) =>
        totalsByAssetForRange({
          from: prevFrom,
          to: prevTo,
          metric: m,
          assetIds,
          personIds: scope.personIds,
        }),
      ),
    ),
  ]);

  // Construir filas
  const rows: MultiMetricRow[] = assets.map((a) => {
    const metrics = {} as Record<ActivityMetric, MultiMetricCell>;
    MULTI_METRIC_KEYS.forEach((m, i) => {
      const cur = currentMaps[i]!.get(a.id) ?? 0;
      const prev = previousMaps[i]!.get(a.id) ?? 0;
      metrics[m] = {
        value: cur,
        deltaPct: prev > 0 ? (cur - prev) / prev : null,
      };
    });
    return {
      assetId: a.id,
      assetName: a.name,
      assetPlate: a.plate,
      groupName: a.group?.name ?? null,
      vehicleType: a.vehicleType,
      metrics,
    };
  });

  // Sort por distanceKm desc
  rows.sort(
    (a, b) => b.metrics.distanceKm.value - a.metrics.distanceKm.value,
  );

  // Filtrar inactivos si la flota es grande
  const filteredRows =
    rows.length <= 30
      ? rows
      : rows.filter((r) =>
          MULTI_METRIC_KEYS.some((m) => r.metrics[m].value > 0),
        );

  // Totales por métrica
  const totals = {} as Record<ActivityMetric, MultiMetricCell>;
  MULTI_METRIC_KEYS.forEach((m, i) => {
    let curSum = 0;
    let curMax = 0;
    let prevSum = 0;
    let prevMax = 0;
    for (const r of filteredRows) {
      curSum += r.metrics[m].value;
      if (r.metrics[m].value > curMax) curMax = r.metrics[m].value;
      const prev = previousMaps[i]!.get(r.assetId) ?? 0;
      prevSum += prev;
      if (prev > prevMax) prevMax = prev;
    }
    const cur = m === "maxSpeedKmh" ? curMax : curSum;
    const prev = m === "maxSpeedKmh" ? prevMax : prevSum;
    totals[m] = {
      value: cur,
      deltaPct: prev > 0 ? (cur - prev) / prev : null,
    };
  });

  return {
    granularity: params.granularity,
    periodFrom: periodSpec.from,
    periodTo: periodSpec.to,
    periodLabel: periodSpec.periodLabel,
    periodSubLabel: periodSpec.periodSubLabel,
    rows: filteredRows,
    totals,
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
  };
}

// ═══════════════════════════════════════════════════════════════
//  Multi-metric · DRIVERS · todas las métricas por persona
//  ─────────────────────────────────────────────────────────────
//  Análogo a getFleetMultiMetric pero indexado por persona.
//  Las personas relevantes son las que aparecen como driver en
//  trips del período (con scope filter aplicado a los vehículos).
//
//  Métricas: distancia, horas, viajes, eventos, excesos,
//  high-events, vel máx · 7 métricas (idle y fuel no aplican
//  a personas, son propiedad del vehículo).
//
//  Campo derivado: vehiclesUsed · cuántos vehículos distintos
//  manejó la persona en el período.
// ═══════════════════════════════════════════════════════════════

export const DRIVER_METRIC_KEYS: ActivityMetric[] = [
  "distanceKm",
  "activeMin",
  "tripCount",
  "eventCount",
  "speedingCount",
  "highEventCount",
  "maxSpeedKmh",
];

export interface DriverMultiMetricRow {
  personId: string;
  personName: string;
  /** Cantidad de vehículos distintos manejados en el período */
  vehiclesUsed: number;
  metrics: Record<ActivityMetric, MultiMetricCell>;
}

export interface DriversMultiMetricData {
  granularity: AnalysisGranularity;
  periodFrom: Date;
  periodTo: Date;
  periodLabel: string;
  periodSubLabel: string;
  rows: DriverMultiMetricRow[];
  totals: Record<ActivityMetric, MultiMetricCell>;
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
  scope: {
    groups: { id: string; name: string }[];
    vehicleTypes: { value: string; label: string }[];
    drivers: { id: string; name: string }[];
  };
  appliedScope: ScopeFilters;
}

export async function getDriversMultiMetric(
  params: FleetParams,
): Promise<DriversMultiMetricData> {
  const now = params.now ?? Date.now();
  const scope = params.scope ?? {};
  const anchor = parseArIso(params.anchor);

  const periodSpec = computePeriodSpec(params.granularity, anchor, now);

  const [allGroups, allDrivers] = await Promise.all([
    db.group.findMany({
      where: scope.accountId ? { accountId: scope.accountId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.person.findMany({
      where: scope.accountId ? { accountId: scope.accountId } : undefined,
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  // 1 · Resolver pool de assets según scope (groupIds, vehicleTypes)
  const assets = await loadAssets({
    ...scope,
    personIds: undefined, // ignoramos personIds para el pool de assets
  });
  const assetIds = assets.map((a) => a.id);

  if (assetIds.length === 0) {
    return emptyDriversData(periodSpec, scope, allGroups, allDrivers);
  }

  // 2 · Personas que aparecen como driver en trips del período
  const trips = await db.trip.findMany({
    where: {
      assetId: { in: assetIds },
      startedAt: { gte: periodSpec.from, lt: periodSpec.to },
      personId: { not: null },
    },
    select: { personId: true, assetId: true },
  });

  const personAssetSet = new Map<string, Set<string>>();
  for (const t of trips as any[]) {
    if (!t.personId) continue;
    if (!personAssetSet.has(t.personId)) {
      personAssetSet.set(t.personId, new Set());
    }
    personAssetSet.get(t.personId)!.add(t.assetId);
  }
  let candidatePersonIds = Array.from(personAssetSet.keys());

  // 3 · Filtros de scope sobre personas
  if (scope.personIds && scope.personIds.length > 0) {
    const allowed = new Set(scope.personIds);
    candidatePersonIds = candidatePersonIds.filter((id) => allowed.has(id));
  }

  if (candidatePersonIds.length === 0) {
    return emptyDriversData(periodSpec, scope, allGroups, allDrivers);
  }

  // 4 · Cargar info de personas
  const personRecords = await db.person.findMany({
    where: { id: { in: candidatePersonIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  // 5 · Filtro por search
  let filteredPersons = personRecords;
  if (scope.search && scope.search.trim().length > 0) {
    const q = scope.search.toLowerCase();
    filteredPersons = personRecords.filter((p: any) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
    );
  }

  const finalPersonIds = filteredPersons.map((p: any) => p.id);

  if (finalPersonIds.length === 0) {
    return emptyDriversData(periodSpec, scope, allGroups, allDrivers);
  }

  // 6 · Métricas en paralelo · 7 × 2 = 14 fetches
  const periodLenMs =
    periodSpec.to.getTime() - periodSpec.from.getTime();
  const prevFrom = new Date(periodSpec.from.getTime() - periodLenMs);
  const prevTo = periodSpec.from;

  const [currentMaps, previousMaps] = await Promise.all([
    Promise.all(
      DRIVER_METRIC_KEYS.map((m) =>
        totalsByPersonForRange({
          from: periodSpec.from,
          to: periodSpec.to,
          metric: m,
          personIds: finalPersonIds,
          assetIds,
        }),
      ),
    ),
    Promise.all(
      DRIVER_METRIC_KEYS.map((m) =>
        totalsByPersonForRange({
          from: prevFrom,
          to: prevTo,
          metric: m,
          personIds: finalPersonIds,
          assetIds,
        }),
      ),
    ),
  ]);

  // 7 · Construir filas
  const rows: DriverMultiMetricRow[] = filteredPersons.map((p: any) => {
    const metrics = {} as Record<ActivityMetric, MultiMetricCell>;
    DRIVER_METRIC_KEYS.forEach((m, i) => {
      const cur = currentMaps[i]!.get(p.id) ?? 0;
      const prev = previousMaps[i]!.get(p.id) ?? 0;
      metrics[m] = {
        value: cur,
        deltaPct: prev > 0 ? (cur - prev) / prev : null,
      };
    });
    return {
      personId: p.id,
      personName: `${p.firstName} ${p.lastName}`,
      vehiclesUsed: personAssetSet.get(p.id)?.size ?? 0,
      metrics,
    };
  });

  // 8 · Sort por distanceKm desc
  rows.sort(
    (a, b) => b.metrics.distanceKm.value - a.metrics.distanceKm.value,
  );

  // 9 · Totales
  const totals = {} as Record<ActivityMetric, MultiMetricCell>;
  DRIVER_METRIC_KEYS.forEach((m, i) => {
    let curSum = 0;
    let curMax = 0;
    let prevSum = 0;
    let prevMax = 0;
    for (const r of rows) {
      curSum += r.metrics[m].value;
      if (r.metrics[m].value > curMax) curMax = r.metrics[m].value;
      const prev = previousMaps[i]!.get(r.personId) ?? 0;
      prevSum += prev;
      if (prev > prevMax) prevMax = prev;
    }
    const cur = m === "maxSpeedKmh" ? curMax : curSum;
    const prev = m === "maxSpeedKmh" ? prevMax : prevSum;
    totals[m] = {
      value: cur,
      deltaPct: prev > 0 ? (cur - prev) / prev : null,
    };
  });

  return {
    granularity: params.granularity,
    periodFrom: periodSpec.from,
    periodTo: periodSpec.to,
    periodLabel: periodSpec.periodLabel,
    periodSubLabel: periodSpec.periodSubLabel,
    rows,
    totals,
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
  };
}

function emptyDriversData(
  periodSpec: any,
  scope: ScopeFilters,
  allGroups: any[],
  allDrivers: any[],
): DriversMultiMetricData {
  const totals = {} as Record<ActivityMetric, MultiMetricCell>;
  DRIVER_METRIC_KEYS.forEach((m) => {
    totals[m] = { value: 0, deltaPct: null };
  });
  return {
    granularity: periodSpec.granularity ?? "month-days",
    periodFrom: periodSpec.from,
    periodTo: periodSpec.to,
    periodLabel: periodSpec.periodLabel,
    periodSubLabel: periodSpec.periodSubLabel,
    rows: [],
    totals,
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
  };
}

async function totalsByPersonForRange(p: {
  from: Date;
  to: Date;
  metric: ActivityMetric;
  personIds: string[];
  assetIds: string[];
}): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (p.personIds.length === 0 || p.assetIds.length === 0) return out;

  const baseFilter = {
    personId: { in: p.personIds },
    assetId: { in: p.assetIds },
  };

  if (
    p.metric === "distanceKm" ||
    p.metric === "activeMin" ||
    p.metric === "tripCount"
  ) {
    const rows = await db.assetDriverDay.findMany({
      where: {
        ...baseFilter,
        day: { gte: p.from, lt: p.to },
      },
      select: {
        personId: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
      },
    });
    for (const r of rows as any[]) {
      let v = 0;
      if (p.metric === "distanceKm") v = r.distanceKm;
      else if (p.metric === "activeMin") v = r.activeMin;
      else if (p.metric === "tripCount") v = r.tripCount;
      out.set(r.personId, (out.get(r.personId) ?? 0) + v);
    }
  } else if (p.metric === "maxSpeedKmh") {
    const rows = await db.trip.findMany({
      where: {
        ...baseFilter,
        startedAt: { gte: p.from, lt: p.to },
      },
      select: { personId: true, maxSpeedKmh: true },
    });
    for (const r of rows as any[]) {
      if (!r.personId) continue;
      const cur = out.get(r.personId) ?? 0;
      if (r.maxSpeedKmh > cur) out.set(r.personId, r.maxSpeedKmh);
    }
  } else {
    const rows = await db.event.findMany({
      where: {
        ...baseFilter,
        occurredAt: { gte: p.from, lt: p.to },
      },
      select: { personId: true, type: true, severity: true },
    });
    for (const r of rows as any[]) {
      if (!r.personId) continue;
      if (p.metric === "highEventCount") {
        if (r.severity !== "HIGH" && r.severity !== "CRITICAL") continue;
      } else if (p.metric === "speedingCount") {
        if (!isSpeedingType(String(r.type))) continue;
      }
      out.set(r.personId, (out.get(r.personId) ?? 0) + 1);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  DRIVERS ANALYSIS · análogo a getFleetAnalysis indexado por persona
//  ─────────────────────────────────────────────────────────────
//  1 fila por persona (no por vehículo) × N columnas según
//  granularidad. Solo personas que manejaron al menos un vehículo
//  del scope en el período.
//
//  Reusa todo el frame de getFleetAnalysis (period spec, anomaly
//  detection, trend, deltas) pero las celdas se agrupan por
//  personId en vez de assetId.
// ═══════════════════════════════════════════════════════════════

export interface DriverAnalysisRow {
  personId: string;
  personName: string;
  /** Cantidad de vehículos distintos manejados en el período */
  vehiclesUsed: number;
  cells: FleetCell[];
  total: number;
  previousTotal: number | null;
  previousDeltaPct: number | null;
}

export interface DriverAnomalyRow {
  personId: string;
  personName: string;
  currentValue: number;
  historicalMean: number;
  historicalStd: number;
  zScore: number;
  direction: "high" | "low";
  severity: "warning" | "critical";
}

export interface DriversAnalysisData {
  granularity: AnalysisGranularity;
  metric: ActivityMetric;
  metricLabel: string;
  periodFrom: Date;
  periodTo: Date;
  periodLabel: string;
  periodSubLabel: string;
  rows: DriverAnalysisRow[];
  colLabels: ColLabel[];
  colCount: number;
  total: number;
  previousTotal: number | null;
  deltaPct: number | null;
  trend: TrendPoint[];
  maxCellValue: number;
  averageLabel: string;
  averageValue: number;
  anomalies: DriverAnomalyRow[];
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
  scope: {
    groups: { id: string; name: string }[];
    vehicleTypes: { value: string; label: string }[];
    drivers: { id: string; name: string }[];
  };
  appliedScope: ScopeFilters;
  hasDrill: boolean;
}

export async function getDriversAnalysis(
  params: FleetParams,
): Promise<DriversAnalysisData> {
  const now = params.now ?? Date.now();
  const scope = params.scope ?? {};
  const anchor = parseArIso(params.anchor);

  // 1. Period
  const periodSpec = computePeriodSpec(params.granularity, anchor, now);

  // 2. Pool de assets según scope (sin personIds)
  const assets = await loadAssets({
    ...scope,
    personIds: undefined,
  });
  const assetIds = assets.map((a) => a.id);

  const [allGroups, allDrivers] = await Promise.all([
    db.group.findMany({
      where: scope.accountId ? { accountId: scope.accountId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.person.findMany({
      where: scope.accountId ? { accountId: scope.accountId } : undefined,
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  if (assetIds.length === 0) {
    return emptyDriversAnalysis(
      params,
      periodSpec,
      scope,
      allGroups,
      allDrivers,
    );
  }

  // 3. Personas activas (manejaron ≥ 1 trip en el período)
  const trips = await db.trip.findMany({
    where: {
      assetId: { in: assetIds },
      startedAt: { gte: periodSpec.from, lt: periodSpec.to },
      personId: { not: null },
    },
    select: { personId: true, assetId: true },
  });
  const personAssetSet = new Map<string, Set<string>>();
  for (const t of trips as any[]) {
    if (!t.personId) continue;
    if (!personAssetSet.has(t.personId)) {
      personAssetSet.set(t.personId, new Set());
    }
    personAssetSet.get(t.personId)!.add(t.assetId);
  }
  let candidatePersonIds = Array.from(personAssetSet.keys());

  // 4. Filtrar por scope.personIds y search
  if (scope.personIds && scope.personIds.length > 0) {
    const allowed = new Set(scope.personIds);
    candidatePersonIds = candidatePersonIds.filter((id) => allowed.has(id));
  }

  if (candidatePersonIds.length === 0) {
    return emptyDriversAnalysis(
      params,
      periodSpec,
      scope,
      allGroups,
      allDrivers,
    );
  }

  const personRecords = await db.person.findMany({
    where: { id: { in: candidatePersonIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  let filteredPersons = personRecords;
  if (scope.search && scope.search.trim().length > 0) {
    const q = scope.search.toLowerCase();
    filteredPersons = personRecords.filter((p: any) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
    );
  }

  if (filteredPersons.length === 0) {
    return emptyDriversAnalysis(
      params,
      periodSpec,
      scope,
      allGroups,
      allDrivers,
    );
  }

  const personIds = filteredPersons.map((p: any) => p.id);

  // 5. Cargar cells × col por persona
  const cells = await loadCellValuesByPerson({
    granularity: params.granularity,
    metric: params.metric,
    period: periodSpec,
    assetIds,
    personIds,
  });

  // 6. Period anterior · totales por persona
  const periodLenMs =
    periodSpec.to.getTime() - periodSpec.from.getTime();
  const prevFrom = new Date(periodSpec.from.getTime() - periodLenMs);
  const prevTo = periodSpec.from;
  const prevTotalsByPerson = await totalsByPersonForRange({
    from: prevFrom,
    to: prevTo,
    metric: params.metric,
    personIds,
    assetIds,
  });

  // 7. Construir filas
  const rows: DriverAnalysisRow[] = filteredPersons.map((p: any) => {
    const rowCells = periodSpec.cols.map((col): FleetCell => {
      const key = `${p.id}|${col.idx}`;
      return {
        col: col.idx,
        value: cells.get(key) ?? 0,
        isToday: col.isToday,
        isWeekend: col.isWeekend,
        drillDate: col.drillDate,
        drillTo: drillTargetFor(params.granularity),
        fullLabel: `${p.firstName} ${p.lastName} · ${col.fullLabel}`,
      };
    });
    const total =
      params.metric === "maxSpeedKmh"
        ? Math.max(0, ...rowCells.map((c) => c.value))
        : rowCells.reduce((acc, c) => acc + c.value, 0);
    const prevTotal = prevTotalsByPerson.get(p.id) ?? 0;
    const hasPrev = prevTotalsByPerson.has(p.id);
    return {
      personId: p.id,
      personName: `${p.firstName} ${p.lastName}`,
      vehiclesUsed: personAssetSet.get(p.id)?.size ?? 0,
      cells: rowCells,
      total,
      previousTotal: hasPrev ? prevTotal : null,
      previousDeltaPct:
        hasPrev && prevTotal > 0 ? (total - prevTotal) / prevTotal : null,
    };
  });

  // Sort por total desc
  rows.sort((a, b) => b.total - a.total);

  // 8. Total flota + delta
  const total =
    params.metric === "maxSpeedKmh"
      ? Math.max(0, ...rows.map((r) => r.total))
      : rows.reduce((a, r) => a + r.total, 0);
  let previousTotal = 0;
  let prevHasAny = false;
  for (const v of prevTotalsByPerson.values()) {
    previousTotal += v;
    prevHasAny = true;
  }
  const previousTotalNullable = prevHasAny ? previousTotal : null;
  const deltaPct =
    previousTotalNullable !== null && previousTotalNullable > 0
      ? (total - previousTotalNullable) / previousTotalNullable
      : null;

  // 9. Trend · suma vertical por columna
  const trend: TrendPoint[] = periodSpec.cols.map((col) => {
    let sum = 0;
    let max = 0;
    for (const r of rows) {
      const c = r.cells.find((cc) => cc.col === col.idx);
      if (!c) continue;
      sum += c.value;
      if (c.value > max) max = c.value;
    }
    const v = params.metric === "maxSpeedKmh" ? max : sum;
    return { label: col.shortLabel, value: v, iso: col.drillDate ?? "" };
  });

  // 10. Anomalías por persona · z-score vs últimos 6 períodos
  const anomalies = await detectAnomaliesByPerson({
    granularity: params.granularity,
    metric: params.metric,
    periodSpec,
    rows,
    assetIds,
    now,
  });

  // 11. Max cell value · escala color
  let maxCellValue = 0;
  for (const r of rows) {
    for (const c of r.cells) if (c.value > maxCellValue) maxCellValue = c.value;
  }

  const avg = computeAverage(
    params.granularity,
    total,
    periodSpec,
    params.metric,
  );

  return {
    granularity: params.granularity,
    metric: params.metric,
    metricLabel: METRIC_LABELS[params.metric],
    periodFrom: periodSpec.from,
    periodTo: periodSpec.to,
    periodLabel: periodSpec.periodLabel,
    periodSubLabel: periodSpec.periodSubLabel,
    rows,
    colLabels: periodSpec.colLabels,
    colCount: periodSpec.cols.length,
    total,
    previousTotal: previousTotalNullable,
    deltaPct,
    trend,
    maxCellValue,
    averageLabel: avg.label,
    averageValue: avg.value,
    anomalies,
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

function emptyDriversAnalysis(
  params: FleetParams,
  periodSpec: PeriodSpec,
  scope: ScopeFilters,
  allGroups: any[],
  allDrivers: any[],
): DriversAnalysisData {
  return {
    granularity: params.granularity,
    metric: params.metric,
    metricLabel: METRIC_LABELS[params.metric],
    periodFrom: periodSpec.from,
    periodTo: periodSpec.to,
    periodLabel: periodSpec.periodLabel,
    periodSubLabel: periodSpec.periodSubLabel,
    rows: [],
    colLabels: periodSpec.colLabels,
    colCount: periodSpec.cols.length,
    total: 0,
    previousTotal: null,
    deltaPct: null,
    trend: [],
    maxCellValue: 0,
    averageLabel: "Promedio",
    averageValue: 0,
    anomalies: [],
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

// Cells × col agrupadas por personId
async function loadCellValuesByPerson(p: {
  granularity: AnalysisGranularity;
  metric: ActivityMetric;
  period: PeriodSpec;
  assetIds: string[];
  personIds: string[];
}): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (p.assetIds.length === 0 || p.personIds.length === 0) return out;

  const baseFilter = {
    assetId: { in: p.assetIds },
    personId: { in: p.personIds },
  };

  // HOURLY
  if (p.granularity === "day-hours") {
    if (
      p.metric === "distanceKm" ||
      p.metric === "activeMin" ||
      p.metric === "tripCount" ||
      p.metric === "fuelLiters" ||
      p.metric === "maxSpeedKmh"
    ) {
      const trips = await db.trip.findMany({
        where: {
          ...baseFilter,
          startedAt: { gte: p.period.from, lt: p.period.to },
        },
        select: {
          personId: true,
          startedAt: true,
          endedAt: true,
          distanceKm: true,
          maxSpeedKmh: true,
        },
      });
      for (const t of trips as any[]) {
        if (!t.personId) continue;
        const h = arLocalHour(t.startedAt.getTime());
        const key = `${t.personId}|${h}`;
        const cur = out.get(key) ?? 0;
        let v = 0;
        if (p.metric === "distanceKm") v = t.distanceKm;
        else if (p.metric === "tripCount") v = 1;
        else if (p.metric === "activeMin")
          v = (t.endedAt.getTime() - t.startedAt.getTime()) / 60_000;
        else if (p.metric === "fuelLiters")
          v =
            ((t.endedAt.getTime() - t.startedAt.getTime()) / 60_000) * 0.12;
        if (p.metric === "maxSpeedKmh") {
          if (t.maxSpeedKmh > cur) out.set(key, t.maxSpeedKmh);
        } else {
          out.set(key, cur + v);
        }
      }
    } else {
      const events = await db.event.findMany({
        where: {
          ...baseFilter,
          occurredAt: { gte: p.period.from, lt: p.period.to },
        },
        select: {
          personId: true,
          occurredAt: true,
          type: true,
          severity: true,
        },
      });
      for (const ev of events as any[]) {
        if (!ev.personId) continue;
        if (p.metric === "highEventCount") {
          if (ev.severity !== "HIGH" && ev.severity !== "CRITICAL") continue;
        } else if (p.metric === "speedingCount") {
          if (!isSpeedingType(String(ev.type))) continue;
        }
        const h = arLocalHour(ev.occurredAt.getTime());
        const key = `${ev.personId}|${h}`;
        out.set(key, (out.get(key) ?? 0) + 1);
      }
    }
    return out;
  }

  // DAILY · agrupar por día (week-days, month-days) o por unidad
  // mayor mediante el resolver del col. Cada col tiene un rango
  // [from, to) que cubre 1 o N días.
  const colByDate = new Map<string, number>();
  for (const c of p.period.cols) {
    // iterar cada día UTC dentro de [from, to)
    const startMs = c.from.getTime();
    const endMs = c.to.getTime();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    for (let ms = startMs; ms < endMs; ms += ONE_DAY) {
      colByDate.set(ymdAr(ms), c.idx);
    }
  }

  if (
    p.metric === "distanceKm" ||
    p.metric === "activeMin" ||
    p.metric === "tripCount" ||
    p.metric === "fuelLiters"
  ) {
    const rows = await db.assetDriverDay.findMany({
      where: {
        ...baseFilter,
        day: { gte: p.period.from, lt: p.period.to },
      },
      select: {
        personId: true,
        day: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
      },
    });
    for (const r of rows as any[]) {
      const ymd = ymdAr(r.day.getTime());
      const colIdx = colByDate.get(ymd);
      if (colIdx === undefined) continue;
      let v = 0;
      if (p.metric === "distanceKm") v = r.distanceKm;
      else if (p.metric === "activeMin") v = r.activeMin;
      else if (p.metric === "tripCount") v = r.tripCount;
      else if (p.metric === "fuelLiters") v = r.activeMin * 0.12;
      const key = `${r.personId}|${colIdx}`;
      out.set(key, (out.get(key) ?? 0) + v);
    }
  } else if (p.metric === "maxSpeedKmh") {
    const trips = await db.trip.findMany({
      where: {
        ...baseFilter,
        startedAt: { gte: p.period.from, lt: p.period.to },
      },
      select: { personId: true, startedAt: true, maxSpeedKmh: true },
    });
    for (const t of trips as any[]) {
      if (!t.personId) continue;
      const ymd = ymdAr(t.startedAt.getTime());
      const colIdx = colByDate.get(ymd);
      if (colIdx === undefined) continue;
      const key = `${t.personId}|${colIdx}`;
      const cur = out.get(key) ?? 0;
      if (t.maxSpeedKmh > cur) out.set(key, t.maxSpeedKmh);
    }
  } else {
    const events = await db.event.findMany({
      where: {
        ...baseFilter,
        occurredAt: { gte: p.period.from, lt: p.period.to },
      },
      select: {
        personId: true,
        occurredAt: true,
        type: true,
        severity: true,
      },
    });
    for (const ev of events as any[]) {
      if (!ev.personId) continue;
      if (p.metric === "highEventCount") {
        if (ev.severity !== "HIGH" && ev.severity !== "CRITICAL") continue;
      } else if (p.metric === "speedingCount") {
        if (!isSpeedingType(String(ev.type))) continue;
      }
      const ymd = ymdAr(ev.occurredAt.getTime());
      const colIdx = colByDate.get(ymd);
      if (colIdx === undefined) continue;
      const key = `${ev.personId}|${colIdx}`;
      out.set(key, (out.get(key) ?? 0) + 1);
    }
  }
  return out;
}

async function detectAnomaliesByPerson(p: {
  granularity: AnalysisGranularity;
  metric: ActivityMetric;
  periodSpec: PeriodSpec;
  rows: DriverAnalysisRow[];
  assetIds: string[];
  now: number;
}): Promise<DriverAnomalyRow[]> {
  if (p.granularity === "year-weeks" || p.granularity === "year-months")
    return [];
  if (p.rows.length === 0) return [];

  const periodLenMs =
    p.periodSpec.to.getTime() - p.periodSpec.from.getTime();
  const personIds = p.rows.map((r) => r.personId);

  const historicals: Map<string, number>[] = [];
  const HISTORY = 6;
  for (let i = 1; i <= HISTORY; i++) {
    const from = new Date(p.periodSpec.from.getTime() - i * periodLenMs);
    const to = new Date(p.periodSpec.from.getTime() - (i - 1) * periodLenMs);
    const totals = await totalsByPersonForRange({
      from,
      to,
      metric: p.metric,
      personIds,
      assetIds: p.assetIds,
    });
    historicals.push(totals);
  }

  const out: DriverAnomalyRow[] = [];
  for (const row of p.rows) {
    const samples = historicals.map((m) => m.get(row.personId) ?? 0);
    const allZero = samples.every((s) => s === 0) && row.total === 0;
    if (allZero) continue;
    const mean =
      samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
    const variance =
      samples.reduce((a, b) => a + (b - mean) ** 2, 0) /
      Math.max(1, samples.length);
    const std = Math.sqrt(variance);
    const minStd = Math.max(std, mean * 0.1, 0.5);
    const z = (row.total - mean) / minStd;
    if (Math.abs(z) >= 2) {
      out.push({
        personId: row.personId,
        personName: row.personName,
        currentValue: row.total,
        historicalMean: mean,
        historicalStd: std,
        zScore: z,
        direction: z > 0 ? "high" : "low",
        severity: Math.abs(z) >= 3 ? "critical" : "warning",
      });
    }
  }
  out.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  return out;
}
