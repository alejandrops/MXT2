// @ts-nocheck · pre-existing patterns (Prisma types stale, leaflet sin types)
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X, ExternalLink, Printer } from "lucide-react";
import type { InfractionListRow } from "@/lib/queries/infractions-list";
import { discardInfraction } from "@/app/(product)/conduccion/infracciones/actions";
import {
  SpeedCurve,
  parseTrackToSpeedSamples,
} from "./SpeedCurve";
import styles from "./InfractionDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  InfractionDetailPanel · S4-L3c
//  ─────────────────────────────────────────────────────────────
//  Panel lateral con detalle de una infracción. Diferencias vs
//  EventDetailPanel:
//    1. Polilínea del segmento (tramo, no punto único)
//    2. Curva velocidad/tiempo SVG inline
//    3. Datos · vmax aplicada, pico, exceso, duración, distancia
//    4. Bloque "Descartar infracción" con razones tipificadas
// ═══════════════════════════════════════════════════════════════

interface Props {
  infraction: InfractionListRow | null;
  onClose: () => void;
}

const SEVERITY_LABELS: Record<string, string> = {
  LEVE: "Leve",
  MEDIA: "Media",
  GRAVE: "Grave",
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

const DISCARD_REASON_LABELS: Record<string, string> = {
  WRONG_SPEED_LIMIT: "Límite de velocidad incorrecto",
  WRONG_ROAD_TYPE: "El tipo de camino no coincide",
  POOR_GPS_QUALITY: "Mala calidad de las posiciones GPS",
  DRIVER_VEHICLE_IMMUNITY: "Chofer / Vehículo con inmunidad",
};

const DISCARD_REASONS: { key: string; label: string }[] = [
  { key: "WRONG_SPEED_LIMIT", label: DISCARD_REASON_LABELS.WRONG_SPEED_LIMIT },
  { key: "WRONG_ROAD_TYPE", label: DISCARD_REASON_LABELS.WRONG_ROAD_TYPE },
  { key: "POOR_GPS_QUALITY", label: DISCARD_REASON_LABELS.POOR_GPS_QUALITY },
  { key: "DRIVER_VEHICLE_IMMUNITY", label: DISCARD_REASON_LABELS.DRIVER_VEHICLE_IMMUNITY },
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

// ═══════════════════════════════════════════════════════════════
//  Componente principal
//  ─────────────────────────────────────────────────────────────
//  La curva velocidad/tiempo se importa desde ./SpeedCurve
//  (extracción S4-L3d para reusarla en el recibo PDF).
// ═══════════════════════════════════════════════════════════════

export function InfractionDetailPanel({ infraction, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  const [isPending, startTransition] = useTransition();
  const [showDiscardForm, setShowDiscardForm] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Init mapa con polilínea
  useEffect(() => {
    if (!infraction || !containerRef.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      // Cleanup mapa anterior
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
      }).setView([infraction.startLat, infraction.startLon], 14);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        { subdomains: "abcd", maxZoom: 19 },
      ).addTo(map);

      const color = SEVERITY_COLORS[infraction.severity] ?? "#64748b";

      // Reconstruir polilínea desde trackJson · array de [lat,lon,iso,vel]
      let polyline: [number, number][] = [];
      try {
        const samples = JSON.parse(infraction.trackJson) as Array<
          [number, number, string, number]
        >;
        polyline = samples.map((s) => [s[0], s[1]]);
      } catch {
        polyline = [
          [infraction.startLat, infraction.startLon],
          [infraction.endLat, infraction.endLon],
        ];
      }

      if (polyline.length >= 2) {
        const line = L.polyline(polyline, {
          color,
          weight: 4,
          opacity: 0.85,
        }).addTo(map);

        // Marcadores inicio (verde) y fin (rojo)
        L.circleMarker([infraction.startLat, infraction.startLon], {
          radius: 6,
          color: "#fff",
          weight: 2,
          fillColor: "#22c55e",
          fillOpacity: 1,
        }).addTo(map);
        L.circleMarker([infraction.endLat, infraction.endLon], {
          radius: 6,
          color: "#fff",
          weight: 2,
          fillColor: "#dc2626",
          fillOpacity: 1,
        }).addTo(map);

        map.fitBounds(line.getBounds(), { padding: [20, 20], maxZoom: 16 });
      } else {
        L.circleMarker([infraction.startLat, infraction.startLon], {
          radius: 8,
          color: "#fff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        }).addTo(map);
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [infraction]);

  // Reset form state al cambiar la infracción
  useEffect(() => {
    setShowDiscardForm(false);
    setSelectedReason(null);
    setErrorMsg(null);
  }, [infraction]);

  // Close on ESC
  useEffect(() => {
    if (!infraction) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [infraction, onClose]);

  if (!infraction) return null;

  const sevColor = SEVERITY_COLORS[infraction.severity] ?? "#64748b";
  const startedDate = new Date(infraction.startedAt);
  const isDiscarded = infraction.status === "DISCARDED";

  // Reconstruir samples para la curva velocidad/tiempo
  const speedSamples = parseTrackToSpeedSamples(infraction.trackJson);

  function handleDiscardClick() {
    if (!selectedReason) return;
    setErrorMsg(null);
    startTransition(async () => {
      const result = await discardInfraction(
        infraction!.id,
        selectedReason as any,
      );
      if (result.ok) {
        onClose();
      } else {
        setErrorMsg(result.error ?? "Error desconocido");
      }
    });
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.panel} role="dialog" aria-modal="true">
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <span className={styles.dot} style={{ background: sevColor }} />
            <h2 className={styles.title}>
              Infracción {SEVERITY_LABELS[infraction.severity]}
            </h2>
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
          <div className={styles.row}>
            <span className={styles.rowLabel}>Severidad</span>
            <span
              className={styles.severityBadge}
              style={{ color: sevColor, borderColor: sevColor }}
            >
              {SEVERITY_LABELS[infraction.severity]}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Inició</span>
            <span className={styles.rowValue}>
              {startedDate.toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Duración</span>
            <span className={styles.rowValue}>
              {formatDuration(infraction.durationSec)}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Velocidad máxima</span>
            <span className={styles.rowValue}>{infraction.vmaxKmh} km/h</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Pico de velocidad</span>
            <span className={styles.rowValue}>
              <strong>{Math.round(infraction.peakSpeedKmh)} km/h</strong>{" "}
              <span style={{ color: sevColor, fontFamily: "ui-monospace" }}>
                (+{Math.round(infraction.maxExcessKmh)} km/h)
              </span>
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Distancia en exceso</span>
            <span className={styles.rowValue}>
              {(infraction.distanceMeters / 1000).toFixed(2)} km
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Tipo de vía</span>
            <span className={styles.rowValue}>
              {ROAD_TYPE_LABELS[infraction.roadType] ?? infraction.roadType}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Vehículo</span>
            <Link
              href={`/objeto/vehiculo/${infraction.assetId}`}
              className={styles.link}
            >
              {infraction.assetName}
              {infraction.assetPlate && ` · ${infraction.assetPlate}`}
              <ExternalLink size={11} />
            </Link>
          </div>

          {infraction.personName && infraction.personId && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Conductor</span>
              <Link
                href={`/objeto/conductor/${infraction.personId}`}
                className={styles.link}
              >
                {infraction.personName}
                <ExternalLink size={11} />
              </Link>
            </div>
          )}

          {!infraction.personName && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Conductor</span>
              <span className={styles.rowValue} style={{ color: "#94a3b8" }}>
                Sin asignar
              </span>
            </div>
          )}

          {/* Acciones rápidas · imprimir recibo */}
          <div className={styles.row}>
            <span className={styles.rowLabel}>Recibo</span>
            <a
              href={`/conduccion/infraccion/${infraction.id}`}
              target="_blank"
              rel="noreferrer"
              className={styles.link}
            >
              <Printer size={11} />
              Abrir recibo imprimible
              <ExternalLink size={11} />
            </a>
          </div>

          {/* Mini-mapa con polilínea */}
          <div className={styles.mapWrap}>
            <div ref={containerRef} className={styles.miniMap} />
          </div>

          {/* Curva velocidad/tiempo */}
          {speedSamples.length >= 2 && (
            <SpeedCurve
              samples={speedSamples}
              vmaxKmh={infraction.vmaxKmh}
              color={sevColor}
              title="Velocidad durante la infracción"
            />
          )}

          {/* Banner si está descartada */}
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
              {infraction.discardedAt && (
                <>
                  {" · "}
                  {new Date(infraction.discardedAt).toLocaleString("es-AR", {
                    timeZone: "America/Argentina/Buenos_Aires",
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              )}
            </div>
          )}

          {/* Bloque descartar · solo si está activa */}
          {!isDiscarded && (
            <div className={styles.discardBlock}>
              {!showDiscardForm ? (
                <>
                  <h3 className={styles.discardTitle}>¿Descartar esta infracción?</h3>
                  <p className={styles.discardHint}>
                    Si fue un falso positivo (límite de velocidad incorrecto,
                    GPS impreciso, vehículo con inmunidad, etc.) podés
                    descartarla. Quedará registro de quién y por qué.
                  </p>
                  <div className={styles.discardActions}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => setShowDiscardForm(true)}
                    >
                      Descartar…
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className={styles.discardTitle}>Razón del descarte</h3>
                  <div className={styles.discardOptions}>
                    {DISCARD_REASONS.map((r) => (
                      <label key={r.key} className={styles.discardOption}>
                        <input
                          type="radio"
                          name="discardReason"
                          value={r.key}
                          checked={selectedReason === r.key}
                          onChange={() => setSelectedReason(r.key)}
                          disabled={isPending}
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                  {errorMsg && (
                    <div className={styles.discardedBanner}>{errorMsg}</div>
                  )}
                  <div className={styles.discardActions}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => {
                        setShowDiscardForm(false);
                        setSelectedReason(null);
                        setErrorMsg(null);
                      }}
                      disabled={isPending}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={handleDiscardClick}
                      disabled={!selectedReason || isPending}
                    >
                      {isPending ? "Descartando…" : "Descartar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
