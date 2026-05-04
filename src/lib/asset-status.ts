// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
import type { LivePosition, AssetStatus } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════
//  asset-status.ts · estado del vehículo unificado (L0-B)
//  ─────────────────────────────────────────────────────────────
//  Función única para derivar el estado de un vehículo basándose
//  en su LivePosition. Reemplaza el patrón anterior donde cada
//  pantalla calculaba el estado distinto:
//   · Catálogos leía Asset.status (denormalizado, a veces stale)
//   · Mapa derivaba de speedKmh + ignition (más "real")
//   · Torre miraba updatedAt para ver si está "online"
//
//  Resultado del bug B3 · "Sin señal" en una pantalla y "moviendo"
//  a 57 km/h en otra · al mismo tiempo · al mismo vehículo.
//
//  La función deriveAssetState() es la fuente única de verdad.
// ═══════════════════════════════════════════════════════════════

/**
 * Estado lógico del vehículo en este momento. Derivado de la última
 * LivePosition. Este enum es el mismo que `AssetStatus` de Prisma
 * pero con semántica derivada en runtime, no almacenada.
 */
export type DerivedAssetState = AssetStatus;

/**
 * Threshold · si el último report fue hace más de N horas, el
 * vehículo se considera "OFFLINE" (sin señal). Default 24h porque
 * es razonable para vehículos comerciales · podés bajarlo a 1-2 hs
 * si vas a tener crons frecuentes.
 */
export const NO_SIGNAL_THRESHOLD_HOURS = 24;

/**
 * Threshold · velocidad mínima para considerar "MOVING". Por debajo
 * de esto, el vehículo se considera detenido aunque el motor esté
 * encendido (ralentí, parado en semáforo, etc.).
 */
export const MOVING_MIN_KMH = 5;

/**
 * Deriva el estado lógico de un vehículo basándose en su
 * LivePosition. Si no hay LivePosition (asset nuevo o sin datos),
 * retorna OFFLINE.
 *
 * Lógica:
 *   1. Sin LivePosition → OFFLINE
 *   2. updatedAt > 24h → OFFLINE (sin señal)
 *   3. ignition=false → STOPPED (apagado)
 *   4. ignition=true + speedKmh > 5 → MOVING
 *   5. ignition=true + speedKmh ≤ 5 → IDLE (motor encendido sin moverse)
 *
 * El estado MAINTENANCE no se deriva acá · ese es un override manual
 * desde el catálogo (admin marca el vehículo en mantenimiento).
 */
export function deriveAssetState(
  live: Pick<LivePosition, "updatedAt" | "speedKmh" | "ignition"> | null,
  now: Date = new Date(),
): DerivedAssetState {
  if (!live) return "OFFLINE";

  const ageHours = (now.getTime() - live.updatedAt.getTime()) / 3600000;
  if (ageHours > NO_SIGNAL_THRESHOLD_HOURS) return "OFFLINE";

  if (!live.ignition) return "STOPPED";
  if (live.speedKmh > MOVING_MIN_KMH) return "MOVING";
  return "IDLE";
}

/**
 * Para mostrar un label corto del estado en la UI.
 */
export const ASSET_STATE_LABEL: Record<DerivedAssetState, string> = {
  MOVING: "En movimiento",
  IDLE: "En ralentí",
  STOPPED: "Detenido",
  OFFLINE: "Sin señal",
  MAINTENANCE: "Mantenimiento",
};

/**
 * Label corto (para chips, KPIs, badges).
 */
export const ASSET_STATE_LABEL_SHORT: Record<DerivedAssetState, string> = {
  MOVING: "Moviendo",
  IDLE: "Ralentí",
  STOPPED: "Detenido",
  OFFLINE: "Sin señal",
  MAINTENANCE: "Mant.",
};

/**
 * Color semántico (para badges, dots, chart segments).
 * Mapea al sistema de tokens · usar con CSS var(--{value}).
 */
export const ASSET_STATE_COLOR: Record<DerivedAssetState, string> = {
  MOVING: "grn", // verde · todo OK, en movimiento
  IDLE: "amb", // ámbar · motor encendido sin moverse (alerta de ralentí)
  STOPPED: "t3", // gris · normal apagado
  OFFLINE: "t3", // gris · sin señal
  MAINTENANCE: "blu", // azul · estado especial admin
};
