"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { AssetDayMap } from "@/lib/queries/asset-day-map";
import styles from "./DayRouteCard.module.css";

// ═══════════════════════════════════════════════════════════════
//  DayRouteCard · mini-mapa del día con datos dentro del Libro
//  ─────────────────────────────────────────────────────────────
//  Adaptación Tufte del AssetDayRouteCard original. Vive como
//  sección dentro de ActivityBookTab · solo para vehículos · y
//  responde al período seleccionado en el PeriodBar (twist):
//    · Si período es marzo 2026 · muestra último día con datos
//      de marzo
//    · Si día específico · ese día puntual
//
//  Diferencias con el componente original:
//    · Sin ícono ArrowRight en el link de replay
//    · Sin acentos warn/critical de color en velocidad máxima
//      (Tufte · color como excepción · acá el dato no es anómalo
//      por sí mismo, es informativo)
//    · Layout más compacto
// ═══════════════════════════════════════════════════════════════

const AssetMiniMap = dynamic(
  () => import("@/components/maxtracker/AssetMiniMap"),
  {
    ssr: false,
    loading: () => <div className={styles.mapLoading}>Cargando mapa…</div>,
  },
);

interface Props {
  assetId: string;
  dayMap: AssetDayMap;
}

export function DayRouteCard({ assetId, dayMap }: Props) {
  const { stats, points, lastPosition, dateISO, isToday } = dayMap;
  const hasData = points.length > 0;

  return (
    <div className={styles.card}>
      <header className={styles.cardHeader}>
        <h3 className={styles.title}>
          {isToday ? "Ruta de hoy" : "Última ruta del período"}
        </h3>
        <span className={styles.subtitle}>{formatDateAr(dateISO)}</span>
      </header>

      <div className={styles.body}>
        {/* ── Mapa ──────────────────────────────────────────── */}
        <div className={styles.mapBox}>
          <AssetMiniMap
            points={points}
            fallbackCenter={
              lastPosition
                ? { lat: lastPosition.lat, lng: lastPosition.lng }
                : undefined
            }
            lastHeading={lastPosition?.heading ?? 0}
          />
        </div>

        {/* ── Sidebar con stats del día ─────────────────────── */}
        <aside className={styles.sidebar}>
          {!hasData ? (
            <div className={styles.empty}>
              Sin posiciones en este período.
            </div>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <Stat
                  label="Distancia"
                  value={`${stats.distanceKm.toLocaleString("es-AR")} km`}
                />
                <Stat
                  label="Tiempo activo"
                  value={formatMinutes(stats.activeMinutes)}
                />
                <Stat label="Viajes" value={String(stats.tripCount)} />
                <Stat label="Vel. máxima" value={`${stats.maxSpeedKmh} km/h`} />
              </div>

              <div className={styles.timesRow}>
                <Time label="Inicio" date={stats.firstAt} />
                <Time label="Fin" date={stats.lastAt} />
              </div>

              {lastPosition && (
                <div className={styles.lastPos}>
                  <span className={styles.lastPosLabel}>Última posición</span>
                  <span className={styles.lastPosValue}>
                    {lastPosition.lat.toFixed(5)}, {lastPosition.lng.toFixed(5)}
                  </span>
                  <span className={styles.lastPosMeta}>
                    {Math.round(lastPosition.speedKmh)} km/h ·{" "}
                    {lastPosition.ignition ? "Encendido" : "Apagado"} ·{" "}
                    {formatTime(new Date(lastPosition.recordedAt))}
                  </span>
                </div>
              )}

              <Link
                href={`/seguimiento/historial?assetId=${assetId}&date=${dateISO}`}
                className={styles.replayLink}
              >
                Ver replay completo →
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}

function Time({ label, date }: { label: string; date: Date | null }) {
  return (
    <div className={styles.time}>
      <span className={styles.timeLabel}>{label}</span>
      <span className={date ? styles.timeValue : styles.timeDim}>
        {date ? formatTime(new Date(date)) : "—"}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function formatDateAr(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return ymd;
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DOW[date.getUTCDay()]} ${String(d).padStart(2, "0")} ${MES[m - 1]} ${y}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMinutes(min: number): string {
  if (min <= 0) return "0h";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
