// ═══════════════════════════════════════════════════════════════
//  Boletín de empresa · helpers de texto · S5-E3
//  ─────────────────────────────────────────────────────────────
//  Reusa ParsedPeriod y scoreZone de boletin-driver-text.
// ═══════════════════════════════════════════════════════════════

import type { ParsedPeriod } from "@/lib/conduccion/boletin-driver-text";
import { scoreZone } from "@/lib/conduccion/boletin-driver-text";

// ── Folio ───────────────────────────────────────────────

export function accountBoletinFolio(args: {
  accountName: string;
  accountIdShort: string;
  period: ParsedPeriod;
}): string {
  const slug = args.accountName
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  const initials = `${slug || "EMP"}${args.accountIdShort.slice(0, 2)}`;
  return `BLT-E${initials}-${args.period.compact}`;
}

// ── Lead narrativo ──────────────────────────────────────

interface AccountLeadInput {
  accountName: string;
  period: ParsedPeriod;
  distanceKm: number;
  tripCount: number;
  activeDrivers: number;
  activeAssets: number;
  activeGroups: number;
  totalGroups: number;
  infractionCount: number;
  leveCount: number;
  mediaCount: number;
  graveCount: number;
  score: number;
  prevScore: number | null;
  monthsInGreen?: number;
  totalMonths?: number;
}

export function accountBoletinLead(input: AccountLeadInput): string {
  const {
    accountName,
    period,
    distanceKm,
    tripCount,
    activeDrivers,
    activeAssets,
    activeGroups,
    totalGroups,
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
    activeDrivers === 1 ? "1 conductor activo" : `${activeDrivers} conductores activos`;
  const assetsPart =
    activeAssets === 1 ? "1 vehículo" : `${activeAssets} vehículos`;
  const groupsPart =
    totalGroups === activeGroups
      ? `${activeGroups} ${activeGroups === 1 ? "grupo" : "grupos"}`
      : `${activeGroups} de ${totalGroups} grupos`;

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
    const opener = `${accountName} acumuló ${km} km en ${tripCount} viajes ${periodWhen} con ${driversPart} y ${assetsPart} en operación a lo largo de ${groupsPart}`;
    const scoreSentence = prevPart
      ? `lo que deriva en una calificación corporativa de ${score} sobre 100, ${prevPart} y ${zoneText}.`
      : `lo que deriva en una calificación corporativa de ${score} sobre 100, ${zoneText}.`;
    return `${opener}, ${infractionPart} ${scoreSentence}`;
  }

  const opener = `${accountName} acumuló ${km} km en ${tripCount} viajes ${periodWhen} con ${driversPart} a lo largo de ${groupsPart}`;
  let scoreSentence = `Su calificación corporativa promedio anual fue de ${score} sobre 100`;
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
