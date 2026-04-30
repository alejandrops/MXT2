import type { FlespiMessage, SkipReason } from "./flespi-types";

// ═══════════════════════════════════════════════════════════════
//  Flespi message mapper (I1)
//  ─────────────────────────────────────────────────────────────
//  Transforma un FlespiMessage crudo en un payload listo para
//  insertar en la tabla Position de Prisma. Aplica:
//   · Validación de campos críticos (ident, timestamp, lat, lng)
//   · Conversión de timestamps Unix → Date
//   · Defaults razonables para campos opcionales (heading, ignition)
//   · Truncado de valores fuera de rango (lat/lng inválidas)
//
//  El mapper NO consulta la DB · solo transforma. La resolución
//  de Device.imei → assetId se hace afuera, en el route handler,
//  para optimizar consultas batch (un solo findMany por todos los
//  IMEIs del batch en lugar de N findUnique).
// ═══════════════════════════════════════════════════════════════

export interface MappedPosition {
  ident: string;
  recordedAt: Date;
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number | null;
  ignition: boolean;
}

export type MapResult =
  | { ok: true; data: MappedPosition }
  | { ok: false; reason: SkipReason; detail?: string };

/**
 * Mapea un message de flespi al shape requerido por Position.
 *
 * @returns
 *  - `{ ok: true, data }` si el message es válido y se puede persistir
 *  - `{ ok: false, reason, detail? }` si hay que skipearlo
 */
export function mapFlespiMessage(msg: FlespiMessage): MapResult {
  // ── ident · obligatorio para matchear con un Device ────────────
  const ident = typeof msg.ident === "string" ? msg.ident.trim() : "";
  if (ident.length === 0) {
    return { ok: false, reason: "missing_ident" };
  }

  // ── timestamp · usamos el del fix GPS, no el del server ──────
  const tsRaw = msg.timestamp;
  if (typeof tsRaw !== "number" || !Number.isFinite(tsRaw) || tsRaw <= 0) {
    return {
      ok: false,
      reason: "missing_timestamp",
      detail: `ident=${ident} timestamp inválido o ausente`,
    };
  }
  // Flespi manda timestamps en segundos (con decimales). A ms para Date.
  const recordedAt = new Date(tsRaw * 1000);

  // ── position · lat/lng obligatorios ────────────────────────────
  const lat = msg["position.latitude"];
  const lng = msg["position.longitude"];
  if (typeof lat !== "number" || typeof lng !== "number") {
    return {
      ok: false,
      reason: "missing_position",
      detail: `ident=${ident} lat/lng ausentes`,
    };
  }
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return {
      ok: false,
      reason: "invalid_fix",
      detail: `ident=${ident} lat=${lat} lng=${lng} fuera de rango`,
    };
  }

  // ── position.valid · si flespi lo manda como false, descartamos ─
  if (msg["position.valid"] === false) {
    return {
      ok: false,
      reason: "invalid_fix",
      detail: `ident=${ident} position.valid=false`,
    };
  }

  // ── speed · default 0 si no viene, validar rango razonable ───
  let speedKmh = 0;
  if (typeof msg["position.speed"] === "number") {
    const s = msg["position.speed"];
    // Cap a 300 km/h · cualquier valor superior es probablemente un bug
    speedKmh = Math.max(0, Math.min(300, s));
  }

  // ── heading · opcional ──────────────────────────────────────
  let heading: number | null = null;
  if (typeof msg["position.direction"] === "number") {
    const h = Math.round(msg["position.direction"]);
    // Normalizar a 0-359
    heading = ((h % 360) + 360) % 360;
  }

  // ── ignition · default a true si hay speed > 0, false si no ─
  let ignition: boolean;
  if (typeof msg["engine.ignition.status"] === "boolean") {
    ignition = msg["engine.ignition.status"];
  } else if (typeof msg["movement.status"] === "boolean") {
    // Fallback razonable si el device no reporta ignition explícito
    ignition = msg["movement.status"];
  } else {
    ignition = speedKmh > 0;
  }

  return {
    ok: true,
    data: {
      ident,
      recordedAt,
      lat,
      lng,
      speedKmh,
      heading,
      ignition,
    },
  };
}
