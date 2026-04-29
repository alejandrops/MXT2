"use client";

import Link from "next/link";
import type { Day, DayItem } from "@/lib/queries/trips-by-day";
import { buildHistoricosHref } from "@/lib/url-historicos";
import styles from "./TripDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripDetailPanel · panel lateral con detalle de viaje o parada
//  ─────────────────────────────────────────────────────────────
//  Se muestra cuando el usuario hace click en un item de DaysList.
//  Su shape difiere según item.kind:
//    · trip  · KPIs + (futuro) eventos + link a replay
//    · stop  · ubicación + duración + contexto del día
//
//  Cuando aparece, la columna del mapa se reduce y este panel
//  ocupa parte del espacio · ver TripsClient.module.css.
// ═══════════════════════════════════════════════════════════════

interface Props {
  day: Day;
  item: DayItem;
  onClose: () => void;
}

export function TripDetailPanel({ day, item, onClose }: Props) {
  return (
    <aside className={styles.panel}>
      <header className={styles.panelHeader}>
        <div className={styles.titleWrap}>
          <h3 className={styles.title}>
            {item.kind === "trip"
              ? `Viaje ${formatTime(item.startedAt)} → ${formatTime(item.endedAt)}`
              : `Parada ${formatTime(item.startedAt)} → ${formatTime(item.endedAt)}`}
          </h3>
          <span className={styles.subtitle}>
            {day.assetName}
            {day.assetPlate && ` · ${day.assetPlate}`}
            {day.driverName && ` · ${day.driverName}`}
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

      <div className={styles.body}>
        {item.kind === "trip" ? (
          <TripBody day={day} item={item} />
        ) : (
          <StopBody day={day} item={item} />
        )}
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Trip body
// ═══════════════════════════════════════════════════════════════

function TripBody({
  day,
  item,
}: {
  day: Day;
  item: Extract<DayItem, { kind: "trip" }>;
}) {
  // Construir el link de Históricos con el rango horario del viaje
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
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>
            Eventos · {item.eventCount}
            {item.highSeverityEventCount > 0 && (
              <span className={styles.severityBadge}>
                {item.highSeverityEventCount} crítico
                {item.highSeverityEventCount === 1 ? "" : "s"}
              </span>
            )}
          </h4>
          <p className={styles.placeholder}>
            Listado detallado de eventos próximamente · por ahora abrí
            el replay completo para verlos sobre el recorrido.
          </p>
        </section>
      ) : (
        <section className={styles.section}>
          <p className={styles.dimText}>Sin eventos en este viaje.</p>
        </section>
      )}

      <Link href={replayHref} className={styles.replayLink}>
        Ver replay completo →
      </Link>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Stop body
// ═══════════════════════════════════════════════════════════════

function StopBody({
  day,
  item,
}: {
  day: Day;
  item: Extract<DayItem, { kind: "stop" }>;
}) {
  // Encontrar el viaje anterior y siguiente para dar contexto
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
      <div className={styles.kpiGrid}>
        <Kpi label="Duración" value={formatDuration(item.durationMs)} />
        <Kpi
          label="Tipo"
          value={item.isLong ? "Parada larga" : "Parada"}
        />
      </div>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Ubicación</h4>
        <p className={styles.coords}>
          {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
        </p>
        <p className={styles.placeholder}>
          Reverse geocoding (calle, ciudad) · próximamente.
        </p>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Contexto del día</h4>
        <ul className={styles.contextList}>
          {prevTrip && (
            <li>
              Llegó tras viaje desde{" "}
              {prevTrip.startLat.toFixed(3)}, {prevTrip.startLng.toFixed(3)}{" "}
              ({formatKm(prevTrip.distanceKm)} km ·{" "}
              {formatDuration(prevTrip.durationMs)})
            </li>
          )}
          {nextTrip && (
            <li>
              Salió hacia {nextTrip.endLat.toFixed(3)},{" "}
              {nextTrip.endLng.toFixed(3)} ({formatKm(nextTrip.distanceKm)}{" "}
              km · {formatDuration(nextTrip.durationMs)})
            </li>
          )}
          {!prevTrip && !nextTrip && (
            <li className={styles.dimText}>Sin viajes adyacentes.</li>
          )}
        </ul>
      </section>
    </>
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
