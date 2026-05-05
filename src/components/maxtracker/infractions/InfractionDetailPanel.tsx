// @ts-nocheck · pre-existing patterns (Prisma types stale, leaflet sin types)
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import type { InfractionListRow } from "@/lib/queries/infractions-list";
import { discardInfraction } from "@/app/(product)/conduccion/infracciones/actions";
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
//  Curva velocidad/tiempo · SVG inline
//  ─────────────────────────────────────────────────────────────
//  No usamos Recharts ni librerías externas · dibujo custom para
//  mantener el peso del bundle bajo y para tener control fino del
//  estilo. Marca de vmax como línea horizontal punteada.
// ═══════════════════════════════════════════════════════════════

interface SpeedSample {
  t: number; // segundos desde inicio
  v: number; // km/h
}

function SpeedCurve({
  samples,
  vmaxKmh,
  sevColor,
}: {
  samples: SpeedSample[];
  vmaxKmh: number;
  sevColor: string;
}) {
  if (samples.length < 2) return null;

  const W = 280;
  const H = 96;
  const PAD_L = 28;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 18;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const tMax = samples[samples.length - 1].t;
  const vMax = Math.max(...samples.map((s) => s.v), vmaxKmh) * 1.05;
  const vMin = Math.min(...samples.map((s) => s.v)) * 0.9;

  const x = (t: number) => PAD_L + (t / tMax) * innerW;
  const y = (v: number) => PAD_T + innerH - ((v - vMin) / (vMax - vMin)) * innerH;

  const path = samples
    .map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.t).toFixed(1)} ${y(s.v).toFixed(1)}`)
    .join(" ");

  // Área bajo la curva por encima de vmax (relleno claro de exceso)
  const aboveLimitArea = (() => {
    const pts: string[] = [];
    let inside = false;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (s.v > vmaxKmh) {
        if (!inside) {
          pts.push(`M ${x(s.t).toFixed(1)} ${y(vmaxKmh).toFixed(1)}`);
          inside = true;
        }
        pts.push(`L ${x(s.t).toFixed(1)} ${y(s.v).toFixed(1)}`);
      } else if (inside) {
        pts.push(`L ${x(s.t).toFixed(1)} ${y(vmaxKmh).toFixed(1)} Z`);
        inside = false;
      }
    }
    if (inside) {
      const last = samples[samples.length - 1];
      pts.push(`L ${x(last.t).toFixed(1)} ${y(vmaxKmh).toFixed(1)} Z`);
    }
    return pts.join(" ");
  })();

  return (
    <div className={styles.speedChart}>
      <div className={styles.speedChartTitle}>Velocidad durante la infracción</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        {/* Eje Y · vmin / vmax */}
        <text x={2} y={y(vMin) + 3} fontSize={9} fill="#94a3b8" fontFamily="ui-monospace">
          {Math.round(vMin)}
        </text>
        <text x={2} y={y(vMax) + 3} fontSize={9} fill="#94a3b8" fontFamily="ui-monospace">
          {Math.round(vMax)}
        </text>
        {/* Eje X · 0 / tMax */}
        <text x={PAD_L} y={H - 2} fontSize={9} fill="#94a3b8" fontFamily="ui-monospace">
          0s
        </text>
        <text
          x={W - PAD_R}
          y={H - 2}
          fontSize={9}
          fill="#94a3b8"
          fontFamily="ui-monospace"
          textAnchor="end"
        >
          {formatDuration(Math.round(tMax))}
        </text>

        {/* Línea vmax · referencia */}
        <line
          x1={PAD_L}
          y1={y(vmaxKmh)}
          x2={W - PAD_R}
          y2={y(vmaxKmh)}
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text
          x={W - PAD_R - 2}
          y={y(vmaxKmh) - 3}
          fontSize={9}
          fill="#64748b"
          fontFamily="ui-monospace"
          textAnchor="end"
        >
          vmax {vmaxKmh}
        </text>

        {/* Área de exceso · relleno de severity */}
        {aboveLimitArea && (
          <path d={aboveLimitArea} fill={sevColor} fillOpacity={0.18} />
        )}

        {/* Curva */}
        <path d={path} fill="none" stroke={sevColor} strokeWidth={1.6} />
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Componente principal
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
  let speedSamples: SpeedSample[] = [];
  try {
    const raw = JSON.parse(infraction.trackJson) as Array<
      [number, number, string, number]
    >;
    if (raw.length > 0) {
      const t0 = new Date(raw[0][2]).getTime();
      speedSamples = raw.map(([, , iso, v]) => ({
        t: (new Date(iso).getTime() - t0) / 1000,
        v,
      }));
    }
  } catch {
    /* curva no se renderiza · fallback ya manejado */
  }

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

          {/* Mini-mapa con polilínea */}
          <div className={styles.mapWrap}>
            <div ref={containerRef} className={styles.miniMap} />
          </div>

          {/* Curva velocidad/tiempo */}
          {speedSamples.length >= 2 && (
            <SpeedCurve
              samples={speedSamples}
              vmaxKmh={infraction.vmaxKmh}
              sevColor={sevColor}
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
