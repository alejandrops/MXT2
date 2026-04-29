"use client";

import Link from "next/link";
import type { Day, DayItem } from "@/lib/queries/trips-by-day";
import { buildHistoricosHref } from "@/lib/url-historicos";
import styles from "./TripDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripDetailPanel · panel lateral con detalle del día
//  ─────────────────────────────────────────────────────────────
//  Estructura:
//    1. Header del día · vehículo, conductor, métricas resumen
//    2. Timeline cronológica · trips y paradas con click-select
//    3. Detalle inline del item seleccionado (si hay) · KPIs y
//       link al replay.
//
//  Si no hay item seleccionado, la timeline ocupa el resto del
//  panel. Cuando se selecciona uno, la timeline queda compacta
//  arriba y el detalle aparece abajo con scroll si hace falta.
// ═══════════════════════════════════════════════════════════════

interface Props {
  day: Day;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onClose: () => void;
}

export function TripDetailPanel({
  day,
  selectedItemId,
  onSelectItem,
  onClose,
}: Props) {
  const selectedItem = selectedItemId
    ? day.items.find((i) => i.id === selectedItemId) ?? null
    : null;

  return (
    <aside className={styles.panel}>
      {/* ── Header ───────────────────────────────────────── */}
      <header className={styles.panelHeader}>
        <div className={styles.titleWrap}>
          <h3 className={styles.title}>
            {formatDay(day.dayIso)} · {day.assetName}
          </h3>
          <span className={styles.subtitle}>
            {day.assetPlate && <>{day.assetPlate}</>}
            {day.assetPlate && day.driverName && <> · </>}
            {day.driverName && <>{day.driverName}</>}
          </span>
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Cerrar panel"
        >
          ×
        </button>
      </header>

      {/* ── Resumen del día (siempre visible) ─────────────── */}
      <div className={styles.daySummary}>
        <Metric label="Distancia" value={`${formatKm(day.totalDistanceKm)} km`} />
        <Metric label="Viajes" value={String(day.tripCount)} />
        <Metric label="Paradas" value={String(day.stopCount)} />
        <Metric label="En ruta" value={formatDuration(day.totalDrivingMs)} />
      </div>

      {/* ── Body · timeline + (opcional) detalle item ─────── */}
      <div className={styles.body}>
        <div className={styles.timelineSection}>
          <h4 className={styles.sectionTitle}>Cronología del día</h4>
          <ol className={styles.timeline}>
            {day.items.map((item) => (
              <TimelineRow
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onSelect={() =>
                  onSelectItem(item.id === selectedItemId ? null : item.id)
                }
              />
            ))}
          </ol>
        </div>

        {selectedItem && (
          <div className={styles.detailSection}>
            {selectedItem.kind === "trip" ? (
              <TripDetail day={day} item={selectedItem} />
            ) : (
              <StopDetail day={day} item={selectedItem} />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Timeline row · trip o stop compacto, clickeable
// ═══════════════════════════════════════════════════════════════

function TimelineRow({
  item,
  isSelected,
  onSelect,
}: {
  item: DayItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const baseClass = `${styles.timelineItem} ${
    item.kind === "trip" ? styles.timelineTrip : styles.timelineStop
  } ${item.kind === "stop" && item.isLong ? styles.timelineStopLong : ""} ${
    isSelected ? styles.timelineSelected : ""
  }`;

  return (
    <li
      className={baseClass}
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
      <span className={styles.timelineGlyph} aria-hidden="true">
        {item.kind === "trip" ? "▶" : "⏸"}
      </span>
      <span className={styles.timelineTime}>
        {formatTime(item.startedAt)} → {formatTime(item.endedAt)}
      </span>
      {item.kind === "trip" ? (
        <>
          <span className={styles.timelineDot}>·</span>
          <span className={styles.timelineValue}>
            {formatKm(item.distanceKm)} km
          </span>
          {item.eventCount > 0 && (
            <>
              <span className={styles.timelineDot}>·</span>
              <span
                className={
                  item.highSeverityEventCount > 0
                    ? styles.timelineEventHot
                    : styles.timelineDim
                }
              >
                {item.eventCount} ev
              </span>
            </>
          )}
        </>
      ) : (
        <>
          <span className={styles.timelineDot}>·</span>
          <span className={styles.timelineStopLabel}>
            {item.isLong ? "Parada larga" : "Parada"}
          </span>
          <span className={styles.timelineDot}>·</span>
          <span className={styles.timelineDim}>
            {formatDuration(item.durationMs)}
          </span>
        </>
      )}
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Detalle de un trip seleccionado
// ═══════════════════════════════════════════════════════════════

function TripDetail({
  day,
  item,
}: {
  day: Day;
  item: Extract<DayItem, { kind: "trip" }>;
}) {
  const dayIso = day.dayIso;
  const fromTime = formatTime(item.startedAt);
  const toTime = formatTime(item.endedAt);
  const replayHref = buildHistoricosHref(
    { assetId: null, date: null, fromTime: null, toTime: null },
    {
      assetId: day.assetId,
      date: dayIso,
      fromTime,
      toTime: fromTime < toTime ? toTime : null,
    },
  );

  return (
    <>
      <h4 className={styles.sectionTitle}>
        Viaje {fromTime} → {toTime}
      </h4>
      <div className={styles.kpiGrid}>
        <Kpi label="Distancia" value={`${formatKm(item.distanceKm)} km`} />
        <Kpi label="Duración" value={formatDuration(item.durationMs)} />
        <Kpi
          label="Vel. promedio"
          value={`${Math.round(item.avgSpeedKmh)} km/h`}
        />
        <Kpi
          label="Vel. máxima"
          value={`${Math.round(item.maxSpeedKmh)} km/h`}
        />
      </div>

      {item.eventCount > 0 ? (
        <p className={styles.eventLine}>
          {item.eventCount} {item.eventCount === 1 ? "evento" : "eventos"}
          {item.highSeverityEventCount > 0 && (
            <span className={styles.severityBadge}>
              {" · "}
              {item.highSeverityEventCount} crítico
              {item.highSeverityEventCount === 1 ? "" : "s"}
            </span>
          )}
        </p>
      ) : (
        <p className={styles.dimText}>Sin eventos en este viaje.</p>
      )}

      <Link href={replayHref} className={styles.replayLink}>
        Ver replay completo →
      </Link>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Detalle de un stop seleccionado
// ═══════════════════════════════════════════════════════════════

function StopDetail({
  day,
  item,
}: {
  day: Day;
  item: Extract<DayItem, { kind: "stop" }>;
}) {
  const idx = day.items.findIndex((i) => i.id === item.id);
  const prevTrip =
    idx > 0 && day.items[idx - 1]?.kind === "trip"
      ? (day.items[idx - 1] as Extract<DayItem, { kind: "trip" }>)
      : null;
  const nextTrip =
    idx < day.items.length - 1 && day.items[idx + 1]?.kind === "trip"
      ? (day.items[idx + 1] as Extract<DayItem, { kind: "trip" }>)
      : null;

  return (
    <>
      <h4 className={styles.sectionTitle}>
        {item.isLong ? "Parada larga" : "Parada"}{" "}
        {formatTime(item.startedAt)} → {formatTime(item.endedAt)}
      </h4>
      <div className={styles.kpiGrid}>
        <Kpi label="Duración" value={formatDuration(item.durationMs)} />
        <Kpi
          label="Tipo"
          value={item.isLong ? "Larga (>1h)" : "Corta"}
        />
      </div>

      <p className={styles.coords}>
        {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
      </p>
      <p className={styles.placeholder}>
        Reverse geocoding (calle, ciudad) · próximamente.
      </p>

      {(prevTrip || nextTrip) && (
        <ul className={styles.contextList}>
          {prevTrip && (
            <li>
              Llegó tras viaje de {formatKm(prevTrip.distanceKm)} km ·{" "}
              {formatDuration(prevTrip.durationMs)}
            </li>
          )}
          {nextTrip && (
            <li>
              Salió a viaje de {formatKm(nextTrip.distanceKm)} km ·{" "}
              {formatDuration(nextTrip.durationMs)}
            </li>
          )}
        </ul>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-componentes compartidos
// ═══════════════════════════════════════════════════════════════

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
    </div>
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
