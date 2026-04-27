"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AssetDayMap } from "@/lib/queries/asset-day-map";
import styles from "./AssetDayRouteCard.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetDayRouteCard · variante COMPACTA del AssetMapTab (E5-C)
//  ─────────────────────────────────────────────────────────────
//  Usado por la Overview de la 360 de vehículo. Reemplaza el
//  mini-mapa de "última posición" (un solo punto) por el ROUTE
//  del último día con datos. Layout vertical · una sola columna:
//
//    ┌──────────────────────────────────────┐
//    │             [ MAPA  ~260px ]          │
//    ├──────────────────────────────────────┤
//    │  KM · TIEMPO · VIAJES · VEL.MÁX       │
//    │  INICIO · FIN                          │
//    │  Última posición · lat,lng             │
//    │  → Ver replay completo                 │
//    └──────────────────────────────────────┘
//
//  Lee de getAssetDayMap (deuda preexistente con Position ·
//  mismo recurso que ya usa el tab Mapa). NO toca Position
//  desde código nuevo. La diferencia con AssetMapTab es solo
//  layout: AssetMapTab es 2 columnas (map + sidebar 320px),
//  esta variante es vertical para vivir dentro del grid de
//  la Overview que ya tiene su propia columna derecha.
// ═══════════════════════════════════════════════════════════════

const AssetMiniMap = dynamic(() => import("./AssetMiniMap"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Cargando mapa…</div>,
});

interface Props {
  assetId: string;
  dayMap: AssetDayMap;
}

export function AssetDayRouteCard({ assetId, dayMap }: Props) {
  const { stats, points, lastPosition, dateISO, isToday } = dayMap;
  const hasData = points.length > 0;

  return (
    <div className={styles.card}>
      {/* ── Map ──────────────────────────────────────── */}
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

      {/* ── Day header ───────────────────────────────── */}
      <div className={styles.dayHeader}>
        <span className={styles.dayLabel}>
          {isToday ? "Hoy" : "Último día con datos"}
        </span>
        <span className={styles.dayDate}>{formatDateAr(dateISO)}</span>
      </div>

      {!hasData ? (
        <div className={styles.empty}>
          Este vehículo no tiene posiciones registradas todavía.
        </div>
      ) : (
        <>
          {/* ── KPI grid · 4 columnas ─────────────────── */}
          <div className={styles.kpis}>
            <Kpi
              label="Distancia"
              value={`${stats.distanceKm.toLocaleString("es-AR")} km`}
            />
            <Kpi
              label="Tiempo activo"
              value={formatMinutes(stats.activeMinutes)}
            />
            <Kpi label="Viajes" value={String(stats.tripCount)} />
            <Kpi
              label="Vel. máx"
              value={`${stats.maxSpeedKmh} km/h`}
              accent={
                stats.maxSpeedKmh >= 130
                  ? "critical"
                  : stats.maxSpeedKmh >= 110
                    ? "warn"
                    : undefined
              }
            />
          </div>

          {/* ── Times ──────────────────────────────────── */}
          <div className={styles.timesRow}>
            <Time label="Inicio" date={stats.firstAt} />
            <Time label="Fin" date={stats.lastAt} />
          </div>

          {/* ── Last position ──────────────────────────── */}
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
        </>
      )}

      {/* ── Replay link (footer) ──────────────────────── */}
      <Link
        href={`/seguimiento/historial?assetId=${assetId}&date=${dateISO}`}
        className={styles.replayBtn}
      >
        Ver replay completo
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "warn" | "critical";
}) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span
        className={`${styles.kpiValue} ${
          accent === "warn"
            ? styles.kpiAccentWarn
            : accent === "critical"
              ? styles.kpiAccentCritical
              : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Time({ label, date }: { label: string; date: Date | null }) {
  if (!date) {
    return (
      <div className={styles.time}>
        <span className={styles.timeLabel}>{label}</span>
        <span className={styles.timeDim}>—</span>
      </div>
    );
  }
  return (
    <div className={styles.time}>
      <span className={styles.timeLabel}>{label}</span>
      <span className={styles.timeValue}>{formatTime(new Date(date))}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

const DOW_FULL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_FULL = [
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
  const dow = DOW_FULL[date.getUTCDay()]!;
  return `${dow} ${String(d).padStart(2, "0")} ${MONTH_FULL[m - 1]!} ${y}`;
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
