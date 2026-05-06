// ═══════════════════════════════════════════════════════════════
//  Boletín de conductor · helpers de texto · S5-E1
//  ─────────────────────────────────────────────────────────────
//  Funciones puras que generan texto editorial para el boletín:
//    · boletinNarrativeLead  · 1-2 oraciones de lead
//    · boletinFolio          · BLT-{plate}-{period}
//    · boletinUniqueId       · 8 chars del cuid (referencia interna)
//    · parsePeriod           · valida y discrimina mensual vs anual
//    · scoreZone             · "verde" | "amarilla" | "roja"
//    · scoreZoneLabel        · texto para subtítulo
//    · monthLabelEs          · "Mayo 2026" / "Enero 2025"
//    · yearLabel             · "Año 2025"
// ═══════════════════════════════════════════════════════════════

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Parsing y validación de período ─────────────────────────

const RX_MONTHLY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const RX_ANNUAL = /^(\d{4})$/;

export type PeriodKind = "monthly" | "annual";

export interface ParsedPeriod {
  kind: PeriodKind;
  year: number;
  month: number | null; // 1-12 si mensual, null si anual
  label: string; // "Mayo 2026" o "Año 2025"
  /** Folio-friendly · "202605" o "2025" */
  compact: string;
  /** Período anterior comparable · ej. "2026-04" o "2024" */
  previous: string;
}

/**
 * Parsea un string de período · soporta:
 *   · "YYYY-MM" → mensual
 *   · "YYYY"    → anual
 * Retorna null si formato inválido.
 */
export function parsePeriod(raw: string): ParsedPeriod | null {
  const monthly = raw.match(RX_MONTHLY);
  if (monthly && monthly[1] && monthly[2]) {
    const year = parseInt(monthly[1], 10);
    const month = parseInt(monthly[2], 10);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return {
      kind: "monthly",
      year,
      month,
      label: `${MONTHS_ES[month - 1]} ${year}`,
      compact: `${year}${String(month).padStart(2, "0")}`,
      previous: `${prevYear}-${String(prevMonth).padStart(2, "0")}`,
    };
  }
  const annual = raw.match(RX_ANNUAL);
  if (annual && annual[1]) {
    const year = parseInt(annual[1], 10);
    return {
      kind: "annual",
      year,
      month: null,
      label: `Año ${year}`,
      compact: String(year),
      previous: String(year - 1),
    };
  }
  return null;
}

// ── Folio · BLT-{plateOrId}-{period} ────────────────────────

/**
 * Folio human-readable del boletín.
 *
 *   Mensual · BLT-{firstName3}{lastName3}{driverNumber}-{YYYYMM}
 *   Anual   · BLT-{firstName3}{lastName3}{driverNumber}-{YYYY}
 *
 * Si el driver no tiene un número/short-id, se usan los últimos
 * 4 chars del cuid.
 */
export function boletinFolio(args: {
  driverFirstName: string;
  driverLastName: string;
  driverIdShort: string;
  period: ParsedPeriod;
}): string {
  const fn = (args.driverFirstName ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  const ln = (args.driverLastName ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  const num = args.driverIdShort.slice(0, 2);
  const initials = `${fn}${ln}${num}` || "DRV";
  return `BLT-${initials}-${args.period.compact}`;
}

/**
 * ID interno del boletín · primeros 8 chars del cuid del driver.
 * Útil como referencia de auditoría pero NO se imprime junto al
 * folio para evitar redundancia (lección Tufte v2).
 */
export function boletinUniqueId(driverId: string): string {
  return driverId.slice(0, 8);
}

// ── Bandas del score ────────────────────────────────────────

export type ScoreZone = "green" | "yellow" | "red";

export function scoreZone(score: number): ScoreZone {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

export function scoreZoneLabel(zone: ScoreZone): string {
  if (zone === "green") return "zona verde (≥80)";
  if (zone === "yellow") return "zona amarilla (60–80)";
  return "zona roja (<60)";
}

// ── Lead narrativo ──────────────────────────────────────────

interface LeadInput {
  driverFirstName: string;
  period: ParsedPeriod;
  distanceKm: number;
  tripCount: number;
  infractionCount: number;
  leveCount: number;
  mediaCount: number;
  graveCount: number;
  score: number;
  prevScore: number | null;
  monthsInGreen?: number; // solo anual
  totalMonths?: number; // solo anual
}

/**
 * Lead narrativo · 1-2 oraciones de "noticia" sobre el período.
 * Adapta tono según mensual/anual y según mejora/empeora.
 *
 * Ejemplo mensual:
 *   "Marcos condujo 18 420 km en 73 viajes durante mayo de 2026,
 *    registrando 12 infracciones de velocidad — 5 leves, 4 medias
 *    y 3 graves —, lo que deriva en una calificación de seguridad
 *    de 78 sobre 100, dos puntos por debajo de abril (80) y dentro
 *    de la zona amarilla."
 */
export function boletinNarrativeLead(input: LeadInput): string {
  const {
    driverFirstName,
    period,
    distanceKm,
    tripCount,
    infractionCount,
    leveCount,
    mediaCount,
    graveCount,
    score,
    prevScore,
    monthsInGreen,
    totalMonths,
  } = input;

  const fn = driverFirstName || "El conductor";
  const km = formatKm(distanceKm);
  const periodWhen =
    period.kind === "monthly"
      ? `durante ${period.label.toLowerCase()}`
      : `a lo largo de ${period.label.toLowerCase()}`;

  // Distribución de infracciones · solo si hay alguna
  const infractionPart =
    infractionCount === 0
      ? "sin registrar infracciones de velocidad,"
      : `registrando ${infractionCount} ${infractionCount === 1 ? "infracción" : "infracciones"} de velocidad — ${leveCount} ${leveCount === 1 ? "leve" : "leves"}, ${mediaCount} ${mediaCount === 1 ? "media" : "medias"} y ${graveCount} ${graveCount === 1 ? "grave" : "graves"} —,`;

  // Score y zona
  const zone = scoreZone(score);
  const zoneText =
    zone === "green"
      ? "dentro de la zona verde"
      : zone === "yellow"
        ? "dentro de la zona amarilla"
        : "dentro de la zona roja";

  // Comparativa con período anterior
  let prevPart = "";
  if (prevScore !== null) {
    const delta = score - prevScore;
    if (delta > 0) {
      prevPart = `${describeNumber(delta)} ${delta === 1 ? "punto" : "puntos"} por encima del período anterior (${prevScore})`;
    } else if (delta < 0) {
      prevPart = `${describeNumber(-delta)} ${-delta === 1 ? "punto" : "puntos"} por debajo del período anterior (${prevScore})`;
    } else {
      prevPart = "manteniendo el mismo nivel del período anterior";
    }
  }

  // Sección final que concatena todo
  if (period.kind === "monthly") {
    const tripsPart = `${fn} condujo ${km} km en ${tripCount} ${tripCount === 1 ? "viaje" : "viajes"} ${periodWhen}`;
    const scoreSentence = prevPart
      ? `lo que deriva en una calificación de seguridad de ${score} sobre 100, ${prevPart} y ${zoneText}.`
      : `lo que deriva en una calificación de seguridad de ${score} sobre 100, ${zoneText}.`;
    return `${tripsPart}, ${infractionPart} ${scoreSentence}`;
  }

  // Anual
  const tripsPart = `${fn} condujo ${km} km en ${tripCount} viajes ${periodWhen}`;
  let scoreSentence = `Su calificación promedio anual fue de ${score} sobre 100`;
  if (prevPart) scoreSentence += `, ${prevPart}`;
  if (monthsInGreen !== undefined && totalMonths !== undefined) {
    scoreSentence += `, manteniéndose en zona verde ${monthsInGreen} de los ${totalMonths} meses`;
  }
  scoreSentence += ".";
  return `${tripsPart}, ${infractionPart} ${scoreSentence}`;
}

// ── Utils ───────────────────────────────────────────────────

function formatKm(n: number): string {
  return Math.round(n).toLocaleString("es-AR").replace(/,/g, "\u00A0");
}

function describeNumber(n: number): string {
  if (n === 1) return "uno";
  if (n === 2) return "dos";
  if (n === 3) return "tres";
  if (n === 4) return "cuatro";
  if (n === 5) return "cinco";
  return String(n);
}
