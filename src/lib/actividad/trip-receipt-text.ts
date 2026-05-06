// ═══════════════════════════════════════════════════════════════
//  Actividad · helpers de presentación de viajes (Trip)
//  ─────────────────────────────────────────────────────────────
//  Funciones puras para el recibo PDF de viaje (S5-T4) · análogo
//  a /lib/conduccion/receipt-text.ts.
//
//    · tripNarrativeLead  · arma 1-2 oraciones tipo periodísticas
//                            describiendo el viaje
//    · tripReceiptFolio   · identificador legible del documento
//                            VIA-{plate}-{YYYYMMDD}-{HHMM}
//    · tripUniqueIdentifier · ID completo para footer (cuid corto)
// ═══════════════════════════════════════════════════════════════

interface NarrativeInput {
  driverName: string | null;
  assetName: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  startAddress: string | null;
  endAddress: string | null;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  eventCount: number;
  highSeverityEventCount: number;
}

/**
 * Lead narrativo · 1-2 oraciones periodísticas sobre el viaje.
 * Adapta el texto según haya conductor, eventos críticos, o sea
 * un viaje "limpio".
 */
export function tripNarrativeLead(input: NarrativeInput): string {
  const subject = input.driverName
    ? `${input.driverName} (${input.assetName})`
    : input.assetName;

  const distance =
    input.distanceKm < 1
      ? `${Math.round(input.distanceKm * 1000)} m`
      : input.distanceKm < 100
        ? `${input.distanceKm.toFixed(1)} km`
        : `${Math.round(input.distanceKm)} km`;

  const duration = formatDurationLong(input.durationMs);
  const startTime = formatTimeShort(input.startedAt);
  const endTime = formatTimeShort(input.endedAt);

  const action = input.driverName ? "condujo" : "registró un viaje de";

  let lead = `${subject} ${action} ${distance} en ${duration}, ${
    input.driverName ? "" : ""
  }entre las ${startTime} y las ${endTime} ART.`;

  // Velocidad máxima destacable (>100 km/h)
  if (input.maxSpeedKmh >= 100) {
    lead += ` Alcanzó un pico de ${Math.round(input.maxSpeedKmh)} km/h durante el trayecto.`;
  }

  // Eventos críticos
  if (input.highSeverityEventCount > 0) {
    const word =
      input.highSeverityEventCount === 1
        ? "un evento crítico"
        : `${input.highSeverityEventCount} eventos críticos`;
    lead += ` Se registraron ${word} durante el viaje.`;
  } else if (input.eventCount > 0) {
    const word =
      input.eventCount === 1
        ? "un evento de conducción"
        : `${input.eventCount} eventos de conducción`;
    lead += ` Se registraron ${word}.`;
  } else {
    lead += " Sin eventos de conducción registrados.";
  }

  return lead;
}

/**
 * Folio legible para el documento.
 * Formato: VIA-{PLATE}-{YYYYMMDD}-{HHMM}
 * Si no hay plate, usa los últimos 5 chars del assetId.
 */
export function tripReceiptFolio(input: {
  assetPlate: string | null;
  assetId: string;
  startedAt: Date;
}): string {
  const plate = input.assetPlate?.replace(/\s/g, "") ??
    input.assetId.slice(-5).toUpperCase();
  const d = input.startedAt;
  const yyyymmdd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  // Hora local Argentina (UTC-3)
  const localHours = d.getUTCHours() - 3 < 0 ? d.getUTCHours() + 21 : d.getUTCHours() - 3;
  const hhmm = `${String(localHours).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `VIA-${plate}-${yyyymmdd}-${hhmm}`;
}

/**
 * Identificador único completo · footer del documento.
 * Combina folio legible + sufijo único del cuid del trip (8 chars).
 */
export function tripUniqueIdentifier(input: {
  assetPlate: string | null;
  assetId: string;
  startedAt: Date;
  tripId: string;
}): string {
  const folio = tripReceiptFolio({
    assetPlate: input.assetPlate,
    assetId: input.assetId,
    startedAt: input.startedAt,
  });
  const suffix = input.tripId.slice(-8).toUpperCase();
  return `${folio}-${suffix}`;
}

// ─── Helpers internos ──────────────────────────────────────────

function formatDurationLong(ms: number): string {
  if (ms <= 0) return "0 minutos";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) {
    return m === 1 ? "1 minuto" : `${m} minutos`;
  }
  if (m === 0) {
    return h === 1 ? "1 hora" : `${h} horas`;
  }
  const hWord = h === 1 ? "hora" : "horas";
  const mWord = m === 1 ? "minuto" : "minutos";
  return `${h} ${hWord} ${m} ${mWord}`;
}

function formatTimeShort(d: Date): string {
  // Hora local Argentina · UTC-3
  return d.toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}
