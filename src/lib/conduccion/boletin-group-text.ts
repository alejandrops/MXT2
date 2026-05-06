// ═══════════════════════════════════════════════════════════════
//  Boletín de grupo · helpers de texto · S5-E2
//  ─────────────────────────────────────────────────────────────
//  Análogo a boletin-driver-text pero a nivel grupo.
//  Reusa los exports comunes de boletin-driver-text:
//    · ParsedPeriod, parsePeriod
//    · scoreZone, scoreZoneLabel
// ═══════════════════════════════════════════════════════════════

import type { ParsedPeriod } from "@/lib/conduccion/boletin-driver-text";
import { scoreZone } from "@/lib/conduccion/boletin-driver-text";

// ── Folio · BLT-G{shortName}-{period} ────────────────────

export function groupBoletinFolio(args: {
  groupName: string;
  groupIdShort: string;
  period: ParsedPeriod;
}): string {
  const slug = args.groupName
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  const initials = `${slug || "GRP"}${args.groupIdShort.slice(0, 2)}`;
  return `BLT-G${initials}-${args.period.compact}`;
}

// ── Lead narrativo · 1-2 oraciones ──────────────────────

interface GroupLeadInput {
  groupName: string;
  period: ParsedPeriod;
  distanceKm: number;
  tripCount: number;
  activeDrivers: number;
  activeAssets: number;
  infractionCount: number;
  leveCount: number;
  mediaCount: number;
  graveCount: number;
  score: number;
  prevScore: number | null;
  monthsInGreen?: number;
  totalMonths?: number;
}

export function groupBoletinLead(input: GroupLeadInput): string {
  const {
    groupName,
    period,
    distanceKm,
    tripCount,
    activeDrivers,
    activeAssets,
    infractionCount,
    leveCount,
    mediaCount,
    graveCount,
    score,
    prevScore,
    monthsInGreen,
    totalMonths,
  } = input;

  const km = formatKm(distanceKm);
  const periodWhen =
    period.kind === "monthly"
      ? `durante ${period.label.toLowerCase()}`
      : `a lo largo de ${period.label.toLowerCase()}`;

  const driversPart =
    activeDrivers === 1
      ? "1 conductor activo"
      : `${activeDrivers} conductores activos`;
  const assetsPart =
    activeAssets === 1
      ? "1 vehículo"
      : `${activeAssets} vehículos`;

  const infractionPart =
    infractionCount === 0
      ? "sin infracciones de velocidad,"
      : `con ${infractionCount} ${infractionCount === 1 ? "infracción" : "infracciones"} de velocidad — ${leveCount} ${leveCount === 1 ? "leve" : "leves"}, ${mediaCount} ${mediaCount === 1 ? "media" : "medias"} y ${graveCount} ${graveCount === 1 ? "grave" : "graves"} —,`;

  const zone = scoreZone(score);
  const zoneText =
    zone === "green"
      ? "dentro de la zona verde"
      : zone === "yellow"
        ? "dentro de la zona amarilla"
        : "dentro de la zona roja";

  let prevPart = "";
  if (prevScore !== null) {
    const delta = score - prevScore;
    if (delta > 0)
      prevPart = `${delta} ${delta === 1 ? "punto" : "puntos"} por encima del período anterior (${prevScore})`;
    else if (delta < 0)
      prevPart = `${-delta} ${-delta === 1 ? "punto" : "puntos"} por debajo del período anterior (${prevScore})`;
    else prevPart = "manteniendo el mismo nivel del período anterior";
  }

  if (period.kind === "monthly") {
    const opener = `${groupName} acumuló ${km} km en ${tripCount} viajes ${periodWhen} con ${driversPart} y ${assetsPart} en operación`;
    const scoreSentence = prevPart
      ? `lo que deriva en una calificación grupal de ${score} sobre 100, ${prevPart} y ${zoneText}.`
      : `lo que deriva en una calificación grupal de ${score} sobre 100, ${zoneText}.`;
    return `${opener}, ${infractionPart} ${scoreSentence}`;
  }

  // Anual
  const opener = `${groupName} acumuló ${km} km en ${tripCount} viajes ${periodWhen} con ${driversPart}`;
  let scoreSentence = `Su calificación promedio anual fue de ${score} sobre 100`;
  if (prevPart) scoreSentence += `, ${prevPart}`;
  if (monthsInGreen !== undefined && totalMonths !== undefined) {
    scoreSentence += `, manteniéndose en zona verde ${monthsInGreen} de los ${totalMonths} meses`;
  }
  scoreSentence += ".";
  return `${opener}, ${infractionPart} ${scoreSentence}`;
}

function formatKm(n: number): string {
  return Math.round(n).toLocaleString("es-AR").replace(/,/g, "\u00A0");
}
