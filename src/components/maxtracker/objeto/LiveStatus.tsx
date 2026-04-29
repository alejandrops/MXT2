import Link from "next/link";
import type { AssetLiveStatusData } from "@/lib/queries/asset-live-status";
import styles from "./LiveStatus.module.css";

// ═══════════════════════════════════════════════════════════════
//  LiveStatus · información en tiempo real del vehículo
//  ─────────────────────────────────────────────────────────────
//  Tira informativa que vive arriba del Libro del Objeto cuando
//  el objeto es un vehículo. Su rol es responder en 3 segundos:
//  ¿qué hace este vehículo ahora?
//
//  Estructura:
//    1. Banner de alarmas activas (solo si hay) · única fuente
//       de color en este componente · color = anomalía (Tufte)
//    2. Estado actual · velocidad, motor, rumbo, comunicación,
//       posición · 5 celdas con label + valor
//    3. Datos del vehículo · cuenta, grupo, año, VIN, dispositivo
//       · datos contextuales · no cambian con el tiempo
//
//  Diferencia con el Libro B:
//    · Sin íconos chillones (Gauge, KeyRound, etc.) · etiquetas
//      de texto puro · cumple Tufte
//    · Sin colores en estados normales · solo el banner de
//      alarmas es rojo · el resto en grayscale
//    · Dot indicators (●) solo cuando aportan información
//      categórica binaria (motor on/off, comm online/offline)
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: AssetLiveStatusData;
  /** Href para el banner de alarmas activas · contextual */
  alarmsHref: string;
}

export function LiveStatus({ data, alarmsHref }: Props) {
  const { lastPosition, commState, msSinceLastSeen, openAlarms } = data;
  const hasOpenAlarm = openAlarms > 0;

  return (
    <div className={styles.wrap}>
      {/* ── Banner de alarmas activas ───────────────────── */}
      {hasOpenAlarm && (
        <div className={styles.alarmBanner}>
          <span className={styles.alarmTitle}>
            {openAlarms === 1
              ? "1 alarma activa"
              : `${openAlarms} alarmas activas`}
          </span>
          <span className={styles.alarmHint}>· acción requerida</span>
          <Link href={alarmsHref} className={styles.alarmAction}>
            Ver alarmas →
          </Link>
        </div>
      )}

      {/* ── Estado actual · 5 celdas ──────────────────────── */}
      <div className={styles.stateRow}>
        <StateCell
          label="Velocidad"
          value={lastPosition ? `${Math.round(lastPosition.speedKmh)} km/h` : "—"}
        />
        <StateCell
          label="Motor"
          value={
            lastPosition ? (lastPosition.ignition ? "Encendido" : "Apagado") : "—"
          }
          dotState={
            lastPosition === null
              ? undefined
              : lastPosition.ignition
                ? "on"
                : "off"
          }
        />
        <StateCell
          label="Rumbo"
          value={
            lastPosition && lastPosition.heading !== null
              ? `${degToCardinal(lastPosition.heading)} · ${lastPosition.heading}°`
              : "—"
          }
        />
        <StateCell
          label="Comunicación"
          value={commLabel(commState, msSinceLastSeen)}
          dotState={commDotState(commState)}
        />
        {lastPosition && (
          <StateCell
            label="Posición"
            value={`${lastPosition.lat.toFixed(4)}, ${lastPosition.lng.toFixed(4)}`}
            mono
            grow
          />
        )}
      </div>

      {/* ── Datos del vehículo · 3-5 chips ─────────────────── */}
      <div className={styles.dataRow}>
        <DataCell label="Cuenta" value={data.accountName} />
        {data.groupName && <DataCell label="Grupo" value={data.groupName} />}
        {data.year !== null && <DataCell label="Año" value={String(data.year)} />}
        {data.vin && <DataCell label="VIN" value={data.vin} mono />}
        {data.primaryDevice && (
          <DataCell
            label="Dispositivo"
            value={`${data.primaryDevice.vendor} ${data.primaryDevice.model}`}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-componentes
// ═══════════════════════════════════════════════════════════════

interface StateCellProps {
  label: string;
  value: string;
  dotState?: "on" | "off" | "warn" | "neutral";
  mono?: boolean;
  grow?: boolean;
}

function StateCell({ label, value, dotState, mono, grow }: StateCellProps) {
  return (
    <div className={`${styles.stateCell} ${grow ? styles.stateCellGrow : ""}`}>
      <span className={styles.stateLabel}>{label}</span>
      <span className={styles.stateValueWrap}>
        {dotState && (
          <span
            className={`${styles.dot} ${styles[`dot_${dotState}`]}`}
            aria-hidden="true"
          />
        )}
        <span className={`${styles.stateValue} ${mono ? styles.mono : ""}`}>
          {value}
        </span>
      </span>
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
      <span className={styles.dataSep}>·</span>
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
  state: "ONLINE" | "RECENT" | "STALE" | "NO_COMM",
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
  state: "ONLINE" | "RECENT" | "STALE" | "NO_COMM",
): "on" | "warn" | "neutral" | "off" {
  if (state === "ONLINE") return "on";
  if (state === "RECENT") return "warn";
  if (state === "STALE") return "neutral";
  return "off";
}
