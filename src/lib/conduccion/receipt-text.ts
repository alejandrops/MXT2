// ═══════════════════════════════════════════════════════════════
//  Conducción · helpers de presentación de infracciones
//  ─────────────────────────────────────────────────────────────
//  Funciones puras, no necesitan DB. Producen texto humano para
//  el recibo PDF (S4-L3d) y el boletín (post-MVP).
//
//    · narrativeLead      · arma el párrafo de "noticia" sobre
//                            la infracción · 1 oración
//    · receiptFolio       · identificador legible del documento
//                            INF-{plate}-{YYYYMMDD}-{HHMM}
//    · uniqueIdentifier   · ID completo (corta el cuid del DB
//                            a sus últimos 8 chars)
// ═══════════════════════════════════════════════════════════════

interface NarrativeInput {
  driverName: string | null;
  assetName: string;
  assetPlate: string | null;
  startedAt: Date;
  durationSec: number;
  vmaxKmh: number;
  peakSpeedKmh: number;
  maxExcessKmh: number;
  startAddress: string | null;
  startLat: number;
  startLon: number;
}

/// Lead narrativo · 1 oración periodística sobre la infracción.
/// Genérica pero adaptativa al contexto (con/sin conductor,
/// con/sin dirección reverse-geocoded).
export function narrativeLead(infr: NarrativeInput): string {
  const subject = infr.driverName
    ? infr.driverName
    : `el vehículo ${infr.assetPlate ?? infr.assetName}`;

  const duration = formatDurationProse(infr.durationSec);

  const place = infr.startAddress
    ? infr.startAddress
    : `el punto ${formatLatLon(infr.startLat, infr.startLon)}`;

  return `${subject} superó en +${Math.round(
    infr.maxExcessKmh,
  )} km/h el límite durante ${duration} sobre ${place}, alcanzando ${Math.round(
    infr.peakSpeedKmh,
  )} km/h en zona de ${infr.vmaxKmh}.`;
}

/// Folio del recibo · forma legible para humanos (impreso en la
/// cabecera del documento). NO es el ID único de DB · es solo
/// para que un operador pueda referirse al recibo en una
/// conversación o ticket.
export function receiptFolio(input: {
  assetPlate: string | null;
  assetId: string;
  startedAt: Date;
}): string {
  const plate = input.assetPlate ?? input.assetId.slice(-6).toUpperCase();
  const d = input.startedAt;
  const yyyymmdd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}${String(d.getUTCDate()).padStart(2, "0")}`;
  // Hora local Argentina (UTC-3)
  const localMs = d.getTime() - 3 * 3600 * 1000;
  const local = new Date(localMs);
  const hhmm = `${String(local.getUTCHours()).padStart(2, "0")}${String(
    local.getUTCMinutes(),
  ).padStart(2, "0")}`;
  return `INF-${plate}-${yyyymmdd}-${hhmm}`;
}

/// Identificador único · combina folio + sufijo del cuid de DB.
/// Cualquier infracción es ubicable inequívocamente con esto.
export function uniqueIdentifier(input: {
  assetPlate: string | null;
  assetId: string;
  startedAt: Date;
  infractionId: string;
}): string {
  return `${receiptFolio(input)}-${input.infractionId.slice(-8).toUpperCase()}`;
}

// ───────────────────────────────────────────────────────────────
//  Helpers internos
// ───────────────────────────────────────────────────────────────

function formatDurationProse(sec: number): string {
  if (sec < 60) return `${sec} segundos`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) {
    return m === 1 ? "1 minuto" : `${m} minutos`;
  }
  const minWord = m === 1 ? "minuto" : "minutos";
  const secWord = s === 1 ? "segundo" : "segundos";
  return `${m} ${minWord} ${s} ${secWord}`;
}

function formatLatLon(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
