"use client";

import { useState } from "react";
import {
  EVENT_TYPE_LABEL,
  formatDuration,
  formatNumber,
  SEVERITY_LABEL,
} from "@/lib/format";
import type {
  DailyTrajectory,
  Segment,
  TrajectoryEvent,
} from "@/lib/queries/historicos";
import { SegmentList } from "./SegmentList";
import styles from "./TripDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripDetailPanel
//  ─────────────────────────────────────────────────────────────
//  Right-side panel:
//    · Trip stats (start, end, duration, distance, speeds, counts)
//    · Tabs · [Viajes] (segments) · [Eventos]
//
//  Both lists are clickable in interactive mode (parent provides
//  onEventClick / onSegmentClick to seek the playback cursor).
// ═══════════════════════════════════════════════════════════════

type Tab = "trips" | "events";

interface TripDetailPanelProps {
  trajectory: DailyTrajectory;
  onEventClick?: (event: TrajectoryEvent) => void;
  onSegmentClick?: (segment: Segment) => void;
}

export function TripDetailPanel({
  trajectory,
  onEventClick,
  onSegmentClick,
}: TripDetailPanelProps) {
  const { stats, events, segments } = trajectory;
  const [tab, setTab] = useState<Tab>("trips");

  return (
    <aside className={styles.panel}>
      {/* ── Stats section ───────────────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Resumen del día</h3>

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Inicio</dt>
            <dd className={styles.statValue}>
              {stats.startAt ? formatTime(new Date(stats.startAt)) : "—"}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Fin</dt>
            <dd className={styles.statValue}>
              {stats.endAt ? formatTime(new Date(stats.endAt)) : "—"}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Duración</dt>
            <dd className={styles.statValue}>
              {stats.durationMs > 0 ? formatDuration(stats.durationMs) : "—"}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Distancia</dt>
            <dd className={styles.statValue}>
              {stats.distanceKm > 0
                ? `${stats.distanceKm.toFixed(1)} km`
                : "—"}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Vel. máxima</dt>
            <dd className={styles.statValue}>
              {stats.maxSpeedKmh > 0
                ? `${Math.round(stats.maxSpeedKmh)} km/h`
                : "—"}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Vel. promedio</dt>
            <dd className={styles.statValue}>
              {stats.avgSpeedKmh > 0
                ? `${Math.round(stats.avgSpeedKmh)} km/h`
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Tab switcher ────────────────────────────────────── */}
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "trips"}
          className={`${styles.tab} ${tab === "trips" ? styles.tabActive : ""}`}
          onClick={() => setTab("trips")}
        >
          Viajes y paradas
          <span className={styles.tabCount}>
            {formatNumber(segments.length)}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "events"}
          className={`${styles.tab} ${tab === "events" ? styles.tabActive : ""}`}
          onClick={() => setTab("events")}
        >
          Eventos
          <span className={styles.tabCount}>
            {formatNumber(events.length)}
          </span>
        </button>
      </div>

      {/* ── Tab body ────────────────────────────────────────── */}
      {tab === "trips" ? (
        <SegmentList segments={segments} onSegmentClick={onSegmentClick} />
      ) : events.length === 0 ? (
        <div className={styles.empty}>Sin eventos registrados.</div>
      ) : (
        <ol className={styles.eventList}>
          {events.map((ev) => (
            <li key={ev.id} className={styles.eventLi}>
              {onEventClick ? (
                <button
                  type="button"
                  className={styles.eventRow}
                  onClick={() => onEventClick(ev)}
                  title="Ir al evento en mapa y línea de tiempo"
                >
                  <EventRowContent event={ev} />
                </button>
              ) : (
                <div className={styles.eventRow}>
                  <EventRowContent event={ev} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function EventRowContent({ event: ev }: { event: TrajectoryEvent }) {
  return (
    <>
      <span className={styles.eventTime}>
        {formatTime(new Date(ev.occurredAt))}
      </span>
      <span
        className={`${styles.eventDot} ${
          styles[`dot${ev.severity}` as keyof typeof styles] ?? ""
        }`}
      />
      <span className={styles.eventType}>
        {EVENT_TYPE_LABEL[ev.type] ?? ev.type}
      </span>
      <span
        className={`${styles.eventSev} ${
          styles[`sev${ev.severity}` as keyof typeof styles] ?? ""
        }`}
      >
        {SEVERITY_LABEL[ev.severity]}
      </span>
    </>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
