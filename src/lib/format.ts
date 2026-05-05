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

// ─── Eventos de telemetría · ignición ─────────────────────────
//
//  Estos tipos NO se cuentan como "eventos de conducción/seguridad" ·
//  son señales de operación del vehículo. Se filtran en queries que
//  agregan eventos para reportes/boletín.
//
//  Tipado como `EventType[]` para que Prisma `notIn` lo acepte sin cast.

export const TELEMETRY_EVENT_TYPES: EventType[] = [
  "IGNITION_ON",
  "IGNITION_OFF",
];

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
export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return numberFormatter.format(n);
}

/**
 * Format a duration in milliseconds as e.g. "9h 42m" or "47m" or "1d 3h".
 *
 * Defensivo · si recibe undefined/null/NaN devuelve "0m" en lugar de
 * "NaNm" o crashear. Esto evita el bug B7/BC4 donde "Ver NaN más"
 * aparecía cuando los KPIs aún no estaban calculados.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "0m";
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

/**
 * Format kilometers with auto-scale a Mm (megámetros = 1000 km).
 * Devuelve { value, unit } para usar en KPI strips donde el unit
 * va separado del número.
 *
 * Defensivo · si recibe undefined/null/NaN devuelve { value: "0",
 * unit: "km" } en lugar de NaN. Evita el "Ver NaN más" del bug
 * B7/BC4 cuando los KPIs no están listos.
 */
export function formatKm(
  km: number | null | undefined,
): { value: string; unit: string } {
  if (km == null || !Number.isFinite(km) || km < 0) {
    return { value: "0", unit: "km" };
  }
  if (km >= 1000) {
    return {
      value: (km / 1000).toLocaleString("es-AR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      unit: "Mm",
    };
  }
  return {
    value: km.toLocaleString("es-AR", {
      maximumFractionDigits: 0,
    }),
    unit: "km",
  };
}

/**
 * Round defensivo · evita NaN cuando recibe undefined/null. Para
 * usar en lugar de Math.round() directo donde el dato puede no
 * estar listo.
 */
export function safeRound(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.round(n);
}

// ═══════════════════════════════════════════════════════════════
//  S5-T2 · Formatters canónicos para tablas y paneles
//  ─────────────────────────────────────────────────────────────
//  Funciones puras adicionadas para unificar el display de datos
//  en todas las listas (Eventos · Alarmas · Infracciones · etc.).
//  Reglas Tufte:
//    · Timestamp default → corto, mono, denso (dd/mm/yy hh:mm)
//    · Solo se muestra el contexto necesario (no segundos en
//      celdas de tabla salvo cuando aporta información)
//    · Coords y números siempre en monoespaciada
// ═══════════════════════════════════════════════════════════════

const ART_TZ = "America/Argentina/Buenos_Aires";

const DOW_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MES_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export type TimestampVariant =
  | "short"          // 05/05/26 14:32  · default tabla
  | "with-seconds"   // 05/05/26 14:32:18 · útil cuando los seg importan
  | "long"           // 5 may 2026, 14:32 ART · panel detalle
  | "long-seconds"   // 5 may 2026, 14:32:18 ART
  | "date-only"      // LUN 05 may
  | "time-only"      // 14:32
  | "time-only-seconds"; // 14:32:18

/**
 * Formatea un timestamp ISO en zona ART de forma consistente.
 * Variante default ("short") es la canónica para celdas de tabla:
 * dd/mm/yy hh:mm en monoespaciada.
 */
export function formatTimestamp(
  iso: string | Date | null | undefined,
  variant: TimestampVariant = "short",
): string {
  if (iso == null) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";

  switch (variant) {
    case "short":
      return d.toLocaleString("es-AR", {
        timeZone: ART_TZ,
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    case "with-seconds":
      return d.toLocaleString("es-AR", {
        timeZone: ART_TZ,
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    case "long":
      return d.toLocaleString("es-AR", {
        timeZone: ART_TZ,
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " ART";
    case "long-seconds":
      return d.toLocaleString("es-AR", {
        timeZone: ART_TZ,
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) + " ART";
    case "date-only": {
      // ART local · usamos ajuste manual a UTC-3
      const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      const dow = DOW_SHORT[local.getUTCDay()] ?? "";
      const day = String(local.getUTCDate()).padStart(2, "0");
      const month = MES_SHORT[local.getUTCMonth()] ?? "";
      return `${dow} ${day} ${month}`;
    }
    case "time-only":
      return d.toLocaleTimeString("es-AR", {
        timeZone: ART_TZ,
        hour: "2-digit",
        minute: "2-digit",
      });
    case "time-only-seconds":
      return d.toLocaleTimeString("es-AR", {
        timeZone: ART_TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
  }
}

/**
 * Formatea metros como string completo · "7.45 km" / "850 m".
 * Distinto de formatKm() que devuelve {value, unit} para KPI strips.
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toLocaleString("es-AR", {
    minimumFractionDigits: km < 100 ? 2 : 1,
    maximumFractionDigits: km < 100 ? 2 : 1,
  })} km`;
}

/**
 * Formatea km/h como string · "71 km/h". Redondea a entero.
 */
export function formatSpeed(kmh: number | null | undefined): string {
  if (kmh == null || !Number.isFinite(kmh)) return "—";
  return `${Math.round(kmh)} km/h`;
}

/**
 * Formatea coords como par mono · "-34.79242, -58.21453".
 * Default 5 decimales (precisión metro).
 */
export function formatCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
  decimals = 5,
): string {
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return "—";
  }
  return `${lat.toFixed(decimals)}, ${lng.toFixed(decimals)}`;
}

/**
 * Formatea segundos como string corto · "6m 17s" / "45s" / "2h 35m 12s".
 * Distinto de formatDuration(ms) que es para milisegundos.
 */
export function formatDurationFromSec(
  sec: number | null | undefined,
): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "—";
  const totalMin = Math.floor(sec / 60);
  const remSec = Math.floor(sec % 60);
  if (totalMin === 0) return `${remSec}s`;
  if (totalMin < 60) {
    return remSec === 0 ? `${totalMin}m` : `${totalMin}m ${remSec}s`;
  }
  const h = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  if (remMin === 0 && remSec === 0) return `${h}h`;
  if (remSec === 0) return `${h}h ${remMin}m`;
  return `${h}h ${remMin}m ${remSec}s`;
}

// ═══════════════════════════════════════════════════════════════
//  Severity semántica · mapping desde enums del dominio a clases
//  visuales. Mantiene una sola fuente de verdad para los colores
//  de severidad en toda la app.
// ═══════════════════════════════════════════════════════════════

export type SemanticSeverity = "info" | "warning" | "danger" | "critical";

/**
 * Mapea cualquier valor de severidad (LOW/MEDIUM/HIGH/CRITICAL,
 * LEVE/MEDIA/GRAVE, "Bajo"/"Medio"/etc.) a una clase semántica
 * que después se usa para asignar color en SeverityBadge.
 */
export function mapSeverityToSemantic(level: string): SemanticSeverity {
  const v = level.toUpperCase();
  if (v === "LOW" || v === "BAJO" || v === "BAJA") return "info";
  if (v === "MEDIUM" || v === "MEDIO" || v === "MEDIA" || v === "LEVE")
    return "warning";
  if (v === "HIGH" || v === "ALTO" || v === "ALTA") return "danger";
  if (v === "GRAVE") return "danger";
  if (v === "CRITICAL" || v === "CRITICA" || v === "CRÍTICA") return "critical";
  return "info";
}
