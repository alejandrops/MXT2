"use client";

import { useMemo } from "react";
import type { TrajectoryPoint } from "@/lib/queries/historicos";
import {
  DriverCard,
  Dot,
  Num,
  PanelShell,
  PlaceholderHint,
  Row,
  type RowAccent,
  Rows,
  SectionHeader,
  Unit,
  degToCardinal,
} from "./DetailBlocks";
import styles from "./TelemetryPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  TelemetryPanel · Históricos right-side panel
//  ─────────────────────────────────────────────────────────────
//  Vertical stack of label·value rows, grouped into sections:
//
//    1. TELEMETRÍA · instantaneous values at cursor
//    2. ENTRADAS   · digital inputs (placeholder · seed doesn't
//                    carry these yet)
//    3. SENSORES   · cargo / engine sensors (placeholder)
//    4. CONDUCTOR  · driver assigned to the asset
//
//  All telemetry values update live as the user moves the cursor.
//  Building blocks come from DetailBlocks so the styling matches
//  AssetDetailPanel (the equivalent panel on the live Mapa page).
// ═══════════════════════════════════════════════════════════════

interface TelemetryPanelProps {
  /** Closest sample to current cursor */
  sample: TrajectoryPoint | null;
  /** Full point stream (for cumulative distance + acceleration) */
  points: TrajectoryPoint[];
  /** Start of the day (for "tiempo desde inicio") */
  startAt: Date;
  /** Driver currently assigned to the asset (nullable) */
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    document: string | null;
    safetyScore: number;
  } | null;
}

export function TelemetryPanel({
  sample,
  points,
  startAt,
  driver,
}: TelemetryPanelProps) {
  const cumDistanceByIdx = useMemo(() => {
    const out: number[] = new Array(points.length);
    let acc = 0;
    out[0] = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      if (a.ignition) {
        acc += haversineKm(a.lat, a.lng, b.lat, b.lng);
      }
      out[i] = acc;
    }
    return out;
  }, [points]);

  if (!sample) {
    return (
      <PanelShell>
        <SectionHeader label="Telemetría" />
        <div className={styles.emptyHint}>
          Mové la línea de tiempo para ver el estado.
        </div>
        {driver && <DriverCard driver={driver} />}
      </PanelShell>
    );
  }

  const sampleIdx = findClosestIdx(points, sample.recordedAt);
  const cumKm = cumDistanceByIdx[sampleIdx] ?? 0;

  let accelKmhPerS = 0;
  if (sampleIdx > 0) {
    const prev = points[sampleIdx - 1]!;
    const dt =
      (sample.recordedAt.getTime() - prev.recordedAt.getTime()) / 1000;
    if (dt > 0) {
      accelKmhPerS = (sample.speedKmh - prev.speedKmh) / dt;
    }
  }

  const speed = Math.round(sample.speedKmh);
  const state = classify(sample.speedKmh, sample.ignition);
  const elapsedMs = sample.recordedAt.getTime() - startAt.getTime();

  return (
    <PanelShell>
      {/* ── TELEMETRÍA ──────────────────────────────────────── */}
      <SectionHeader
        label="Telemetría"
        right={formatTime(new Date(sample.recordedAt))}
      />

      <Rows dense>
        <Row label="Velocidad" accent={speedAccent(speed)} dense>
          <Num>{speed}</Num>
          <Unit>km/h</Unit>
        </Row>
        <Row label="Aceleración" accent={accelAccent(accelKmhPerS)} dense>
          <Num>
            {accelKmhPerS > 0 ? "+" : ""}
            {accelKmhPerS.toLocaleString("es-AR", {
              maximumFractionDigits: 1,
            })}
          </Num>
          <Unit>km/h/s</Unit>
        </Row>
        <Row label="Distancia" dense>
          <Num>
            {cumKm.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
          </Num>
          <Unit>km</Unit>
        </Row>
        <Row label="Rumbo" dense>
          <Num>{degToCardinal(sample.heading)}</Num>
          <Unit>{sample.heading}°</Unit>
        </Row>
        <Row label="Motor" dense>
          <Dot on={sample.ignition} />
          <Num>{sample.ignition ? "Encendido" : "Apagado"}</Num>
        </Row>
        <Row label="Actividad" accent={stateAccent(state)} dense>
          <Num>{stateLabel(state)}</Num>
        </Row>
        <Row label="Coordenadas" dense>
          <span className={styles.coords}>
            {sample.lat.toFixed(5)}, {sample.lng.toFixed(5)}
          </span>
        </Row>
        <Row label="Transcurrido" dense>
          <Num>{formatElapsed(elapsedMs)}</Num>
        </Row>
      </Rows>

      {/* ── ENTRADAS · placeholder ──────────────────────────── */}
      <SectionHeader label="Entradas" />
      <PlaceholderHint>
        Se mostrarán cuando el dispositivo reporte estados (puerta
        cabina, puerta de carga, pánico, alimentación, etc.).
      </PlaceholderHint>

      {/* ── SENSORES · placeholder ──────────────────────────── */}
      <SectionHeader label="Sensores" />
      <PlaceholderHint>
        Se mostrarán cuando estén disponibles (temperatura de carga,
        RPM, nivel de combustible).
      </PlaceholderHint>

      {/* ── CONDUCTOR ───────────────────────────────────────── */}
      {driver && <DriverCard driver={driver} />}
    </PanelShell>
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

function stateAccent(s: State): RowAccent | undefined {
  if (s === "MOVING") return "good";
  if (s === "IDLE") return "warn";
  return undefined;
}

function speedAccent(speed: number): RowAccent | undefined {
  if (speed >= 130) return "critical";
  if (speed >= 110) return "high";
  return undefined;
}

function accelAccent(a: number): RowAccent | undefined {
  if (a > 1.5) return "warn";
  if (a < -2) return "critical";
  return undefined;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function findClosestIdx(points: TrajectoryPoint[], target: Date): number {
  if (points.length === 0) return 0;
  const t = target.getTime();
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.recordedAt.getTime() < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
