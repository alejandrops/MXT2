// ═══════════════════════════════════════════════════════════════
//  Format helpers
//  ─────────────────────────────────────────────────────────────
//  Pure functions — no React, no Prisma. Used by display
//  components to translate enum values to user-facing strings
//  and to format dates/numbers consistently.
// ═══════════════════════════════════════════════════════════════

import type {
  AlarmDomain,
  AlarmStatus,
  AlarmType,
  AssetStatus,
  EventType,
  MobilityType,
  Severity,
} from "@/types/domain";

// ── Spanish labels for enum types ──────────────────────────────

export const ALARM_DOMAIN_LABEL: Record<AlarmDomain, string> = {
  CONDUCCION: "Conducción",
  SEGURIDAD: "Seguridad",
};

export const ALARM_TYPE_LABEL: Record<AlarmType, string> = {
  // Conducción
  HARSH_DRIVING_PATTERN: "Conducción brusca recurrente",
  SPEEDING_CRITICAL: "Exceso de velocidad crítico",
  RECKLESS_BEHAVIOR: "Conducción imprudente",
  // Seguridad
  PANIC: "Botón de pánico",
  UNAUTHORIZED_USE: "Uso no autorizado",
  SABOTAGE: "Sabotaje",
  GPS_DISCONNECT: "Desconexión de GPS",
  POWER_DISCONNECT: "Desconexión eléctrica",
  JAMMING: "Inhibidor detectado",
  TRAILER_DETACH: "Desenganche de trailer",
  CARGO_BREACH: "Apertura de carga",
  DOOR_BREACH: "Apertura de puerta",
  GEOFENCE_BREACH_CRITICAL: "Salida de zona crítica",
  // Transversales
  DEVICE_OFFLINE: "Dispositivo offline",
};

/// Map each AlarmType to its domain. Used to filter alarms shown
/// in the Seguridad module vs Conducción module.
export const ALARM_TYPE_TO_DOMAIN: Record<AlarmType, AlarmDomain> = {
  HARSH_DRIVING_PATTERN: "CONDUCCION",
  SPEEDING_CRITICAL: "CONDUCCION",
  RECKLESS_BEHAVIOR: "CONDUCCION",
  PANIC: "SEGURIDAD",
  UNAUTHORIZED_USE: "SEGURIDAD",
  SABOTAGE: "SEGURIDAD",
  GPS_DISCONNECT: "SEGURIDAD",
  POWER_DISCONNECT: "SEGURIDAD",
  JAMMING: "SEGURIDAD",
  TRAILER_DETACH: "SEGURIDAD",
  CARGO_BREACH: "SEGURIDAD",
  DOOR_BREACH: "SEGURIDAD",
  GEOFENCE_BREACH_CRITICAL: "SEGURIDAD",
  DEVICE_OFFLINE: "SEGURIDAD", // by default goes to Seguridad inbox
};

export const ALARM_STATUS_LABEL: Record<AlarmStatus, string> = {
  OPEN: "Abierta",
  ATTENDED: "Atendida",
  CLOSED: "Cerrada",
  DISMISSED: "Descartada",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  MOVING: "En movimiento",
  IDLE: "Detenido",
  STOPPED: "Detenido prol.",
  OFFLINE: "Sin señal",
  MAINTENANCE: "Mantenimiento",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  // Conducción
  HARSH_BRAKING: "Frenado brusco",
  HARSH_ACCELERATION: "Aceleración brusca",
  HARSH_CORNERING: "Curva brusca",
  SPEEDING: "Exceso de velocidad",
  IDLING: "Ralentí prolongado",
  IGNITION_ON: "Encendido",
  IGNITION_OFF: "Apagado",
  // Seguridad
  PANIC_BUTTON: "Botón de pánico",
  UNAUTHORIZED_USE: "Uso no autorizado",
  DOOR_OPEN: "Apertura de puerta",
  SIDE_DOOR_OPEN: "Apertura lateral",
  CARGO_DOOR_OPEN: "Apertura puerta de carga",
  TRAILER_DETACH: "Desenganche de trailer",
  GPS_DISCONNECT: "Desconexión de GPS",
  POWER_DISCONNECT: "Desconexión eléctrica",
  JAMMING_DETECTED: "Inhibidor detectado",
  SABOTAGE: "Sabotaje",
  // Transversales
  GEOFENCE_ENTRY: "Entrada a zona",
  GEOFENCE_EXIT: "Salida de zona",
};

/// Map each EventType to its domain. Mirrors ALARM_TYPE_TO_DOMAIN
/// but for events. Used to filter event lists per module.
export const EVENT_TYPE_TO_DOMAIN: Record<EventType, AlarmDomain> = {
  HARSH_BRAKING: "CONDUCCION",
  HARSH_ACCELERATION: "CONDUCCION",
  HARSH_CORNERING: "CONDUCCION",
  SPEEDING: "CONDUCCION",
  IDLING: "CONDUCCION",
  IGNITION_ON: "CONDUCCION",
  IGNITION_OFF: "CONDUCCION",
  PANIC_BUTTON: "SEGURIDAD",
  UNAUTHORIZED_USE: "SEGURIDAD",
  DOOR_OPEN: "SEGURIDAD",
  SIDE_DOOR_OPEN: "SEGURIDAD",
  CARGO_DOOR_OPEN: "SEGURIDAD",
  TRAILER_DETACH: "SEGURIDAD",
  GPS_DISCONNECT: "SEGURIDAD",
  POWER_DISCONNECT: "SEGURIDAD",
  JAMMING_DETECTED: "SEGURIDAD",
  SABOTAGE: "SEGURIDAD",
  GEOFENCE_ENTRY: "SEGURIDAD", // crossing zones is a security signal
  GEOFENCE_EXIT: "SEGURIDAD",
};

export const MOBILITY_LABEL: Record<MobilityType, string> = {
  MOBILE: "Móvil",
  FIXED: "Fijo",
};

// ── Relative time ──────────────────────────────────────────────

/**
 * Returns a human-readable relative string in Spanish.
 *  · < 60s     → "ahora mismo"
 *  · < 60min   → "hace X min"
 *  · < 24h     → "hace Xh"
 *  · < 7d      → "hace Xd"
 *  · otherwise → "DD/MM HH:mm"
 */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return "ahora mismo";

  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;

  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;

  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

// ── Initials for avatars ───────────────────────────────────────

export function initials(firstName: string, lastName: string): string {
  return (firstName[0] ?? "") + (lastName[0] ?? "");
}

// ── Number formatting (es-AR) ──────────────────────────────────

const numberFormatter = new Intl.NumberFormat("es-AR");
export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

/**
 * Format a duration in milliseconds as e.g. "9h 42m" or "47m" or "1d 3h".
 */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) {
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  }
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH === 0 ? `${days}d` : `${days}d ${remH}h`;
}
