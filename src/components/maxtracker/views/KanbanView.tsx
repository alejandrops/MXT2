"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import styles from "./KanbanView.module.css";

// ═══════════════════════════════════════════════════════════════
//  KanbanView · cards/chips agrupadas por estado
//  ─────────────────────────────────────────────────────────────
//  5 columnas: EN MARCHA · RALENTÍ · DETENIDO · APAGADO · SIN COM
//  Cada chip muestra nombre + patente + velocidad/contexto.
//  Click en chip → 360 del vehículo.
//  Sin drag-and-drop (es visualización, no acción).
// ═══════════════════════════════════════════════════════════════

interface Props {
  assets: FleetAssetLive[];
}

interface Bucket {
  key: string;
  label: string;
  description: string;
  items: FleetAssetLive[];
}

export function KanbanView({ assets }: Props) {
  const buckets = useMemo(() => buildBuckets(assets), [assets]);

  return (
    <div className={styles.board}>
      {buckets.map((b) => (
        <Column key={b.key} bucket={b} />
      ))}
    </div>
  );
}

function buildBuckets(assets: FleetAssetLive[]): Bucket[] {
  // No-comm goes first as a separate bucket so the operator
  // sees disconnected vehicles immediately.
  const noComm = assets.filter((a) => a.commState === "NO_COMM");
  const noCommIds = new Set(noComm.map((a) => a.id));

  const moving = assets.filter(
    (a) => !noCommIds.has(a.id) && a.motorState === "MOVING",
  );
  const idle = assets.filter(
    (a) =>
      !noCommIds.has(a.id) && a.motorState === "STOPPED" && a.ignition,
  );
  const stopped = assets.filter(
    (a) =>
      !noCommIds.has(a.id) && a.motorState === "STOPPED" && !a.ignition,
  );
  const off = assets.filter(
    (a) => !noCommIds.has(a.id) && a.motorState === "OFF",
  );

  return [
    {
      key: "moving",
      label: "En marcha",
      description: "Movimiento real",
      items: moving,
    },
    {
      key: "idle",
      label: "Ralentí",
      description: "Motor encendido sin moverse",
      items: idle,
    },
    {
      key: "stopped",
      label: "Detenido",
      description: "Estacionado · motor apagado",
      items: stopped,
    },
    {
      key: "off",
      label: "Inactivo",
      description: "Histórico apagado",
      items: off,
    },
    {
      key: "nocomm",
      label: "Sin comunicación",
      description: "Sin reportar",
      items: noComm,
    },
  ];
}

function Column({ bucket: b }: { bucket: Bucket }) {
  // Sort: alarms first, then by speed desc (in-motion buckets) or by name
  const sorted = useMemo(() => {
    const items = [...b.items];
    items.sort((x, y) => {
      if (x.hasOpenAlarm && !y.hasOpenAlarm) return -1;
      if (!x.hasOpenAlarm && y.hasOpenAlarm) return 1;
      if (b.key === "moving") return y.speedKmh - x.speedKmh;
      return x.name.localeCompare(y.name);
    });
    return items;
  }, [b.items, b.key]);

  return (
    <section className={`${styles.column} ${styles[`col_${b.key}`] ?? ""}`}>
      <header className={styles.colHeader}>
        <div className={styles.colTitleRow}>
          <h2 className={styles.colTitle}>{b.label}</h2>
          <span className={styles.colCount}>{sorted.length}</span>
        </div>
        <p className={styles.colDescription}>{b.description}</p>
      </header>
      <div className={styles.colBody}>
        {sorted.length === 0 ? (
          <div className={styles.emptyChip}>—</div>
        ) : (
          sorted.map((a) => <Chip key={a.id} asset={a} bucketKey={b.key} />)
        )}
      </div>
    </section>
  );
}

function Chip({ asset: a, bucketKey }: { asset: FleetAssetLive; bucketKey: string }) {
  const href = `/gestion/vehiculos/${a.id}`;
  return (
    <Link
      href={href}
      className={`${styles.chip} ${a.hasOpenAlarm ? styles.chipAlarm : ""}`}
    >
      <div className={styles.chipMain}>
        <span className={styles.chipName}>{a.name}</span>
        {a.hasOpenAlarm && (
          <span className={styles.chipAlarmBadge}>
            <AlertTriangle size={10} />
            {a.openAlarmCount}
          </span>
        )}
      </div>
      <div className={styles.chipMeta}>
        {a.plate && <span className={styles.chipPlate}>{a.plate}</span>}
        {bucketKey === "moving" && (
          <span
            className={`${styles.chipSpeed} ${
              a.speedKmh >= 130
                ? styles.speedRed
                : a.speedKmh >= 110
                  ? styles.speedAmb
                  : ""
            }`}
          >
            {Math.round(a.speedKmh)} km/h
          </span>
        )}
        {bucketKey === "nocomm" && (
          <span className={styles.chipDim}>
            {formatAgo(a.msSinceLastSeen)}
          </span>
        )}
        {bucketKey === "idle" && (
          <span className={styles.chipDim}>{Math.round(a.speedKmh)} km/h</span>
        )}
      </div>
    </Link>
  );
}

function formatAgo(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
