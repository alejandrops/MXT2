"use client";

import { Printer } from "lucide-react";
import { TripPrintMap } from "@/components/maxtracker/trips/TripPrintMap";
import {
  tripNarrativeLead,
  tripReceiptFolio,
  tripUniqueIdentifier,
} from "@/lib/actividad/trip-receipt-text";
import { EVENT_TYPE_LABEL, SEVERITY_LABEL } from "@/lib/format";
import type { TripDetail } from "@/lib/queries/trip-detail";
import styles from "./Receipt.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripReceipt · S5-T4
//  ─────────────────────────────────────────────────────────────
//  Recibo editorial de viaje individual · misma piel que el
//  recibo de infracción (S4-L3d) · primera pieza del Sistema
//  Editorial Maxtracker para el módulo Actividad.
//
//  Lenguaje visual idéntico:
//    · Kicker "MAXTRACKER · ACTIVIDAD"
//    · Folio mono a la derecha
//    · Título serif IBM Plex Serif
//    · Lead narrativo (1-2 oraciones)
//    · 3 secciones numeradas:
//        01 · Recorrido (mapa con polilínea)
//        02 · Métricas del viaje (KPI strip 4 celdas)
//        03 · Eventos durante el viaje (resumen breve · lista)
//    · Footer editorial
//
//  Si el viaje no tuvo eventos · sección 03 muestra "Sin eventos
//  de conducción · viaje limpio".
//
//  CSS @page A4 · Cmd+P guarda como PDF nativo del browser.
// ═══════════════════════════════════════════════════════════════

interface Props {
  trip: TripDetail;
  generatedBy: string;
  generatedAtIso: string;
}

const ACCENT_COLOR = "#2563EB"; // Azul Maxtracker · neutro para viaje sin severity

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  MOTOCICLETA: "Motocicleta",
  LIVIANO: "Liviano",
  UTILITARIO: "Utilitario",
  PASAJEROS: "Pasajeros",
  CAMION_LIVIANO: "Camión liviano",
  CAMION_PESADO: "Camión pesado",
  SUSTANCIAS_PELIGROSAS: "Sustancias peligrosas",
  MAQUINA_VIAL: "Máquina vial",
  ASSET_FIJO: "Asset fijo",
};

// Color por severity para el dot del evento
const SEVERITY_DOT: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#f59e0b",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeWithSeconds(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationShort(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function TripReceipt({
  trip,
  generatedBy,
  generatedAtIso,
}: Props) {
  const folio = tripReceiptFolio({
    assetPlate: trip.assetPlate,
    assetId: trip.assetId,
    startedAt: trip.startedAt,
  });

  const fullId = tripUniqueIdentifier({
    assetPlate: trip.assetPlate,
    assetId: trip.assetId,
    startedAt: trip.startedAt,
    tripId: trip.id,
  });

  const lead = tripNarrativeLead({
    driverName: trip.personName,
    assetName: trip.assetName,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    durationMs: trip.durationMs,
    distanceKm: trip.distanceKm,
    avgSpeedKmh: trip.avgSpeedKmh,
    maxSpeedKmh: trip.maxSpeedKmh,
    startAddress: null,
    endAddress: null,
    startLat: trip.startLat,
    startLng: trip.startLng,
    endLat: trip.endLat,
    endLng: trip.endLng,
    eventCount: trip.eventCount,
    highSeverityEventCount: trip.highSeverityEventCount,
  });

  const subtitle = `${trip.assetName} · ${formatDateLong(
    trip.startedAtIso,
  )} · ${formatTimeShort(trip.startedAtIso)} ART`;

  return (
    <div className={styles.report}>
      <div className={styles.floatActions}>
        <button
          type="button"
          className={styles.printBtn}
          onClick={() => window.print()}
        >
          <Printer size={14} />
          Imprimir / Guardar PDF
        </button>
      </div>

      <article className={styles.page}>
        {/* ── Cabecera editorial ─────────────────────────────── */}
        <header className={styles.docHeader}>
          <div className={styles.kicker}>Maxtracker · Actividad</div>
          <div className={styles.folio}>{folio}</div>
        </header>

        {/* ── Título + subtítulo ─────────────────────────────── */}
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Recibo de viaje</h1>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>

        {/* ── Lead narrativo ─────────────────────────────────── */}
        <div
          className={styles.lead}
          style={{ borderLeftColor: ACCENT_COLOR }}
        >
          <div className={styles.leadProse}>{lead}</div>
        </div>

        {/* ── 01 · Recorrido ─────────────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionNum}>01</span>
            <h2 className={styles.sectionTitle}>Recorrido</h2>
          </header>
          <div className={styles.mapWrap}>
            <TripPrintMap
              startLat={trip.startLat}
              startLng={trip.startLng}
              endLat={trip.endLat}
              endLng={trip.endLng}
              polylineJson={trip.polylineJson}
              color={ACCENT_COLOR}
            />
          </div>
          <div className={styles.locationGrid}>
            <span className={styles.locationLabel}>Inicio</span>
            <span className={styles.locationValue}>
              <span className={styles.locationTime}>
                {formatTimeWithSeconds(trip.startedAtIso)}
              </span>
              <span className={styles.coords}>
                {trip.startLat.toFixed(5)}, {trip.startLng.toFixed(5)}
              </span>
            </span>
            <span className={styles.locationLabel}>Fin</span>
            <span className={styles.locationValue}>
              <span className={styles.locationTime}>
                {formatTimeWithSeconds(trip.endedAtIso)}
              </span>
              <span className={styles.coords}>
                {trip.endLat.toFixed(5)}, {trip.endLng.toFixed(5)}
              </span>
            </span>
          </div>
        </section>

        {/* ── 02 · Métricas del viaje ────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionNum}>02</span>
            <h2 className={styles.sectionTitle}>Métricas del viaje</h2>
          </header>

          <div className={styles.kpiStrip}>
            <div className={styles.kpiCell}>
              <div className={styles.kpiLabel}>Distancia</div>
              <div className={styles.kpiValue}>
                {trip.distanceKm < 100
                  ? trip.distanceKm.toFixed(1)
                  : Math.round(trip.distanceKm)}
              </div>
              <div className={styles.kpiUnit}>km</div>
            </div>
            <div className={styles.kpiCell}>
              <div className={styles.kpiLabel}>Duración</div>
              <div className={styles.kpiValue}>
                {formatDurationShort(trip.durationMs)}
              </div>
              <div className={styles.kpiUnit}>en ruta</div>
            </div>
            <div className={styles.kpiCell}>
              <div className={styles.kpiLabel}>Vel. media</div>
              <div className={styles.kpiValue}>
                {Math.round(trip.avgSpeedKmh)}
              </div>
              <div className={styles.kpiUnit}>km/h</div>
            </div>
            <div className={styles.kpiCell}>
              <div className={styles.kpiLabel}>Vel. máxima</div>
              <div className={styles.kpiValue}>
                {Math.round(trip.maxSpeedKmh)}
              </div>
              <div className={styles.kpiUnit}>km/h</div>
            </div>
          </div>

          <table className={styles.detailsTable}>
            <tbody>
              <tr>
                <td className={styles.detailLabel}>Vehículo</td>
                <td className={styles.detailValue}>
                  {trip.assetName}
                  {trip.assetPlate && (
                    <span className={styles.detailMono}>
                      {trip.assetPlate}
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className={styles.detailLabel}>Tipo</td>
                <td className={styles.detailValue}>
                  {VEHICLE_TYPE_LABELS[trip.vehicleType] ?? trip.vehicleType}
                </td>
              </tr>
              <tr>
                <td className={styles.detailLabel}>Conductor</td>
                <td className={styles.detailValue}>
                  {trip.personName ?? (
                    <em className={styles.muted}>Sin asignar</em>
                  )}
                </td>
              </tr>
              <tr>
                <td className={styles.detailLabel}>Inicio</td>
                <td className={styles.detailValue}>
                  {formatDateTime(trip.startedAtIso)} ART
                </td>
              </tr>
              <tr>
                <td className={styles.detailLabel}>Fin</td>
                <td className={styles.detailValue}>
                  {formatDateTime(trip.endedAtIso)} ART
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ── 03 · Eventos durante el viaje ──────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionNum}>03</span>
            <h2 className={styles.sectionTitle}>Eventos durante el viaje</h2>
          </header>

          {trip.events.length === 0 ? (
            <div className={styles.emptyEvents}>
              Sin eventos de conducción · viaje limpio.
            </div>
          ) : (
            <>
              <div className={styles.eventsSummary}>
                {trip.eventCount}{" "}
                {trip.eventCount === 1
                  ? "evento registrado"
                  : "eventos registrados"}
                {trip.highSeverityEventCount > 0 && (
                  <>
                    {" · "}
                    <span className={styles.criticalCount}>
                      {trip.highSeverityEventCount}{" "}
                      {trip.highSeverityEventCount === 1
                        ? "crítico"
                        : "críticos"}
                    </span>
                  </>
                )}
              </div>
              <ul className={styles.eventsList}>
                {trip.events.map((ev) => (
                  <li key={ev.id} className={styles.eventItem}>
                    <span className={styles.eventTime}>
                      {formatTimeShort(ev.occurredAtIso)}
                    </span>
                    <span
                      className={styles.eventDot}
                      style={{
                        background: SEVERITY_DOT[ev.severity] ?? "#94a3b8",
                      }}
                      aria-hidden="true"
                    />
                    <span className={styles.eventType}>
                      {EVENT_TYPE_LABEL[ev.type] ?? ev.type}
                    </span>
                    <span className={styles.eventSep}>·</span>
                    <span
                      className={styles.eventSev}
                      style={{
                        color: SEVERITY_DOT[ev.severity] ?? "#64748b",
                      }}
                    >
                      {SEVERITY_LABEL[ev.severity] ?? ev.severity}
                    </span>
                    {ev.speedKmh != null && (
                      <>
                        <span className={styles.eventSep}>·</span>
                        <span className={styles.eventSpeed}>
                          {Math.round(ev.speedKmh)} km/h
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* ── Pie editorial ──────────────────────────────────── */}
        <footer className={styles.docFooter}>
          <div className={styles.footerLine}>
            Documento generado automáticamente por Maxtracker
          </div>
          <div className={styles.footerLine}>
            Solicitado por <strong>{generatedBy}</strong> ·{" "}
            {formatDateTime(generatedAtIso)} ART
          </div>
          <div className={styles.footerId}>{fullId}</div>
        </footer>
      </article>
    </div>
  );
}
