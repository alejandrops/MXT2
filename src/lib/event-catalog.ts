// ═══════════════════════════════════════════════════════════════
//  event-catalog · S4-L2 · metadata UI de los EventType
//  ─────────────────────────────────────────────────────────────
//  Single source of truth para:
//    · grupos lógicos (Conducción, Seguridad, Geofence)
//    · labels en español
//    · colores para pins y heatmap
//    · iconos
//
//  Reusado por:
//    · /actividad/eventos · listado y filtros
//    · EventHeatmap · color por tipo
//    · EventDetailPanel · ícono + label
// ═══════════════════════════════════════════════════════════════

import type { EventType } from "@/types/domain";

export type EventCategory = "conduccion" | "seguridad" | "geofence";

export interface EventTypeMeta {
  type: EventType;
  category: EventCategory;
  label: string;
  /** Color hex para pin/heatmap · reusa paleta de severity-like */
  color: string;
}

export const EVENT_TYPE_CATALOG: Record<EventType, EventTypeMeta> = {
  // ─── Conducción ─────────────────────────────────────
  HARSH_BRAKING: {
    type: "HARSH_BRAKING",
    category: "conduccion",
    label: "Frenada brusca",
    color: "#dc2626", // rojo
  },
  HARSH_ACCELERATION: {
    type: "HARSH_ACCELERATION",
    category: "conduccion",
    label: "Aceleración brusca",
    color: "#ea580c", // naranja
  },
  HARSH_CORNERING: {
    type: "HARSH_CORNERING",
    category: "conduccion",
    label: "Curva agresiva",
    color: "#f59e0b", // ámbar
  },
  SPEEDING: {
    type: "SPEEDING",
    category: "conduccion",
    label: "Exceso de velocidad",
    color: "#dc2626", // rojo
  },
  IDLING: {
    type: "IDLING",
    category: "conduccion",
    label: "Ralentí prolongado",
    color: "#a16207", // mostaza
  },
  IGNITION_ON: {
    type: "IGNITION_ON",
    category: "conduccion",
    label: "Encendido motor",
    color: "#0ea5e9", // celeste
  },
  IGNITION_OFF: {
    type: "IGNITION_OFF",
    category: "conduccion",
    label: "Apagado motor",
    color: "#64748b", // gris
  },

  // ─── Seguridad ──────────────────────────────────────
  PANIC_BUTTON: {
    type: "PANIC_BUTTON",
    category: "seguridad",
    label: "Botón de pánico",
    color: "#991b1b", // rojo oscuro
  },
  UNAUTHORIZED_USE: {
    type: "UNAUTHORIZED_USE",
    category: "seguridad",
    label: "Uso no autorizado",
    color: "#b91c1c",
  },
  DOOR_OPEN: {
    type: "DOOR_OPEN",
    category: "seguridad",
    label: "Puerta abierta",
    color: "#7c3aed", // violeta
  },
  SIDE_DOOR_OPEN: {
    type: "SIDE_DOOR_OPEN",
    category: "seguridad",
    label: "Puerta lateral abierta",
    color: "#7c3aed",
  },
  CARGO_DOOR_OPEN: {
    type: "CARGO_DOOR_OPEN",
    category: "seguridad",
    label: "Puerta de carga abierta",
    color: "#7c3aed",
  },
  TRAILER_DETACH: {
    type: "TRAILER_DETACH",
    category: "seguridad",
    label: "Acoplado desenganchado",
    color: "#9333ea",
  },
  GPS_DISCONNECT: {
    type: "GPS_DISCONNECT",
    category: "seguridad",
    label: "Pérdida de GPS",
    color: "#475569",
  },
  POWER_DISCONNECT: {
    type: "POWER_DISCONNECT",
    category: "seguridad",
    label: "Pérdida de alimentación",
    color: "#475569",
  },
  JAMMING_DETECTED: {
    type: "JAMMING_DETECTED",
    category: "seguridad",
    label: "Inhibición de señal",
    color: "#dc2626",
  },
  SABOTAGE: {
    type: "SABOTAGE",
    category: "seguridad",
    label: "Sabotaje",
    color: "#991b1b",
  },

  // ─── Geofence ───────────────────────────────────────
  GEOFENCE_ENTRY: {
    type: "GEOFENCE_ENTRY",
    category: "geofence",
    label: "Ingreso a geocerca",
    color: "#16a34a", // verde
  },
  GEOFENCE_EXIT: {
    type: "GEOFENCE_EXIT",
    category: "geofence",
    label: "Salida de geocerca",
    color: "#65a30d", // verde lima
  },
};

export interface EventCategoryDef {
  key: EventCategory;
  label: string;
  types: EventType[];
}

export const EVENT_CATEGORIES: EventCategoryDef[] = [
  {
    key: "conduccion",
    label: "Conducción",
    types: [
      "HARSH_BRAKING",
      "HARSH_ACCELERATION",
      "HARSH_CORNERING",
      "SPEEDING",
      "IDLING",
      "IGNITION_ON",
      "IGNITION_OFF",
    ],
  },
  {
    key: "seguridad",
    label: "Seguridad",
    types: [
      "PANIC_BUTTON",
      "UNAUTHORIZED_USE",
      "DOOR_OPEN",
      "SIDE_DOOR_OPEN",
      "CARGO_DOOR_OPEN",
      "TRAILER_DETACH",
      "GPS_DISCONNECT",
      "POWER_DISCONNECT",
      "JAMMING_DETECTED",
      "SABOTAGE",
    ],
  },
  {
    key: "geofence",
    label: "Geocercas",
    types: ["GEOFENCE_ENTRY", "GEOFENCE_EXIT"],
  },
];

export function getEventLabel(type: EventType): string {
  return EVENT_TYPE_CATALOG[type]?.label ?? type;
}

export function getEventColor(type: EventType): string {
  return EVENT_TYPE_CATALOG[type]?.color ?? "#64748b";
}

export function getEventCategory(type: EventType): EventCategory {
  return EVENT_TYPE_CATALOG[type]?.category ?? "conduccion";
}
