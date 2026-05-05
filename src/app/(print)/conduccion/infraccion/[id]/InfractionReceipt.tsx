"use client";

import { Printer } from "lucide-react";
import type { InfractionDetail } from "@/lib/queries/infractions-list";
import {
  SpeedCurve,
  parseTrackToSpeedSamples,
} from "@/components/maxtracker/infractions/SpeedCurve";
import { InfractionPrintMap } from "@/components/maxtracker/infractions/InfractionPrintMap";
import styles from "./Receipt.module.css";

// ═══════════════════════════════════════════════════════════════
//  InfractionReceipt · S4-L3d
//  ─────────────────────────────────────────────────────────────
//  Recibo imprimible de una infracción de velocidad. Diseñado
//  para A4 con CSS @page · el usuario hace Cmd+P para guardar
//  como PDF. Replica la información del recibo legacy mejorada
//  con la curva velocidad/tiempo (que el legacy no tenía).
//
//  Layout (de arriba a abajo, una sola página A4):
//    1. Header · MAXTRACKER + título "RECIBO DE INFRACCIÓN"
//    2. Datos · 2 columnas con todos los campos
//    3. Mapa con polilínea
//    4. Curva velocidad/tiempo
//    5. Footer · operador que generó · datos contacto Maxtracker
//
//  Si la infracción está descartada · banner rojo con razón.
// ═══════════════════════════════════════════════════════════════

interface Props {
  infraction: InfractionDetail;
  generatedBy: string;
  generatedAtIso: string;
}

const SEVERITY_LABELS: Record<string, string> = {
  LEVE: "LEVE",
  MEDIA: "MEDIA",
  GRAVE: "GRAVE",
};

const SEVERITY_COLORS: Record<string, string> = {
  LEVE: "#f59e0b",
  MEDIA: "#ea580c",
  GRAVE: "#dc2626",
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
  SUSTANCIAS_PELIGROSAS: "Sust. peligrosas",
  MAQUINA_VIAL: "Máquina vial",
  ASSET_FIJO: "Asset fijo",
};

const DISCARD_REASON_LABELS: Record<string, string> = {
  WRONG_SPEED_LIMIT: "Límite de velocidad incorrecto",
  WRONG_ROAD_TYPE: "El tipo de camino no coincide",
  POOR_GPS_QUALITY: "Mala calidad de las posiciones GPS",
  DRIVER_VEHICLE_IMMUNITY: "Chofer / Vehículo con inmunidad",
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function InfractionReceipt({
  infraction,
  generatedBy,
  generatedAtIso,
}: Props) {
  const sevColor = SEVERITY_COLORS[infraction.severity] ?? "#64748b";
  const speedSamples = parseTrackToSpeedSamples(infraction.trackJson);
  const isDiscarded = infraction.status === "DISCARDED";

  return (
    <div className={styles.report}>
      {/* Botón flotante (no se imprime) */}
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

      <div className={styles.page}>
        {/* ── 1. Header ─────────────────────────────────────── */}
        <header className={styles.docHeader}>
          <div className={styles.brand}>
            <span className={styles.brandWord}>MAXTRACKER</span>
            <span className={styles.brandSubtitle}>
              Telemática para flotas
            </span>
          </div>
          <div className={styles.docTitle}>
            RECIBO DE INFRACCIÓN
            <div className={styles.docId}>#{infraction.id.slice(-8).toUpperCase()}</div>
          </div>
        </header>

        {isDiscarded && (
          <div className={styles.discardedBanner}>
            <strong>Infracción descartada</strong>
            {infraction.discardReason && (
              <>
                {" · "}
                {DISCARD_REASON_LABELS[infraction.discardReason] ??
                  infraction.discardReason}
              </>
            )}
            {infraction.discardedByName && (
              <> · por {infraction.discardedByName}</>
            )}
            {infraction.discardedAt && (
              <>
                {" · "}
                {formatDateTime(infraction.discardedAt.toISOString())}
              </>
            )}
          </div>
        )}

        {/* ── 2. Datos · 2 columnas ─────────────────────────── */}
        <section className={styles.dataSection}>
          <div className={styles.dataCol}>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Nivel</span>
              <span
                className={styles.dataValueSeverity}
                style={{ color: sevColor }}
              >
                {SEVERITY_LABELS[infraction.severity]}
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Fecha</span>
              <span className={styles.dataValue}>
                {new Date(infraction.startedAtIso).toLocaleDateString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Dominio</span>
              <span className={styles.dataValueMono}>
                {infraction.assetPlate ?? infraction.assetName}
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Interno</span>
              <span className={styles.dataValueMono}>
                {infraction.assetName}
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Tipo de vehículo</span>
              <span className={styles.dataValue}>
                {VEHICLE_TYPE_LABELS[infraction.vehicleType] ??
                  infraction.vehicleType}
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Tipo de vía</span>
              <span className={styles.dataValue}>
                {ROAD_TYPE_LABELS[infraction.roadType] ?? infraction.roadType}
              </span>
            </div>
          </div>

          <div className={styles.dataCol}>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Máxima permitida</span>
              <span className={styles.dataValueBig}>
                {infraction.vmaxKmh} km/h
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Pico de velocidad</span>
              <span
                className={styles.dataValueBig}
                style={{ color: sevColor }}
              >
                {Math.round(infraction.peakSpeedKmh)} km/h
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Exceso máximo</span>
              <span
                className={styles.dataValueMono}
                style={{ color: sevColor }}
              >
                +{Math.round(infraction.maxExcessKmh)} km/h
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Duración</span>
              <span className={styles.dataValue}>
                {formatDuration(infraction.durationSec)}
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Distancia en exceso</span>
              <span className={styles.dataValue}>
                {(infraction.distanceMeters / 1000).toFixed(2)} km
              </span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.dataLabel}>Conductor</span>
              <span className={styles.dataValue}>
                {infraction.personName ?? (
                  <em className={styles.muted}>Sin asignar</em>
                )}
              </span>
            </div>
          </div>
        </section>

        {/* ── 3. Inicio / Fin con dirección ─────────────────── */}
        <section className={styles.locationSection}>
          <div className={styles.locationRow}>
            <span className={styles.locationDot} style={{ background: "#22c55e" }} />
            <div className={styles.locationData}>
              <div className={styles.locationLabel}>
                Inicio · {formatTime(infraction.startedAtIso)}
              </div>
              <div className={styles.locationValue}>
                {infraction.startAddress ?? (
                  <span className={styles.coords}>
                    {infraction.startLat.toFixed(5)}, {infraction.startLon.toFixed(5)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.locationRow}>
            <span className={styles.locationDot} style={{ background: "#dc2626" }} />
            <div className={styles.locationData}>
              <div className={styles.locationLabel}>
                Fin · {formatTime(infraction.endedAtIso)}
              </div>
              <div className={styles.locationValue}>
                {infraction.endAddress ?? (
                  <span className={styles.coords}>
                    {infraction.endLat.toFixed(5)}, {infraction.endLon.toFixed(5)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Mapa ───────────────────────────────────────── */}
        <section className={styles.mapSection}>
          <InfractionPrintMap
            startLat={infraction.startLat}
            startLon={infraction.startLon}
            endLat={infraction.endLat}
            endLon={infraction.endLon}
            trackJson={infraction.trackJson}
            color={sevColor}
          />
        </section>

        {/* ── 5. Curva velocidad/tiempo ─────────────────────── */}
        {speedSamples.length >= 2 && (
          <section className={styles.curveSection}>
            <SpeedCurve
              samples={speedSamples}
              vmaxKmh={infraction.vmaxKmh}
              color={sevColor}
              height={140}
              title="Velocidad durante la infracción"
            />
          </section>
        )}

        {/* ── 6. Footer ─────────────────────────────────────── */}
        <footer className={styles.docFooter}>
          <div className={styles.footerGenerated}>
            Recibo generado por <strong>{generatedBy}</strong> el{" "}
            {formatDateTime(generatedAtIso)}
          </div>
          <div className={styles.footerContact}>
            Maxtracker · Telemática para flotas LATAM
          </div>
        </footer>
      </div>
    </div>
  );
}
