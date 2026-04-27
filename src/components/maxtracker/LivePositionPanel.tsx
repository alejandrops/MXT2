"use client";

import { Activity, Compass, Gauge, KeyRound } from "lucide-react";
import type { TrajectoryPoint } from "@/lib/queries/historicos";
import styles from "./LivePositionPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  LivePositionPanel
//  ─────────────────────────────────────────────────────────────
//  Shows the vehicle's telemetry state AT the playback cursor.
//  Updates continuously as the cursor moves. Displays:
//    · Time of the sample
//    · Speed (km/h) with color cue
//    · Heading (cardinal letters · NE, S, etc + degrees)
//    · Engine state (ignition on/off)
//    · Activity classification (movimiento, ralentí, detenido)
// ═══════════════════════════════════════════════════════════════

interface LivePositionPanelProps {
  /** Closest position to current cursor time, or null if outside range */
  sample: TrajectoryPoint | null;
}

export function LivePositionPanel({ sample }: LivePositionPanelProps) {
  if (!sample) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>Posición actual</div>
        <div className={styles.emptyHint}>
          Mové la línea de tiempo para ver el estado.
        </div>
      </div>
    );
  }

  const speed = Math.round(sample.speedKmh);
  const state = classify(sample.speedKmh, sample.ignition);

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>Posición actual</span>
        <span className={styles.time}>
          {formatTime(new Date(sample.recordedAt))}
        </span>
      </header>

      <div className={styles.grid}>
        {/* Speed */}
        <div className={styles.cell}>
          <div className={styles.cellLabel}>
            <Gauge size={11} className={styles.icon} /> Velocidad
          </div>
          <div className={`${styles.cellValue} ${speedColorClass(speed)}`}>
            <span className={styles.num}>{speed}</span>
            <span className={styles.unit}>km/h</span>
          </div>
        </div>

        {/* Heading */}
        <div className={styles.cell}>
          <div className={styles.cellLabel}>
            <Compass size={11} className={styles.icon} /> Rumbo
          </div>
          <div className={styles.cellValue}>
            <span className={styles.num}>
              {degreesToCardinal(sample.heading)}
            </span>
            <span className={styles.unit}>{sample.heading}°</span>
          </div>
        </div>

        {/* Engine / Ignition */}
        <div className={styles.cell}>
          <div className={styles.cellLabel}>
            <KeyRound size={11} className={styles.icon} /> Motor
          </div>
          <div className={styles.cellValue}>
            <span
              className={`${styles.dot} ${
                sample.ignition ? styles.dotOn : styles.dotOff
              }`}
            />
            <span className={styles.num}>
              {sample.ignition ? "Encendido" : "Apagado"}
            </span>
          </div>
        </div>

        {/* Activity classification */}
        <div className={styles.cell}>
          <div className={styles.cellLabel}>
            <Activity size={11} className={styles.icon} /> Actividad
          </div>
          <div className={`${styles.cellValue} ${styles[`state${state}`]}`}>
            <span className={styles.num}>{stateLabel(state)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

type State = "MOVING" | "IDLE" | "STOPPED";

function classify(speedKmh: number, ignition: boolean): State {
  if (speedKmh >= 5) return "MOVING";
  if (ignition) return "IDLE";
  return "STOPPED";
}

function stateLabel(s: State): string {
  switch (s) {
    case "MOVING":
      return "En movimiento";
    case "IDLE":
      return "Ralentí";
    case "STOPPED":
      return "Detenido";
  }
}

function speedColorClass(speed: number): string {
  if (speed >= 110) return styles.speedCritical!;
  if (speed >= 90) return styles.speedHigh!;
  return "";
}

function degreesToCardinal(deg: number): string {
  // 16-point compass rose
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSO",
    "SO",
    "OSO",
    "O",
    "ONO",
    "NO",
    "NNO",
  ];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[idx]!;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
