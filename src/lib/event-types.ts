import type { EventType } from "@/types/domain";

// ═══════════════════════════════════════════════════════════════
//  src/lib/event-types.ts · S3-L3
//  ─────────────────────────────────────────────────────────────
//  Single source of truth para grupos de EventType usados en
//  queries de telemetría · driving behavior · alertas.
//
//  Tipado contra el enum real de Prisma (`EventType`) · si alguien
//  agrega un string que no existe, typecheck explota antes de que
//  Prisma lo rechace en runtime (que fue el bug de S2-L7.1).
//
//  Uso:
//    import { DRIVING_BEHAVIOR_EVENT_TYPES } from "@/lib/event-types";
//    db.event.count({ where: { type: { in: DRIVING_BEHAVIOR_EVENT_TYPES } } });
//
//  Reemplaza arrays locales que vivían en:
//    · SummaryBookTab.tsx (S1-L6)
//    · driver-month-summary.ts
//    · group-peers.ts (S1-L4b)
//    · driver-peers.ts (S2-L7)
//    · group-siblings.ts (S2-L7)
// ═══════════════════════════════════════════════════════════════

/**
 * Eventos que reflejan el comportamiento de manejo · usados para
 * calcular eventos/100km, scoring, comparativas entre conductores.
 *
 * NO incluye eventos puramente operativos (TRIP_START/END,
 * IGNITION_*, GEOFENCE_*) ni alertas del equipo (DTC, BATTERY).
 */
export const DRIVING_BEHAVIOR_EVENT_TYPES: readonly EventType[] = [
  "HARSH_ACCELERATION",
  "HARSH_BRAKING",
  "HARSH_CORNERING",
  "SPEEDING",
  "IDLING",
] as const;
