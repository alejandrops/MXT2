// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
"use client";

import {
  AlertTriangle,
  Compass,
  Gauge,
  KeyRound,
  MapPin,
  Radio,
} from "lucide-react";
import type { AssetDetail } from "@/types/domain";
import styles from "./AssetLiveStatus.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetLiveStatus · enriched status block under AssetHeader
//  ─────────────────────────────────────────────────────────────
//  Inspired by the v8 demo's persistent header pattern (s-ba):
//    · Active alarm banner (red, when openAlarms > 0)
//    · Current state row: speed, motor, heading, comm freshness,
//      position
//    · Data row: odometer, year, account/group, primary device
//
//  Goal: the operator never has to dig to know what's happening
//  with this vehicle right now.
// ═══════════════════════════════════════════════════════════════

interface AssetLiveStatusProps {
  asset: AssetDetail;
}

export function AssetLiveStatus({ asset }: AssetLiveStatusProps) {
  const last = asset.lastPosition;
  const stats = asset.stats;
  const hasOpenAlarm = stats.openAlarms > 0;

  return (
    <div className={styles.wrap}>
      {/* ── Active alarm banner ──────────────────────────── */}
      {hasOpenAlarm && (
        <div className={styles.alarmBanner}>
          <AlertTriangle size={14} className={styles.alarmIcon} />
          <span className={styles.alarmTitle}>
            {stats.openAlarms === 1
              ? "Alarma activa"
              : `${stats.openAlarms} alarmas activas`}
          </span>
          <span className={styles.alarmSep}>·</span>
          <span className={styles.alarmBody}>
            Acción inmediata requerida
          </span>
          <a href="?tab=alarmas" className={styles.alarmAction}>
            Ver alarmas →
          </a>
        </div>
      )}

      {/* ── Current state ────────────────────────────────── */}
      <div className={styles.stateRow}>
        <StateCell
          icon={<Gauge size={11} />}
          label="Velocidad"
          value={
            last
              ? `${Math.round(last.speedKmh)} km/h`
              : "—"
          }
          accent={last && last.speedKmh > 110 ? "warn" : undefined}
        />
        <StateCell
          icon={<KeyRound size={11} />}
          label="Motor"
          value={
            last ? (last.ignition ? "Encendido" : "Apagado") : "—"
          }
          dotState={last?.ignition ? "on" : "off"}
        />
        <StateCell
          icon={<Compass size={11} />}
          label="Rumbo"
          value={last && last.heading != null ? `${degToCardinal(last.heading)} · ${last.heading}°` : "—"}
        />
        <StateCell
          icon={<Radio size={11} />}
          label="Comunicación"
          value={commLabel(stats.commState, stats.msSinceLastSeen)}
          dotState={commDotState(stats.commState)}
        />
        {last && (
          <StateCell
            icon={<MapPin size={11} />}
            label="Posición"
            value={`${last.lat.toFixed(4)}, ${last.lng.toFixed(4)}`}
            mono
            grow
          />
        )}
      </div>

      {/* ── Asset data row ───────────────────────────────── */}
      <div className={styles.dataRow}>
        <DataCell
          label="Odómetro"
          value={`${stats.odometerKm.toLocaleString("es-AR")} km`}
        />
        {asset.year && (
          <DataCell label="Año" value={String(asset.year)} />
        )}
        {asset.vin && <DataCell label="VIN" value={asset.vin} mono />}
        <DataCell
          label="Cuenta"
          value={asset.account.name}
        />
        {asset.group && (
          <DataCell label="Grupo" value={asset.group.name} />
        )}
        {asset.devices[0] && (
          <DataCell
            label="Dispositivo principal"
            value={`${asset.devices[0].vendor} ${asset.devices[0].model}`}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Building blocks
// ═══════════════════════════════════════════════════════════════

interface StateCellProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  dotState?: "on" | "off" | "warn" | "neutral";
  accent?: "warn" | "critical";
  mono?: boolean;
  grow?: boolean;
}

function StateCell({
  icon,
  label,
  value,
  dotState,
  accent,
  mono,
  grow,
}: StateCellProps) {
  return (
    <div
      className={`${styles.stateCell} ${grow ? styles.stateCellGrow : ""}`}
    >
      <div className={styles.stateLabel}>
        <span className={styles.icon}>{icon}</span>
        {label}
      </div>
      <div className={styles.stateValue}>
        {dotState && (
          <span
            className={`${styles.dot} ${styles[`dot_${dotState}`]}`}
            aria-hidden="true"
          />
        )}
        <span
          className={`${styles.stateNum} ${
            accent === "warn"
              ? styles.accentWarn
              : accent === "critical"
                ? styles.accentCritical
                : ""
          } ${mono ? styles.mono : ""}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function DataCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className={styles.dataCell}>
      <span className={styles.dataLabel}>{label}</span>
      <span className={`${styles.dataValue} ${mono ? styles.mono : ""}`}>
        {value}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function degToCardinal(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO",
  ];
  const idx = Math.round((deg % 360) / 22.5) % 16;
  return dirs[idx]!;
}

function commLabel(
  state: AssetDetail["stats"]["commState"],
  msAgo: number,
): string {
  if (state === "NO_COMM") return "Sin datos";
  const sec = Math.floor(msAgo / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function commDotState(
  state: AssetDetail["stats"]["commState"],
): "on" | "warn" | "neutral" | "off" {
  if (state === "ONLINE") return "on";
  if (state === "RECENT") return "warn";
  if (state === "STALE") return "neutral";
  return "off";
}
