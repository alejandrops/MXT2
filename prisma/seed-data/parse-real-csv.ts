// ═══════════════════════════════════════════════════════════════
//  Real trajectory CSV parser
//  ─────────────────────────────────────────────────────────────
//  Parses Maxtracker-format historical CSV exports (the same
//  format produced by avl.maxtracker.com).
//
//  CSV format:
//    line 1: BOM
//    line 2: sep=;
//    line 3: header (semicolon-separated)
//    line 4+: data rows
//
//  Columns of interest:
//    [0]  Interno
//    [1]  Fecha (recordedAt) · "YYYY-MM-DD HH:MM:SS"
//    [2]  Comunicación (receivedAt)
//    [4]  Velocidad (km/h)
//    [5]  Evento (name)
//    [6]  Tipo (category)
//    [15] Rumbo (heading 0-359)
//    [17] Coordenadas · "-33.09975 -68.68637"
//
//  Returns:
//    · positions[] · one entry per row that produces a valid GPS reading
//    · events[]    · only for rows whose event maps to our enum
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import type { EventType, Severity } from "@prisma/client";

export interface ParsedPosition {
  recordedAt: Date;
  receivedAt: Date;
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number;
  ignition: boolean;
}

export interface ParsedEvent {
  occurredAt: Date;
  type: EventType;
  severity: Severity;
  lat: number | null;
  lng: number | null;
  speedKmh: number;
  metadata: string;
}

export interface ParsedCsv {
  filename: string;
  interno: string; // raw value from first column · could be plate or numeric internal
  plate: string; // extracted from filename · "AA890XH" / "AB257ND" etc
  positions: ParsedPosition[];
  events: ParsedEvent[];
  startAt: Date | null;
  endAt: Date | null;
}

// ═══════════════════════════════════════════════════════════════
//  Event mapping · tu sistema actual → Maxtracker enum
//  ─────────────────────────────────────────────────────────────
//  Decisiones del proyecto:
//    · "Pánico"/"Posición en pánico" → PANIC_BUTTON CRITICAL (con dedup 5min)
//    · "Cambio de rumbo" → ignorar (es comportamiento normal)
//    · "Conducta de manejo / Movimiento brusco" → HARSH_ACCELERATION
//    · "Conducta de manejo / Frenada brusca" → HARSH_BRAKING
//    · "Sensores / Puerta de cabina abierta" → DOOR_OPEN (cerrada se descarta)
//    · "Sensores / Puerta de carga abierta" → CARGO_DOOR_OPEN
//    · "Posición / Supero NN" → SPEEDING (las "Debajo NN" se descartan)
//    · "Posición / En ralentí" / "Entra en ralentí" → IDLING
//    · "Equipo / Falla de red" → GPS_DISCONNECT
//    · "Batería / Batería secundaria baja" → POWER_DISCONNECT (HIGH)
//    · "Posición" / "Posición / En movimiento" / "Posición / Detenido"
//      / "Posición / Cambio de rumbo" → no son eventos, solo pings
// ═══════════════════════════════════════════════════════════════

interface EventMapping {
  type: EventType;
  severity: Severity;
}

function mapEvent(
  tipo: string,
  evento: string,
  speedKmh: number,
): EventMapping | null {
  // Strip surrounding quotes and trim
  const t = tipo.replace(/^"|"$/g, "").trim();
  const e = evento.replace(/^"|"$/g, "").trim();

  // ─── Posición · pings y umbrales de velocidad ────────────────
  if (t === "Posición") {
    if (e === "Posición") return null; // ping regular
    if (e === "En movimiento") return null; // movement state
    if (e === "Detenido") return null; // stop state
    if (e === "Cambio de rumbo") return null; // heading change >30°
    if (e === "Motor encendido") {
      return { type: "IGNITION_ON", severity: "LOW" };
    }
    if (e === "Motor apagado") {
      return { type: "IGNITION_OFF", severity: "LOW" };
    }
    if (e === "En ralentí" || e === "Entra en ralentí") {
      return { type: "IDLING", severity: "LOW" };
    }
    if (e === "Posición en pánico") {
      return { type: "PANIC_BUTTON", severity: "CRITICAL" };
    }
    // SPEEDING: only "Supero" events. "Debajo" events are pair closures.
    if (/^Supero/i.test(e)) {
      // Severity by threshold:
      //   "Supero 60" → MEDIUM (city limit exceeded)
      //   "Supero 80" → HIGH (highway limit exceeded)
      //   "Supero 90"/"Supero 110" → CRITICAL
      if (/110/.test(e)) {
        return { type: "SPEEDING", severity: "CRITICAL" };
      }
      if (/90/.test(e)) {
        return { type: "SPEEDING", severity: "HIGH" };
      }
      if (/80/.test(e)) {
        return { type: "SPEEDING", severity: "HIGH" };
      }
      if (/60/.test(e)) {
        return { type: "SPEEDING", severity: "MEDIUM" };
      }
      return { type: "SPEEDING", severity: "MEDIUM" };
    }
    // "Debajo NN" closes a SPEEDING window → ignore
    if (/^Debajo/i.test(e)) return null;
    return null;
  }

  // ─── Sensores · puertas, sensores varios ─────────────────────
  if (t === "Sensores") {
    if (e === "Puerta de cabina abierta") {
      // Driver entering/exiting cabin — informational, not security.
      // The driver opens this dozens of times per day (reparto urbano).
      return { type: "DOOR_OPEN", severity: "LOW" };
    }
    if (e === "Puerta de carga abierta") {
      // Cargo door is a real security signal — only opens at
      // authorized stops.
      return { type: "CARGO_DOOR_OPEN", severity: "HIGH" };
    }
    // Cerrada/Habilitación de combustible/ID conductor/Enganche → descartar
    return null;
  }

  // ─── Conducta de manejo · brusquedades ───────────────────────
  if (t === "Conducta de manejo") {
    if (e === "Movimiento brusco") {
      return { type: "HARSH_ACCELERATION", severity: "MEDIUM" };
    }
    if (e === "Frenada brusca") {
      return { type: "HARSH_BRAKING", severity: "MEDIUM" };
    }
    return null;
  }

  // ─── Alarma · genuine alarms ─────────────────────────────────
  if (t === "Alarma") {
    if (e === "Pánico") {
      return { type: "PANIC_BUTTON", severity: "CRITICAL" };
    }
    return null;
  }

  // ─── Batería · battery issues ────────────────────────────────
  if (t === "Batería") {
    if (e === "Batería secundaria baja") {
      return { type: "POWER_DISCONNECT", severity: "HIGH" };
    }
    if (e === "Batería baja") {
      return { type: "POWER_DISCONNECT", severity: "MEDIUM" };
    }
    return null;
  }

  // ─── Equipo · device issues ──────────────────────────────────
  if (t === "Equipo") {
    if (e === "Falla de red") {
      return { type: "GPS_DISCONNECT", severity: "MEDIUM" };
    }
    return null;
  }

  // ─── Sistema, Otros, Viaje, Alta precisión, etc. ─────────────
  // All ignored (login/logout, route management, sensor metadata)
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Parses a Maxtracker timestamp ("YYYY-MM-DD HH:MM:SS") in
 * Argentina local time (UTC-3) and returns a UTC Date.
 */
function parseLocalDate(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m;
  // Argentina is UTC-3 year-round (no DST currently)
  // Convert local time to UTC by adding 3 hours
  const localMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(sec),
  );
  return new Date(localMs + 3 * 60 * 60 * 1000);
}

/**
 * Parses coordinate string like "-33.09975 -68.68637" or
 * "-33.09975, -68.68637" into a {lat, lng} object.
 */
function parseCoords(s: string): { lat: number; lng: number } | null {
  const trimmed = s.replace(/^"|"$/g, "").trim();
  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]!);
  const lng = parseFloat(parts[1]!);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Splits a CSV line by `;`, respecting quoted fields. We don't
 * use a full CSV library to avoid an extra dependency.
 */
function splitSemicolon(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
    } else if (ch === ";" && !inQuotes) {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/**
 * Extract plate from filename pattern:
 *   Historico-<plate>-<dateFrom>-<dateTo>.csv
 */
function plateFromFilename(filename: string): string {
  const m = filename.match(/^Historico-(.+?)-\d{8}-\d{8}\.csv$/);
  return m ? m[1]! : filename;
}

/**
 * Parses a heading string into degrees [0..359]. The Maxtracker
 * CSV exports use 16-point cardinal directions (N, NNE, NE, etc).
 * Numeric inputs are accepted as a fallback.
 *
 * 0° = North, 90° = East, 180° = South, 270° = West
 */
function parseHeading(raw: string): number {
  const s = raw.trim().toUpperCase();
  if (!s) return 0;
  // Numeric fallback (some sources export degrees directly)
  const asNum = parseFloat(s);
  if (Number.isFinite(asNum) && /^\d/.test(s)) {
    return ((Math.round(asNum) % 360) + 360) % 360;
  }
  const map: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
    // Spanish abbreviations (used by Maxtracker CSVs)
    NNO: 337.5,
    NO: 315,
    ONO: 292.5,
    O: 270, // Oeste
    OSO: 247.5,
    SO: 225,
    SSO: 202.5,
  };
  const deg = map[s];
  if (deg !== undefined) return Math.round(deg);
  return 0;
}

// ═══════════════════════════════════════════════════════════════
//  Main parser
// ═══════════════════════════════════════════════════════════════

export function parseRealCsv(filepath: string): ParsedCsv {
  const raw = readFileSync(filepath, "utf-8");
  // Strip BOM if present
  const content = raw.replace(/^\uFEFF/, "");
  const lines = content.split(/\r?\n/);

  const positions: ParsedPosition[] = [];
  const events: ParsedEvent[] = [];
  let interno = "";

  // Find header row (skip BOM-only line + sep=; line)
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith("Interno;")) {
      dataStart = i + 1;
      break;
    }
  }

  // Parse data rows
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;

    const fields = splitSemicolon(line);
    if (fields.length < 18) continue;

    const internoRaw = fields[0]!.replace(/^"|"$/g, "").trim();
    if (!interno) interno = internoRaw;

    const fechaStr = fields[1]!.replace(/^"|"$/g, "").trim();
    const comunicacionStr = fields[2]!.replace(/^"|"$/g, "").trim();
    const velocidadStr = fields[4]!.replace(/^"|"$/g, "").trim();
    const evento = fields[5]!;
    const tipo = fields[6]!;
    const rumboStr = fields[15]!.replace(/^"|"$/g, "").trim();
    const coordenadas = fields[17]!;

    const recordedAt = parseLocalDate(fechaStr);
    const receivedAt = parseLocalDate(comunicacionStr) ?? recordedAt;
    const coords = parseCoords(coordenadas);

    if (!recordedAt || !receivedAt || !coords) continue;

    const speedKmh = parseFloat(velocidadStr) || 0;
    const heading = parseHeading(rumboStr);
    const ignition = speedKmh > 0;

    // ── Add as Position ────────────────────────────────────────
    // Only rows with type=Posición create a Position (the actual
    // GPS readings). Other rows are events at a known location
    // but they're side-products of the same telemetry frame.
    const tipoClean = tipo.replace(/^"|"$/g, "").trim();
    if (tipoClean === "Posición") {
      positions.push({
        recordedAt,
        receivedAt,
        lat: coords.lat,
        lng: coords.lng,
        speedKmh,
        heading,
        ignition,
      });
    }

    // ── Map to Event if applicable ─────────────────────────────
    const mapping = mapEvent(tipo, evento, speedKmh);
    if (mapping) {
      events.push({
        occurredAt: recordedAt,
        type: mapping.type,
        severity: mapping.severity,
        lat: coords.lat,
        lng: coords.lng,
        speedKmh,
        metadata: JSON.stringify({
          source: "real-csv",
          original: { tipo: tipoClean, evento: evento.replace(/^"|"$/g, "").trim() },
        }),
      });
    }
  }

  // ── Dedup repeated events within time windows ────────────────
  // Some events fire repeatedly during the same "incident":
  //   · SPEEDING fires for every "Supero NN" message (sometimes
  //     dozens during one stretch of fast driving)
  //   · DOOR_OPEN can repeat if door cycles
  //   · GPS_DISCONNECT, POWER_DISCONNECT can repeat
  // We collapse these into one event per (assetId, type, window).
  const DEDUP_WINDOWS_MS: Partial<Record<EventType, number>> = {
    PANIC_BUTTON: 5 * 60 * 1000,
    SPEEDING: 5 * 60 * 1000,
    DOOR_OPEN: 2 * 60 * 1000,
    SIDE_DOOR_OPEN: 2 * 60 * 1000,
    CARGO_DOOR_OPEN: 2 * 60 * 1000,
    GPS_DISCONNECT: 5 * 60 * 1000,
    POWER_DISCONNECT: 10 * 60 * 1000,
    JAMMING_DETECTED: 5 * 60 * 1000,
    IDLING: 10 * 60 * 1000,
    IGNITION_ON: 30 * 1000,
    IGNITION_OFF: 30 * 1000,
  };

  const eventsByType: Record<string, ParsedEvent[]> = {};
  for (const ev of events) {
    eventsByType[ev.type] ??= [];
    eventsByType[ev.type]!.push(ev);
  }

  const dedupedEvents: ParsedEvent[] = [];
  for (const [type, list] of Object.entries(eventsByType)) {
    const window = DEDUP_WINDOWS_MS[type as EventType];
    if (!window) {
      // No dedup for this type
      dedupedEvents.push(...list);
      continue;
    }
    // Dedup within window per type. For SPEEDING, we also keep
    // the highest severity within each window.
    list.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    let last: ParsedEvent | null = null;
    const SEVERITY_ORDER: Record<Severity, number> = {
      LOW: 0,
      MEDIUM: 1,
      HIGH: 2,
      CRITICAL: 3,
    };
    for (const ev of list) {
      if (
        !last ||
        ev.occurredAt.getTime() - last.occurredAt.getTime() > window
      ) {
        dedupedEvents.push(ev);
        last = ev;
      } else {
        // Within window — upgrade last's severity if this one
        // is more severe (e.g. went from "Supero 80" to "Supero 110")
        const evRank = SEVERITY_ORDER[ev.severity as Severity] ?? 0;
        const lastRank = SEVERITY_ORDER[last.severity as Severity] ?? 0;
        if (evRank > lastRank) {
          last.severity = ev.severity;
        }
      }
    }
  }

  const finalEvents = dedupedEvents.sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  // ── Sort positions chronologically ───────────────────────────
  positions.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  const filename = filepath.split("/").pop() ?? filepath;
  const plate = plateFromFilename(filename);

  return {
    filename,
    interno,
    plate,
    positions,
    events: finalEvents,
    startAt: positions[0]?.recordedAt ?? null,
    endAt: positions[positions.length - 1]?.recordedAt ?? null,
  };
}
