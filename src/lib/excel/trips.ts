// ═══════════════════════════════════════════════════════════════
//  Excel export · Trips · L10
//  ─────────────────────────────────────────────────────────────
//  Genera un .xlsx con 2 hojas:
//
//   · Hoja 1 · "Resumen por día" · una fila por (vehículo, día)
//     con métricas agregadas
//   · Hoja 2 · "Viajes" · una fila por viaje individual
//     con timestamps y métricas detalladas
//
//  Usa el resultado de getTripsByDay() · misma data que la tabla
//  DaysList y el panel TripDetailPanel.
// ═══════════════════════════════════════════════════════════════

import type { Day } from "@/lib/queries/trips-by-day";
import {
  addFooter,
  createWorkbook,
  DATE_FMT,
  DATETIME_FMT,
  DECIMAL1_FMT,
  INT_FMT,
  setColumnWidths,
  styleHeaderRow,
  workbookToBuffer,
} from "./shared";

interface TripsExportOptions {
  days: Day[];
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
}

export async function generateTripsXlsx(
  options: TripsExportOptions,
): Promise<Buffer> {
  const wb = await createWorkbook();
  wb.subject = `Viajes · ${options.fromDate} a ${options.toDate}`;

  // ── Hoja 1 · Resumen por día ──────────────────────────────────
  const summary = wb.addWorksheet("Resumen por día");

  summary.addRow([
    "Día",
    "Vehículo",
    "Patente",
    "Conductor",
    "Distancia (km)",
    "Viajes",
    "Paradas",
    "Tiempo en ruta (min)",
    "Vel. máx (km/h)",
  ]);
  styleHeaderRow(summary, 1);
  setColumnWidths(summary, [12, 28, 12, 26, 14, 8, 8, 18, 14]);

  for (const day of options.days) {
    // Vel max del día = max de todos los trips
    let maxSpeed = 0;
    for (const item of day.items) {
      if (item.kind === "trip" && item.maxSpeedKmh > maxSpeed) {
        maxSpeed = item.maxSpeedKmh;
      }
    }

    summary.addRow([
      // Day como Date para que Excel reconozca formato
      isoToDate(day.dayIso),
      day.assetName,
      day.assetPlate ?? "",
      day.driverName ?? "—",
      Number(day.totalDistanceKm.toFixed(1)),
      day.tripCount,
      day.stopCount,
      Math.round(day.totalDrivingMs / 60_000),
      Math.round(maxSpeed),
    ]);
  }

  // Format columns
  summary.getColumn(1).numFmt = DATE_FMT;
  summary.getColumn(5).numFmt = DECIMAL1_FMT;
  summary.getColumn(6).numFmt = INT_FMT;
  summary.getColumn(7).numFmt = INT_FMT;
  summary.getColumn(8).numFmt = INT_FMT;
  summary.getColumn(9).numFmt = INT_FMT;

  // Freeze header
  summary.views = [{ state: "frozen", ySplit: 1 }];
  addFooter(summary);

  // ── Hoja 2 · Viajes individuales ──────────────────────────────
  const trips = wb.addWorksheet("Viajes");

  trips.addRow([
    "Día",
    "Vehículo",
    "Patente",
    "Conductor",
    "Inicio",
    "Fin",
    "Duración (min)",
    "Distancia (km)",
    "Vel. máx (km/h)",
    "Vel. prom (km/h)",
    "Eventos",
    "Severidad alta",
  ]);
  styleHeaderRow(trips, 1);
  setColumnWidths(trips, [12, 28, 12, 26, 18, 18, 14, 14, 14, 14, 10, 14]);

  for (const day of options.days) {
    for (const item of day.items) {
      if (item.kind !== "trip") continue;
      trips.addRow([
        isoToDate(day.dayIso),
        day.assetName,
        day.assetPlate ?? "",
        day.driverName ?? "—",
        item.startedAt,
        item.endedAt,
        Math.round(item.durationMs / 60_000),
        Number(item.distanceKm.toFixed(1)),
        Math.round(item.maxSpeedKmh),
        Math.round(item.avgSpeedKmh),
        item.eventCount,
        item.highSeverityEventCount,
      ]);
    }
  }

  trips.getColumn(1).numFmt = DATE_FMT;
  trips.getColumn(5).numFmt = DATETIME_FMT;
  trips.getColumn(6).numFmt = DATETIME_FMT;
  trips.getColumn(7).numFmt = INT_FMT;
  trips.getColumn(8).numFmt = DECIMAL1_FMT;
  trips.getColumn(9).numFmt = INT_FMT;
  trips.getColumn(10).numFmt = INT_FMT;
  trips.getColumn(11).numFmt = INT_FMT;
  trips.getColumn(12).numFmt = INT_FMT;

  trips.views = [{ state: "frozen", ySplit: 1 }];
  addFooter(trips);

  return workbookToBuffer(wb);
}

/** Convierte "2026-04-30" a Date en UTC (Excel lo renderiza con DATE_FMT) */
function isoToDate(iso: string): Date {
  const parts = iso.split("-");
  const y = parseInt(parts[0] ?? "1970", 10);
  const m = parseInt(parts[1] ?? "1", 10);
  const d = parseInt(parts[2] ?? "1", 10);
  return new Date(Date.UTC(y, m - 1, d));
}
