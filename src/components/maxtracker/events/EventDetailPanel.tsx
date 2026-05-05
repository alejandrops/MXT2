"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import type { EventListRow } from "@/lib/queries/events-list";
import { getEventLabel, getEventColor } from "@/lib/event-catalog";
import styles from "./EventDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  EventDetailPanel · S4-L2 · panel lateral con detalle del evento
//  ─────────────────────────────────────────────────────────────
//  Patrón consistente con TripDetailPanel ya existente.
//  Drill-down con:
//    · header · tipo + severity badge
//    · datos · ocurrió en, vehículo, conductor, velocidad
//    · mini-mapa centrado en lat/lng del evento
//    · links · ir al Libro del vehículo / del conductor
// ═══════════════════════════════════════════════════════════════

interface Props {
  event: EventListRow | null;
  onClose: () => void;
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "#64748b",
  MEDIUM: "#f59e0b",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

export function EventDetailPanel({ event, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  // Init mini-mapa
  useEffect(() => {
    if (!event || !event.lat || !event.lng || !containerRef.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      // Cleanup mapa anterior si existe
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
      }).setView([event.lat!, event.lng!], 15);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        { subdomains: "abcd", maxZoom: 19 },
      ).addTo(map);

      const color = getEventColor(event.type);
      L.circleMarker([event.lat!, event.lng!], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(map);

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [event]);

  // Close on ESC
  useEffect(() => {
    if (!event) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [event, onClose]);

  if (!event) return null;

  const label = getEventLabel(event.type);
  const sevColor = SEVERITY_COLORS[event.severity] ?? "#64748b";
  const occuredDate = new Date(event.occurredAt);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.panel} role="dialog" aria-modal="true">
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <span
              className={styles.dot}
              style={{ background: getEventColor(event.type) }}
            />
            <h2 className={styles.title}>{label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>
          {/* Severity badge */}
          <div className={styles.row}>
            <span className={styles.rowLabel}>Severidad</span>
            <span
              className={styles.severityBadge}
              style={{ color: sevColor, borderColor: sevColor }}
            >
              {SEVERITY_LABELS[event.severity] ?? event.severity}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Ocurrió</span>
            <span className={styles.rowValue}>
              {occuredDate.toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Vehículo</span>
            <Link
              href={`/objeto/vehiculo/${event.assetId}`}
              className={styles.link}
            >
              {event.assetName}
              {event.assetPlate && ` · ${event.assetPlate}`}
              <ExternalLink size={11} />
            </Link>
          </div>

          {event.personName && event.personId && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Conductor</span>
              <Link
                href={`/objeto/conductor/${event.personId}`}
                className={styles.link}
              >
                {event.personName}
                <ExternalLink size={11} />
              </Link>
            </div>
          )}

          {event.speedKmh !== null && event.speedKmh !== undefined && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Velocidad</span>
              <span className={styles.rowValue}>
                {Math.round(event.speedKmh)} km/h
              </span>
            </div>
          )}

          {event.lat && event.lng && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Ubicación</span>
              <span className={styles.rowValueMono}>
                {event.lat.toFixed(5)}, {event.lng.toFixed(5)}
              </span>
            </div>
          )}

          {/* Mini-mapa */}
          {event.lat && event.lng ? (
            <div className={styles.mapWrap}>
              <div ref={containerRef} className={styles.miniMap} />
            </div>
          ) : (
            <div className={styles.noMap}>
              Sin ubicación geográfica registrada
            </div>
          )}

          {/* Metadata extra (si existe) */}
          {event.metadata && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Datos adicionales</span>
              <pre className={styles.metadata}>{event.metadata}</pre>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
