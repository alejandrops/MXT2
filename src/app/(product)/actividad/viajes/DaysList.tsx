"use client";

import type { Day, DayItem } from "@/lib/queries/trips-by-day";
import styles from "./DaysList.module.css";

// ═══════════════════════════════════════════════════════════════
//  DaysList · listado vertical de tarjetas Día
//  ─────────────────────────────────────────────────────────────
//  Cada tarjeta tiene un header (asset, conductor, fecha, métricas
//  resumen) y una lista de items intercalados (trips + paradas
//  ordenados cronológicamente).
//
//  Click en cualquier item · resalta en el mapa + abre el panel
//  lateral. La selección es persistente · solo se cambia con otro
//  click.
// ═══════════════════════════════════════════════════════════════

interface Props {
  days: Day[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
}

export function DaysList({ days, selectedItemId, onSelectItem }: Props) {
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
    <div className={styles.list}>
      {days.map((day) => (
        <DayCard
          key={day.id}
          day={day}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

function DayCard({
  day,
  selectedItemId,
  onSelectItem,
}: {
  day: Day;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
}) {
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <div className={styles.headerLine}>
          <span className={styles.dayLabel}>{formatDay(day.dayIso)}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.assetName}>{day.assetName}</span>
          {day.assetPlate && (
            <>
              <span className={styles.dot}>·</span>
              <span className={styles.plate}>{day.assetPlate}</span>
            </>
          )}
          {day.driverName && (
            <>
              <span className={styles.dot}>·</span>
              <span className={styles.driver}>{day.driverName}</span>
            </>
          )}
        </div>
        <div className={styles.summary}>
          <Metric value={`${formatKm(day.totalDistanceKm)} km`} />
          <span className={styles.dot}>·</span>
          <Metric
            value={`${day.tripCount} ${day.tripCount === 1 ? "viaje" : "viajes"}`}
          />
          {day.stopCount > 0 && (
            <>
              <span className={styles.dot}>·</span>
              <Metric
                value={`${day.stopCount} ${day.stopCount === 1 ? "parada" : "paradas"}`}
              />
            </>
          )}
          <span className={styles.dot}>·</span>
          <Metric value={`${formatDuration(day.totalDrivingMs)} en ruta`} />
        </div>
      </header>

      <ol className={styles.items}>
        {day.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isSelected={selectedItemId === item.id}
            onSelect={() => onSelectItem(item.id)}
          />
        ))}
      </ol>
    </article>
  );
}

function ItemRow({
  item,
  isSelected,
  onSelect,
}: {
  item: DayItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  if (item.kind === "trip") {
    return (
      <li
        className={`${styles.item} ${styles.itemTrip} ${isSelected ? styles.itemSelected : ""}`}
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
        <span className={styles.glyph} aria-hidden="true">▶</span>
        <span className={styles.timeRange}>
          {formatTime(item.startedAt)} → {formatTime(item.endedAt)}
        </span>
        <span className={styles.dot}>·</span>
        <span className={styles.value}>{formatKm(item.distanceKm)} km</span>
        <span className={styles.dot}>·</span>
        <span className={styles.dim}>
          {Math.round(item.avgSpeedKmh)} km/h prom
        </span>
        {item.eventCount > 0 && (
          <>
            <span className={styles.dot}>·</span>
            <span
              className={
                item.highSeverityEventCount > 0
                  ? styles.eventHot
                  : styles.dim
              }
            >
              {item.eventCount}{" "}
              {item.eventCount === 1 ? "evento" : "eventos"}
            </span>
          </>
        )}
      </li>
    );
  }

  // Stop
  return (
    <li
      className={`${styles.item} ${styles.itemStop} ${item.isLong ? styles.itemStopLong : ""} ${isSelected ? styles.itemSelected : ""}`}
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
      <span className={styles.glyph} aria-hidden="true">⏸</span>
      <span className={styles.timeRange}>
        {formatTime(item.startedAt)} → {formatTime(item.endedAt)}
      </span>
      <span className={styles.dot}>·</span>
      <span className={styles.stopLabel}>
        {item.isLong ? "Parada larga" : "Parada"}
      </span>
      <span className={styles.dot}>·</span>
      <span className={styles.dim}>{formatDuration(item.durationMs)}</span>
    </li>
  );
}

function Metric({ value }: { value: string }) {
  return <span className={styles.metric}>{value}</span>;
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

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
