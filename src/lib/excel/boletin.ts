// ═══════════════════════════════════════════════════════════════
//  Excel export · Boletín · L10
//  ─────────────────────────────────────────────────────────────
//  Genera un .xlsx con 6 hojas que reflejan los bloques del
//  boletín mensual. No incluye los bloques narrativos (B Salud
//  Operativa, J Highlights) porque son texto · esos quedan
//  capturados en la hoja "Resumen" como observaciones.
//
//   · Hoja 1 · Resumen · KPIs current vs previous + delta
//   · Hoja 2 · Top vehículos · ranking eventos/100km
//   · Hoja 3 · Top conductores · ranking safety score
//   · Hoja 4 · Grupos · performance por grupo
//   · Hoja 5 · Alarmas · breakdown por severidad/domain + top vehículos
//   · Hoja 6 · Eventos por tipo
// ═══════════════════════════════════════════════════════════════

import {
  addFooter,
  createWorkbook,
  DECIMAL1_FMT,
  INT_FMT,
  KPI_LABEL_STYLE,
  KPI_TITLE_STYLE,
  KPI_VALUE_STYLE,
  PCT_FMT,
  SECTION_TITLE_STYLE,
  setColumnWidths,
  styleHeaderRow,
  workbookToBuffer,
} from "./shared";

// Las shapes vienen del page del boletín · las redefino acá para
// no crear dependencia circular del módulo de excel a la página.
interface BoletinKpis {
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
  alarmCount: number;
}

interface BoletinSummary {
  current: BoletinKpis & {
    activeAssetCount: number;
    activeDriverCount: number;
  };
  previous: BoletinKpis;
  fleet: { totalAssets: number; totalDrivers: number; totalGroups: number };
}

interface VehicleRow {
  assetId: string;
  assetName: string;
  plate: string | null;
  groupName: string | null;
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
  eventsPer100km: number;
}

interface DriverRow {
  personId: string;
  fullName: string;
  safetyScore: number;
  distanceKm: number;
  tripCount: number;
  eventCount: number;
}

interface GroupRow {
  groupId: string;
  groupName: string;
  assetCount: number;
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
  eventsPer100km: number;
}

interface AlarmsBlock {
  total: number;
  activeAtClose: number;
  mttrMin: number;
  bySeverity: { severity: string; count: number }[];
  byDomain: { domain: string; count: number }[];
  topVehicles: {
    assetId: string;
    assetName: string;
    plate: string | null;
    count: number;
  }[];
}

interface BoletinExportOptions {
  period: string; // "YYYY-MM"
  periodLabel: string; // "Abril 2026"
  summary: BoletinSummary;
  vehicles: VehicleRow[];
  drivers: DriverRow[];
  groups: GroupRow[];
  alarms: AlarmsBlock;
  events?: { type: string; count: number }[];
}

export async function generateBoletinXlsx(
  options: BoletinExportOptions,
): Promise<Buffer> {
  const wb = await createWorkbook();
  wb.subject = `Boletín mensual · ${options.periodLabel}`;

  // ── Hoja 1 · Resumen ──────────────────────────────────────────
  const summary = wb.addWorksheet("Resumen");
  setColumnWidths(summary, [28, 18, 18, 14]);

  summary.addRow([`Boletín mensual · ${options.periodLabel}`]);
  summary.getRow(1).font = KPI_TITLE_STYLE.font;
  summary.mergeCells("A1:D1");

  summary.addRow([]);
  summary.addRow(["KPIs del período"]);
  Object.assign(summary.getRow(3), SECTION_TITLE_STYLE);
  summary.addRow(["", "Actual", "Anterior", "Δ %"]);
  styleHeaderRow(summary, 4);

  const c = options.summary.current;
  const p = options.summary.previous;
  const delta = (cur: number, prev: number): number =>
    prev === 0 ? 0 : (cur - prev) / prev;

  const kpiRows: [string, number, number, number][] = [
    ["Distancia (km)", c.distanceKm, p.distanceKm, delta(c.distanceKm, p.distanceKm)],
    ["Tiempo activo (min)", c.activeMin, p.activeMin, delta(c.activeMin, p.activeMin)],
    ["Viajes", c.tripCount, p.tripCount, delta(c.tripCount, p.tripCount)],
    ["Eventos", c.eventCount, p.eventCount, delta(c.eventCount, p.eventCount)],
    ["Alarmas", c.alarmCount, p.alarmCount, delta(c.alarmCount, p.alarmCount)],
  ];

  for (const [label, cur, prev, d] of kpiRows) {
    summary.addRow([label, cur, prev, d]);
  }

  // Format columns B/C as numbers, D as percentage
  summary.getColumn(2).numFmt = INT_FMT;
  summary.getColumn(3).numFmt = INT_FMT;
  summary.getColumn(4).numFmt = PCT_FMT;

  summary.addRow([]);
  summary.addRow(["Flota"]);
  Object.assign(summary.getRow(summary.rowCount), SECTION_TITLE_STYLE);

  const fleetRows: [string, number, number][] = [
    ["Vehículos totales", options.summary.fleet.totalAssets, c.activeAssetCount],
    ["Conductores totales", options.summary.fleet.totalDrivers, c.activeDriverCount],
    ["Grupos totales", options.summary.fleet.totalGroups, 0],
  ];

  summary.addRow(["", "Total", "Activos en el período"]);
  styleHeaderRow(summary, summary.rowCount);
  for (const [label, total, active] of fleetRows) {
    summary.addRow([label, total, active]);
  }

  addFooter(summary);

  // ── Hoja 2 · Top vehículos ────────────────────────────────────
  const vehicles = wb.addWorksheet("Top vehículos");
  vehicles.addRow([
    "Vehículo",
    "Patente",
    "Grupo",
    "Distancia (km)",
    "Tiempo activo (min)",
    "Viajes",
    "Eventos",
    "Eventos / 100 km",
  ]);
  styleHeaderRow(vehicles, 1);
  setColumnWidths(vehicles, [28, 12, 20, 14, 18, 8, 10, 16]);
  for (const v of options.vehicles) {
    vehicles.addRow([
      v.assetName,
      v.plate ?? "",
      v.groupName ?? "—",
      Number(v.distanceKm.toFixed(1)),
      v.activeMin,
      v.tripCount,
      v.eventCount,
      Number(v.eventsPer100km.toFixed(2)),
    ]);
  }
  vehicles.getColumn(4).numFmt = DECIMAL1_FMT;
  vehicles.getColumn(5).numFmt = INT_FMT;
  vehicles.getColumn(6).numFmt = INT_FMT;
  vehicles.getColumn(7).numFmt = INT_FMT;
  vehicles.getColumn(8).numFmt = "0.00";
  vehicles.views = [{ state: "frozen", ySplit: 1 }];
  addFooter(vehicles);

  // ── Hoja 3 · Top conductores ──────────────────────────────────
  const drivers = wb.addWorksheet("Top conductores");
  drivers.addRow([
    "Conductor",
    "Score (0-100)",
    "Distancia (km)",
    "Viajes",
    "Eventos",
  ]);
  styleHeaderRow(drivers, 1);
  setColumnWidths(drivers, [28, 14, 14, 8, 10]);
  for (const d of options.drivers) {
    drivers.addRow([
      d.fullName,
      d.safetyScore,
      Number(d.distanceKm.toFixed(1)),
      d.tripCount,
      d.eventCount,
    ]);
  }
  drivers.getColumn(2).numFmt = INT_FMT;
  drivers.getColumn(3).numFmt = DECIMAL1_FMT;
  drivers.getColumn(4).numFmt = INT_FMT;
  drivers.getColumn(5).numFmt = INT_FMT;
  drivers.views = [{ state: "frozen", ySplit: 1 }];
  addFooter(drivers);

  // ── Hoja 4 · Grupos ───────────────────────────────────────────
  const groups = wb.addWorksheet("Grupos");
  groups.addRow([
    "Grupo",
    "Vehículos",
    "Distancia (km)",
    "Tiempo activo (min)",
    "Viajes",
    "Eventos",
    "Eventos / 100 km",
  ]);
  styleHeaderRow(groups, 1);
  setColumnWidths(groups, [24, 12, 14, 18, 8, 10, 16]);
  for (const g of options.groups) {
    groups.addRow([
      g.groupName,
      g.assetCount,
      Number(g.distanceKm.toFixed(1)),
      g.activeMin,
      g.tripCount,
      g.eventCount,
      Number(g.eventsPer100km.toFixed(2)),
    ]);
  }
  groups.getColumn(2).numFmt = INT_FMT;
  groups.getColumn(3).numFmt = DECIMAL1_FMT;
  groups.getColumn(4).numFmt = INT_FMT;
  groups.getColumn(5).numFmt = INT_FMT;
  groups.getColumn(6).numFmt = INT_FMT;
  groups.getColumn(7).numFmt = "0.00";
  groups.views = [{ state: "frozen", ySplit: 1 }];
  addFooter(groups);

  // ── Hoja 5 · Alarmas ──────────────────────────────────────────
  const alarms = wb.addWorksheet("Alarmas");
  setColumnWidths(alarms, [28, 18]);

  alarms.addRow(["Resumen"]);
  Object.assign(alarms.getRow(1), SECTION_TITLE_STYLE);
  alarms.addRow(["Total alarmas", options.alarms.total]);
  alarms.addRow(["Activas al cierre", options.alarms.activeAtClose]);
  alarms.addRow(["MTTR (min)", options.alarms.mttrMin]);
  alarms.getColumn(2).numFmt = INT_FMT;

  alarms.addRow([]);
  alarms.addRow(["Por severidad"]);
  Object.assign(alarms.getRow(alarms.rowCount), SECTION_TITLE_STYLE);
  alarms.addRow(["Severidad", "Cantidad"]);
  styleHeaderRow(alarms, alarms.rowCount);
  for (const r of options.alarms.bySeverity) {
    alarms.addRow([r.severity, r.count]);
  }

  alarms.addRow([]);
  alarms.addRow(["Por dominio"]);
  Object.assign(alarms.getRow(alarms.rowCount), SECTION_TITLE_STYLE);
  alarms.addRow(["Dominio", "Cantidad"]);
  styleHeaderRow(alarms, alarms.rowCount);
  for (const r of options.alarms.byDomain) {
    alarms.addRow([r.domain, r.count]);
  }

  alarms.addRow([]);
  alarms.addRow(["Top vehículos con alarmas"]);
  Object.assign(alarms.getRow(alarms.rowCount), SECTION_TITLE_STYLE);
  alarms.addRow(["Vehículo", "Patente", "Cantidad"]);
  styleHeaderRow(alarms, alarms.rowCount);
  setColumnWidths(alarms, [28, 14, 12]);
  for (const r of options.alarms.topVehicles) {
    alarms.addRow([r.assetName, r.plate ?? "", r.count]);
  }

  addFooter(alarms);

  // ── Hoja 6 · Eventos por tipo ─────────────────────────────────
  if (options.events && options.events.length > 0) {
    const events = wb.addWorksheet("Eventos");
    events.addRow(["Tipo de evento", "Cantidad"]);
    styleHeaderRow(events, 1);
    setColumnWidths(events, [32, 14]);
    for (const e of options.events) {
      events.addRow([e.type, e.count]);
    }
    events.getColumn(2).numFmt = INT_FMT;
    events.views = [{ state: "frozen", ySplit: 1 }];
    addFooter(events);
  }

  return workbookToBuffer(wb);
}
