"use client";

import Link from "next/link";
import { DataTable, type ColumnDef } from "@/components/maxtracker/ui/DataTable";
import type { Day } from "@/lib/queries/trips-by-day";
import styles from "./DaysList.module.css";

// ═══════════════════════════════════════════════════════════════
//  DaysList · S5-T1 · migrado a DataTable v2
//  ─────────────────────────────────────────────────────────────
//  Una fila por (día, asset) · click abre panel lateral con
//  timeline cronológica del día. Drill-down a vehículo/conductor
//  con stopPropagation.
//
//  Cambios vs versión anterior:
//    · Se reemplaza la tabla custom por DataTable v2
//    · Tipografía mono en columnas numéricas (km, viajes, etc.)
//    · Header del bloque con título + count
//    · CSV export disponible
//    · Filas sin numeración (son grupos día×asset, no secuencia)
// ═══════════════════════════════════════════════════════════════

interface Props {
  days: Day[];
  selectedDayId: string | null;
  onSelectDay: (id: string | null) => void;
}

export function DaysList({ days, selectedDayId, onSelectDay }: Props) {
  const columns: ColumnDef<Day>[] = [
    {
      key: "day",
      label: "Día",
      sortable: false,
      render: (day) => (
        <span className={styles.dayCell}>{formatDay(day.dayIso)}</span>
      ),
    },
    {
      key: "asset",
      label: "Vehículo",
      sortable: false,
      render: (day) => (
        <Link
          href={`/objeto/vehiculo/${day.assetId}`}
          className={styles.assetLink}
          onClick={(e) => e.stopPropagation()}
        >
          <span className={styles.assetName}>{day.assetName}</span>
          {day.assetPlate && (
            <span className={styles.plate}>{day.assetPlate}</span>
          )}
        </Link>
      ),
    },
    {
      key: "driver",
      label: "Conductor",
      sortable: false,
      render: (day) =>
        day.driverId && day.driverName ? (
          <Link
            href={`/objeto/conductor/${day.driverId}`}
            className={styles.driverLink}
            onClick={(e) => e.stopPropagation()}
          >
            {day.driverName}
          </Link>
        ) : (
          <span className={styles.dim}>—</span>
        ),
    },
    {
      key: "distance",
      label: "Distancia",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) => (
        <>
          {formatKm(day.totalDistanceKm)}
          <span className={styles.unit}> km</span>
        </>
      ),
    },
    {
      key: "tripCount",
      label: "Viajes",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) => day.tripCount,
    },
    {
      key: "stopCount",
      label: "Paradas",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) =>
        day.stopCount === 0 ? (
          <span className={styles.dim}>—</span>
        ) : (
          day.stopCount
        ),
    },
    {
      key: "drivingTime",
      label: "En ruta",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) => formatDuration(day.totalDrivingMs),
    },
    {
      key: "events",
      label: "Eventos",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) => {
        const { eventTotal, eventCritical } = countEvents(day);
        if (eventTotal === 0) return <span className={styles.dim}>—</span>;
        return (
          <>
            <span>{eventTotal}</span>
            {eventCritical > 0 && (
              <span className={styles.critical}> ({eventCritical}!)</span>
            )}
          </>
        );
      },
    },
  ];

  return (
    <DataTable<Day>
      columns={columns}
      rows={days}
      rowKey={(d) => d.id}
      title="Viajes por día"
      count={days.length}
      onRowClick={(d) => onSelectDay(d.id === selectedDayId ? null : d.id)}
      selectedRowKey={selectedDayId}
      density="normal"
      emptyMessage="Sin viajes en el período seleccionado."
      exportFormats={["csv"]}
      exportFilename="viajes-por-dia"
      exportColumns={[
        { header: "Dia", value: (d) => d.dayIso },
        { header: "Vehiculo", value: (d) => d.assetName },
        { header: "Patente", value: (d) => d.assetPlate ?? "" },
        { header: "Conductor", value: (d) => d.driverName ?? "" },
        { header: "Distancia (km)", value: (d) => d.totalDistanceKm },
        { header: "Viajes", value: (d) => d.tripCount },
        { header: "Paradas", value: (d) => d.stopCount },
        {
          header: "En ruta (min)",
          value: (d) => Math.round(d.totalDrivingMs / 60000),
        },
        {
          header: "Eventos totales",
          value: (d) => countEvents(d).eventTotal,
        },
        {
          header: "Eventos criticos",
          value: (d) => countEvents(d).eventCritical,
        },
      ]}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function countEvents(day: Day): {
  eventTotal: number;
  eventCritical: number;
} {
  let eventTotal = 0;
  let eventCritical = 0;
  for (const item of day.items) {
    if (item.kind === "trip") {
      eventTotal += item.eventCount;
      eventCritical += item.highSeverityEventCount;
    }
  }
  return { eventTotal, eventCritical };
}

const DOW = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DOW[date.getUTCDay()]} ${String(d).padStart(2, "0")} ${MES[m - 1]}`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatKm(km: number): string {
  return km.toLocaleString("es-AR", {
    maximumFractionDigits: km >= 100 ? 0 : 1,
  });
}
