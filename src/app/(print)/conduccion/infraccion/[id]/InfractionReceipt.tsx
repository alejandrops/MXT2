"use client";

import { Printer } from "lucide-react";
import type { InfractionDetail } from "@/lib/queries/infractions-list";
import {
  SpeedCurve,
  parseTrackToSpeedSamples,
} from "@/components/maxtracker/infractions/SpeedCurve";
import { InfractionPrintMap } from "@/components/maxtracker/infractions/InfractionPrintMap";
import {
  narrativeLead,
  receiptFolio,
  uniqueIdentifier,
} from "@/lib/conduccion/receipt-text";
import styles from "./Receipt.module.css";

// ═══════════════════════════════════════════════════════════════
//  InfractionReceipt v2 · S4-L3d-redesign
//  ─────────────────────────────────────────────────────────────
//  Recibo editorial de infracción · primera pieza del Sistema
//  Editorial Maxtracker (Boletín Conducción · Boletín Dirección
//  · Recibos puntuales).
//
//  Lenguaje visual:
//    · Kicker "MAXTRACKER · CONDUCCIÓN" en uppercase con tracking
//    · Folio mono a la derecha
//    · Título serif IBM Plex Serif
//    · Lead narrativo (1 oración) sobre fondo gris con barra de
//      color por severity
//    · 3 secciones numeradas 01/02/03 con tracking
//    · KPI strip de 4 celdas (pico/vmax/exceso/distancia)
//    · Tabla de detalles sin bordes verticales
//    · Footer editorial con autoría, solicitud humana, ID único
//
//  CSS @page A4 · el usuario hace Cmd+P y guarda como PDF nativo
//  del browser. El botón flotante "Imprimir / Guardar PDF" no se
//  imprime gracias a @media print { display: none }.
// ═══════════════════════════════════════════════════════════════

interface Props {
  infraction: InfractionDetail;
  generatedBy: string;
  generatedAtIso: string;
}

const SEVERITY_LABELS: Record<string, string> = {
  LEVE: "Leve",
  MEDIA: "Media",
  GRAVE: "Grave",
};

// Paleta funcional · solo dos tonos por severity, sin saturar
const SEVERITY_COLORS: Record<string, { strong: string; soft: string }> = {
  LEVE: { strong: "#854F0B", soft: "#FAEEDA" }, // amber 800 / 50
  MEDIA: { strong: "#993C1D", soft: "#FAECE7" }, // coral 800 / 50
  GRAVE: { strong: "#A32D2D", soft: "#FCEBEB" }, // red 600 / 50
};

const ROAD_TYPE_LABELS: Record<string, string> = {
  URBANO_CALLE: "Calle urbana",
  URBANO_AVENIDA: "Avenida urbana",
  RURAL: "Ruta",
  SEMIAUTOPISTA: "Semiautopista",
  AUTOPISTA: "Autopista",
  CAMINO_RURAL: "Camino rural",
  DESCONOCIDO: "Sin clasificar",
};

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

const DISCARD_REASON_LABELS: Record<string, string> = {
  WRONG_SPEED_LIMIT: "Límite de velocidad incorrecto",
  WRONG_ROAD_TYPE: "El tipo de camino no coincide",
  POOR_GPS_QUALITY: "Mala calidad de las posiciones GPS",
  DRIVER_VEHICLE_IMMUNITY: "Chofer / Vehículo con inmunidad",
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
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InfractionReceipt({
  infraction,
  generatedBy,
  generatedAtIso,
}: Props) {
  const sev = SEVERITY_COLORS[infraction.severity] ?? {
    strong: "#444441",
    soft: "#F1EFE8",
  };
  const speedSamples = parseTrackToSpeedSamples(infraction.trackJson);
  const isDiscarded = infraction.status === "DISCARDED";

  const folio = receiptFolio({
    assetPlate: infraction.assetPlate,
    assetId: infraction.assetId,
    startedAt: infraction.startedAt,
  });

  const fullId = uniqueIdentifier({
    assetPlate: infraction.assetPlate,
    assetId: infraction.assetId,
    startedAt: infraction.startedAt,
    infractionId: infraction.id,
  });

  const lead = narrativeLead({
    driverName: infraction.personName,
    assetName: infraction.assetName,
    assetPlate: infraction.assetPlate,
    startedAt: infraction.startedAt,
    durationSec: infraction.durationSec,
    vmaxKmh: infraction.vmaxKmh,
    peakSpeedKmh: infraction.peakSpeedKmh,
    maxExcessKmh: infraction.maxExcessKmh,
    startAddress: infraction.startAddress,
    startLat: infraction.startLat,
    startLon: infraction.startLon,
  });

  const subtitle = `${infraction.assetName} · ${formatDateLong(
    infraction.startedAtIso,
  )} · ${formatTimeShort(infraction.startedAtIso)} ART`;

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
          <div className={styles.kicker}>Maxtracker · Conducción</div>
          <div className={styles.folio}>{folio}</div>
        </header>

        {/* ── Título + subtítulo ─────────────────────────────── */}
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Recibo de infracción de velocidad</h1>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>

        {/* ── Banner si está descartada (precede al lead) ────── */}
        {isDiscarded && (
          <div className={styles.discardedBanner}>
            <div className={styles.discardedTitle}>Documento descartado</div>
            <div className={styles.discardedBody}>
              {infraction.discardReason && (
                <>
                  Razón:{" "}
                  {DISCARD_REASON_LABELS[infraction.discardReason] ??
                    infraction.discardReason}
                  .{" "}
                </>
              )}
              {infraction.discardedByName && (
                <>Decisión registrada por {infraction.discardedByName}</>
              )}
              {infraction.discardedAt && (
                <>
                  {" "}
                  el {formatDateTime(infraction.discardedAt.toISOString())} ART.
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Lead narrativo · la "noticia" ──────────────────── */}
        <div
          className={styles.lead}
          style={{ borderLeftColor: sev.strong }}
        >
          <div className={styles.leadProse}>{lead}</div>
          <div className={styles.leadMeta}>
            <span className={styles.leadMetaLabel}>Severidad</span>
            <span
              className={styles.severityChip}
              style={{
                color: sev.strong,
                borderColor: sev.strong,
              }}
            >
              {SEVERITY_LABELS[infraction.severity]}
            </span>
          </div>
        </div>

        {/* ── 01 · Evidencia geográfica ──────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionNum}>01</span>
            <h2 className={styles.sectionTitle}>Evidencia geográfica</h2>
          </header>
          <div className={styles.mapWrap}>
            <InfractionPrintMap
              startLat={infraction.startLat}
              startLon={infraction.startLon}
              endLat={infraction.endLat}
              endLon={infraction.endLon}
              trackJson={infraction.trackJson}
              color={sev.strong}
            />
          </div>
          <div className={styles.locationGrid}>
            <span className={styles.locationLabel}>Inicio</span>
            <span className={styles.locationValue}>
              <span className={styles.locationTime}>
                {formatTimeWithSeconds(infraction.startedAtIso)}
              </span>
              {infraction.startAddress ?? (
                <span className={styles.coords}>
                  {infraction.startLat.toFixed(5)},{" "}
                  {infraction.startLon.toFixed(5)}
                </span>
              )}
            </span>
            <span className={styles.locationLabel}>Fin</span>
            <span className={styles.locationValue}>
              <span className={styles.locationTime}>
                {formatTimeWithSeconds(infraction.endedAtIso)}
              </span>
              {infraction.endAddress ?? (
                <span className={styles.coords}>
                  {infraction.endLat.toFixed(5)},{" "}
                  {infraction.endLon.toFixed(5)}
                </span>
              )}
            </span>
          </div>
        </section>

        {/* ── 02 · Perfil de velocidad ───────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionNum}>02</span>
            <h2 className={styles.sectionTitle}>Perfil de velocidad</h2>
          </header>

          <div className={styles.kpiStrip}>
            <div className={styles.kpiCell}>
              <div className={styles.kpiLabel}>Pico</div>
              <div
                className={styles.kpiValue}
                style={{ color: sev.strong }}
              >
                {Math.round(infraction.peakSpeedKmh)}
              </div>
              <div className={styles.kpiUnit}>km/h</div>
            </div>
            <div className={styles.kpiCell}>
              <div className={styles.kpiLabel}>Vmax</div>
              <div className={styles.kpiValue}>{infraction.vmaxKmh}</div>
              <div className={styles.kpiUnit}>km/h</div>
            </div>
            <div className={styles.kpiCell}>
              <div className={styles.kpiLabel}>Exceso</div>
              <div
                className={styles.kpiValue}
                style={{ color: sev.strong }}
              >
                +{Math.round(infraction.maxExcessKmh)}
              </div>
              <div className={styles.kpiUnit}>km/h</div>
            </div>
            <div className={styles.kpiCell}>
              <div className={styles.kpiLabel}>Distancia</div>
              <div className={styles.kpiValue}>
                {(infraction.distanceMeters / 1000).toFixed(2)}
              </div>
              <div className={styles.kpiUnit}>km</div>
            </div>
          </div>

          {speedSamples.length >= 2 && (
            <div className={styles.curveWrap}>
              <SpeedCurve
                samples={speedSamples}
                vmaxKmh={infraction.vmaxKmh}
                color={sev.strong}
                height={130}
              />
            </div>
          )}
        </section>

        {/* ── 03 · Detalles del incidente ────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionNum}>03</span>
            <h2 className={styles.sectionTitle}>Detalles del incidente</h2>
          </header>
          <table className={styles.detailsTable}>
            <tbody>
              <tr>
                <td className={styles.detailLabel}>Vehículo</td>
                <td className={styles.detailValue}>
                  {infraction.assetName}
                  {infraction.assetPlate && (
                    <span className={styles.detailMono}>
                      {infraction.assetPlate}
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className={styles.detailLabel}>Tipo</td>
                <td className={styles.detailValue}>
                  {VEHICLE_TYPE_LABELS[infraction.vehicleType] ??
                    infraction.vehicleType}
                </td>
              </tr>
              <tr>
                <td className={styles.detailLabel}>Tipo de vía</td>
                <td className={styles.detailValue}>
                  {ROAD_TYPE_LABELS[infraction.roadType] ?? infraction.roadType}
                </td>
              </tr>
              <tr>
                <td className={styles.detailLabel}>Conductor</td>
                <td className={styles.detailValue}>
                  {infraction.personName ?? (
                    <em className={styles.muted}>Sin asignar</em>
                  )}
                </td>
              </tr>
              <tr>
                <td className={styles.detailLabel}>Detectada</td>
                <td className={styles.detailValue}>
                  {formatDateTime(infraction.startedAtIso)} ART
                </td>
              </tr>
            </tbody>
          </table>
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
