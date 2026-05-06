"use client";

import styles from "./AlarmTypeCell.module.css";

// ═══════════════════════════════════════════════════════════════
//  AlarmTypeCell · S5-T5
//  ─────────────────────────────────────────────────────────────
//  Mapea el enum AlarmType a un label legible en español.
//  Análogo al EventTypeCell pero específico para alarmas.
// ═══════════════════════════════════════════════════════════════

export type AlarmTypeValue =
  // Conducción
  | "HARSH_DRIVING_PATTERN"
  | "SPEEDING_CRITICAL"
  | "RECKLESS_BEHAVIOR"
  // Seguridad
  | "PANIC"
  | "UNAUTHORIZED_USE"
  | "SABOTAGE"
  | "GPS_DISCONNECT"
  | "POWER_DISCONNECT"
  | "JAMMING"
  | "TRAILER_DETACH"
  | "CARGO_BREACH"
  | "DOOR_BREACH"
  | "GEOFENCE_BREACH_CRITICAL"
  // Transversales
  | "DEVICE_OFFLINE";

const LABELS: Record<AlarmTypeValue, string> = {
  HARSH_DRIVING_PATTERN: "Patrón de conducción agresiva",
  SPEEDING_CRITICAL: "Exceso crítico de velocidad",
  RECKLESS_BEHAVIOR: "Comportamiento temerario",
  PANIC: "Pánico",
  UNAUTHORIZED_USE: "Uso no autorizado",
  SABOTAGE: "Sabotaje",
  GPS_DISCONNECT: "GPS desconectado",
  POWER_DISCONNECT: "Energía desconectada",
  JAMMING: "Jamming detectado",
  TRAILER_DETACH: "Acoplado desenganchado",
  CARGO_BREACH: "Carga comprometida",
  DOOR_BREACH: "Puerta abierta",
  GEOFENCE_BREACH_CRITICAL: "Salida de geocerca crítica",
  DEVICE_OFFLINE: "Dispositivo offline",
};

interface Props {
  type: AlarmTypeValue;
  compact?: boolean;
}

export function AlarmTypeCell({ type, compact }: Props) {
  const label = LABELS[type] ?? type;
  if (compact) {
    return <span className={styles.compact}>{label}</span>;
  }
  return <span className={styles.full}>{label}</span>;
}

export function alarmTypeLabel(type: string): string {
  return LABELS[type as AlarmTypeValue] ?? type;
}
