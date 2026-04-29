"use client";

import type { Day } from "@/lib/queries/trips-by-day";
import styles from "./DaysList.module.css";

// ═══════════════════════════════════════════════════════════════
//  DaysList · tabla densa Tufte · una fila por (día, asset)
//  ─────────────────────────────────────────────────────────────
//  Reemplaza al approach de cards anidadas (frágil, fallaba con
//  CSS scoping). HTML <table> nativa = robusta, ordenable mental-
//  mente, copy-paste friendly a Excel.
//
//  Click en fila → onSelectDay(dayId) → abre panel lateral con
//  timeline cronológica del día. Click otra vez = deselecciona.
//
//  Header sticky para que las columnas siempre se vean al scroll.
// ═══════════════════════════════════════════════════════════════

interface Props {
  days: Day[];
  selectedDayId: string | null;
  onSelectDay: (id: string | null) => void;
}

export function DaysList({ days, selectedDayId, onSelectDay }: Props) {
  if (days.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Sin viajes en el período seleccionado.</p>
        <p className={styles.emptyHint}>
          Probá con un rango más amplio o quitá filtros.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th className={styles.thDay}>Día</th>
            <th className={styles.thAsset}>Vehículo</th>
            <th className={styles.thDriver}>Conductor</th>
            <th className={styles.thNum}>Distancia</th>
            <th className={styles.thNum}>Viajes</th>
            <th className={styles.thNum}>Paradas</th>
            <th className={styles.thNum}>En ruta</th>
            <th className={styles.thNum}>Eventos</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <Row
              key={day.id}
              day={day}
              isSelected={selectedDayId === day.id}
              onSelect={() =>
                onSelectDay(day.id === selectedDayId ? null : day.id)
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Row · una fila por (día, asset)
// ═══════════════════════════════════════════════════════════════

function Row({
  day,
  isSelected,
  onSelect,
}: {
  day: Day;
  isSelected: boolean;
  onSelect: () => void;
}) {
  // Calcular events totales y críticos del día (sumados de los trips)
  let eventTotal = 0;
  let eventCritical = 0;
  for (const item of day.items) {
    if (item.kind === "trip") {
      eventTotal += item.eventCount;
      eventCritical += item.highSeverityEventCount;
    }
  }

  return (
    <tr
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <td className={styles.tdDay}>{formatDay(day.dayIso)}</td>
      <td className={styles.tdAsset}>
        <span className={styles.assetName}>{day.assetName}</span>
        {day.assetPlate && (
          <span className={styles.plate}> · {day.assetPlate}</span>
        )}
      </td>
      <td className={styles.tdDriver}>
        {day.driverName ?? <span className={styles.dim}>—</span>}
      </td>
      <td className={styles.tdNum}>
        {formatKm(day.totalDistanceKm)}
        <span className={styles.unit}> km</span>
      </td>
      <td className={styles.tdNum}>{day.tripCount}</td>
      <td className={styles.tdNum}>
        {day.stopCount === 0 ? (
          <span className={styles.dim}>—</span>
        ) : (
          day.stopCount
        )}
      </td>
      <td className={styles.tdNum}>{formatDuration(day.totalDrivingMs)}</td>
      <td className={styles.tdNum}>
        {eventTotal === 0 ? (
          <span className={styles.dim}>—</span>
        ) : (
          <>
            <span>{eventTotal}</span>
            {eventCritical > 0 && (
              <span className={styles.critical}>
                {" "}
                ({eventCritical}!)
              </span>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

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
