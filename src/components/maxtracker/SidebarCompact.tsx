"use client";

import { Activity, Pause, Square, WifiOff } from "lucide-react";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import styles from "./SidebarCompact.module.css";

// ═══════════════════════════════════════════════════════════════
//  SidebarCompact · A8 · variante de 60px del sidebar
//  ─────────────────────────────────────────────────────────────
//  Para los modos Mapa que muestran sus propios listados de
//  vehículos (Kanban, Aeropuerto), el sidebar full es redundante.
//
//  Esta versión compacta:
//    · Muestra contador por status (Movimiento / Ralentí / Detenido /
//      Sin señal)
//    · El usuario expande con el botón en el header
// ═══════════════════════════════════════════════════════════════

interface Props {
  assets: FleetAssetLive[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SidebarCompact({ assets }: Props) {
  // Contadores por motorState + commState
  const counts = {
    moving: 0,
    stopped: 0, // motor STOPPED · ignición on, sin movimiento
    off: 0,     // motor OFF · ignición off
    offline: 0, // sin comunicación
  };
  for (const a of assets) {
    if (a.commState === "NO_COMM" || a.commState === "LONG") {
      counts.offline += 1;
    } else if (a.motorState === "MOVING") {
      counts.moving += 1;
    } else if (a.motorState === "STOPPED") {
      counts.stopped += 1;
    } else {
      counts.off += 1;
    }
  }

  type Item = {
    key: string;
    label: string;
    count: number;
    Icon: React.ComponentType<{ size?: number }>;
    accent: string;
  };

  const items: Item[] = [
    {
      key: "moving",
      label: "En movimiento",
      count: counts.moving,
      Icon: Activity,
      accent: styles.accentGrn ?? "",
    },
    {
      key: "stopped",
      label: "Ralentí",
      count: counts.stopped,
      Icon: Pause,
      accent: styles.accentAmb ?? "",
    },
    {
      key: "off",
      label: "Detenidos",
      count: counts.off,
      Icon: Square,
      accent: styles.accentSlate ?? "",
    },
    {
      key: "offline",
      label: "Sin señal",
      count: counts.offline,
      Icon: WifiOff,
      accent: styles.accentRed ?? "",
    },
  ];

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {items.map(({ key, label, count, Icon, accent }) => (
          <li
            key={key}
            className={`${styles.item} ${count === 0 ? styles.itemZero : ""}`}
            title={`${label}: ${count}`}
          >
            <Icon size={14} />
            <span className={`${styles.count} ${accent}`}>{count}</span>
          </li>
        ))}
      </ul>
      <div className={styles.totalDivider} />
      <div className={styles.total} title={`${assets.length} vehículos visibles`}>
        <span className={styles.totalLabel}>Total</span>
        <span className={styles.totalValue}>{assets.length}</span>
      </div>
    </div>
  );
}
