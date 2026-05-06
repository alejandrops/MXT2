// @ts-nocheck · pre-existing patterns (Prisma types stale)
// ═══════════════════════════════════════════════════════════════
//  getGroupBoletinData · S5-E2
//  ─────────────────────────────────────────────────────────────
//  Query agregadora para boletín de grupo · mensual o anual.
//  Análoga a getDriverBoletinData pero a nivel grupo.
//
//  Score del grupo · promedio ponderado por km de los scores
//  individuales de los drivers que manejaron assets del grupo
//  en el período.
//
//  Output:
//    · KPIs del grupo (km · viajes · en ruta · drivers/assets activos)
//    · Score promedio + zona
//    · Distribución de infracciones agregada
//    · Top 5 mejores y bottom 5 peores conductores (por score)
//    · Scatter · puntos (km, score) por conductor para SVG
//    · Evolución temporal (4 semanas mensual · 12 meses anual)
//    · Comparativa con período anterior
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { ParsedPeriod } from "@/lib/conduccion/boletin-driver-text";

const SCORE_MULTIPLIER = 10;

export interface GroupBoletinData {
  group: {
    id: string;
    name: string;
    accountName: string;
    parentName: string | null;
    /** ID corto · 4 chars del cuid · para folio */
    idShort: string;
    /** Cantidad total de vehículos asignados al grupo */
    totalAssets: number;
  };

  summary: {
    distanceKm: number;
    tripCount: number;
    activeMin: number;
    /** Score promedio ponderado por km · 0-100 */
    score: number;
    /** Drivers que tuvieron actividad en el período */
    activeDrivers: number;
    /** Assets que tuvieron actividad en el período */
    activeAssets: number;
  };

  prev: {
    score: number | null;
    distanceKm: number | null;
    tripCount: number | null;
    activeDrivers: number | null;
    infractionCount: number | null;
  };

  infractions: {
    total: number;
    leve: number;
    media: number;
    grave: number;
    /** infracciones / 100 km · útil para comparar grupos de tamaño distinto */
    per100km: number;
  };

  // Top y bottom 5 conductores · útil para boletín ejecutivo
  topDrivers: Array<DriverRanking>;
  bottomDrivers: Array<DriverRanking>;

  // Scatter · todos los drivers del período
  scatter: Array<{
    personId: string;
    name: string;
    distanceKm: number;
    score: number;
    infractionCount: number;
  }>;

  // Evolución · misma forma que driver
  evolution: {
    scoreSeries: number[];
    distanceSeries: number[];
    labels: string[];
  };

  monthsInGreen: number | null;
}

interface DriverRanking {
  personId: string;
  name: string;
  distanceKm: number;
  tripCount: number;
  score: number;
  infractionCount: number;
}

export async function getGroupBoletinData(args: {
  groupId: string;
  period: ParsedPeriod;
  accountId: string | null;
}): Promise<GroupBoletinData | null> {
  const { groupId, period, accountId } = args;

  // ── 1. Group ────────────────────────────────────────
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      accountId: true,
      account: { select: { name: true } },
      parent: { select: { name: true } },
      assets: { select: { id: true } },
    },
  });
  if (!group) return null;
  if (accountId !== null && group.accountId !== accountId) return null;

  const assetIds = group.assets.map((a: any) => a.id);
  if (assetIds.length === 0) {
    return emptyGroupBoletin(group, period);
  }

  // ── 2. Períodos ──────────────────────────────────────
  const { start, end } = periodToDateRange(period);
  const prevPeriod = getPreviousPeriod(period);
  const prev = periodToDateRange(prevPeriod);

  // ── 3. Días de drivers en assets del grupo ──────────
  const [days, prevDays, infractions, prevInfractions] = await Promise.all([
    db.assetDriverDay.findMany({
      where: {
        assetId: { in: assetIds },
        day: { gte: start, lt: end },
        personId: { not: null },
      },
      select: {
        personId: true,
        assetId: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
        day: true,
        person: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
    db.assetDriverDay.findMany({
      where: {
        assetId: { in: assetIds },
        day: { gte: prev.start, lt: prev.end },
        personId: { not: null },
      },
      select: {
        personId: true,
        distanceKm: true,
        tripCount: true,
        activeMin: true,
      },
    }),
    db.infraction.findMany({
      where: {
        assetId: { in: assetIds },
        startedAt: { gte: start, lt: end },
      },
      select: {
        startedAt: true,
        severity: true,
        distanceMeters: true,
        driverId: true,
      },
    }),
    db.infraction.count({
      where: {
        assetId: { in: assetIds },
        startedAt: { gte: prev.start, lt: prev.end },
      },
    }),
  ]);

  // ── 4. Agregaciones del grupo ───────────────────────
  const distanceKm = round1(days.reduce((acc, d) => acc + d.distanceKm, 0));
  const activeMin = days.reduce((acc, d) => acc + d.activeMin, 0);
  const tripCount = days.reduce((acc, d) => acc + d.tripCount, 0);
  const uniqueDrivers = new Set(days.map((d) => d.personId).filter(Boolean));
  const uniqueAssets = new Set(days.map((d) => d.assetId));

  // Score del grupo · promedio ponderado por km
  // primero calcular score individual de cada driver
  const driverAgg = new Map<
    string,
    {
      personId: string;
      name: string;
      distanceKm: number;
      tripCount: number;
      excessKm: number;
      infractionCount: number;
    }
  >();

  for (const d of days) {
    if (!d.personId) continue;
    const existing = driverAgg.get(d.personId);
    if (existing) {
      existing.distanceKm += d.distanceKm;
      existing.tripCount += d.tripCount;
    } else {
      driverAgg.set(d.personId, {
        personId: d.personId,
        name: d.person
          ? `${d.person.firstName ?? ""} ${d.person.lastName ?? ""}`.trim() ||
            "—"
          : "—",
        distanceKm: d.distanceKm,
        tripCount: d.tripCount,
        excessKm: 0,
        infractionCount: 0,
      });
    }
  }

  for (const i of infractions) {
    if (!i.driverId) continue;
    const dr = driverAgg.get(i.driverId);
    if (dr) {
      dr.excessKm += i.distanceMeters / 1000;
      dr.infractionCount += 1;
    }
  }

  // Calcular score por driver
  const driverScores = Array.from(driverAgg.values()).map((d) => ({
    personId: d.personId,
    name: d.name,
    distanceKm: round1(d.distanceKm),
    tripCount: d.tripCount,
    score: computeScore(d.distanceKm, d.excessKm),
    infractionCount: d.infractionCount,
  }));

  // Score grupo · promedio ponderado por km
  const totalKm = driverScores.reduce((a, b) => a + b.distanceKm, 0);
  const weightedScore =
    totalKm > 0
      ? driverScores.reduce(
          (acc, d) => acc + d.score * (d.distanceKm / totalKm),
          0,
        )
      : 100;
  const score = Math.round(weightedScore);

  // ── 5. Comparativa prev ─────────────────────────────
  const prevDistanceKm = round1(
    prevDays.reduce((acc, d) => acc + d.distanceKm, 0),
  );
  const prevTripCount = prevDays.reduce((acc, d) => acc + d.tripCount, 0);
  const prevUniqueDrivers = new Set(
    prevDays.map((d) => d.personId).filter(Boolean),
  ).size;

  // Score del prev · agregar excessKm prev
  const prevExcessAgg = await db.infraction.aggregate({
    where: {
      assetId: { in: assetIds },
      startedAt: { gte: prev.start, lt: prev.end },
    },
    _sum: { distanceMeters: true },
  });
  const prevExcessKm = (prevExcessAgg._sum.distanceMeters ?? 0) / 1000;
  const prevScore =
    prevDistanceKm > 0 ? computeScore(prevDistanceKm, prevExcessKm) : null;

  // ── 6. Distribución infracciones ────────────────────
  let leve = 0,
    media = 0,
    grave = 0;
  for (const i of infractions) {
    if (i.severity === "LEVE") leve++;
    else if (i.severity === "MEDIA") media++;
    else if (i.severity === "GRAVE") grave++;
  }
  const per100km =
    distanceKm > 0
      ? Math.round((infractions.length / distanceKm) * 100 * 10) / 10
      : 0;

  // ── 7. Top y bottom drivers ─────────────────────────
  const sortedByScore = [...driverScores].sort((a, b) => b.score - a.score);
  const topDrivers = sortedByScore.slice(0, 5);
  const bottomDrivers = [...sortedByScore].reverse().slice(0, 5);

  // ── 8. Evolución ────────────────────────────────────
  let evolution: GroupBoletinData["evolution"];
  let monthsInGreen: number | null = null;

  if (period.kind === "monthly") {
    const weeks = bucketByWeek(start, end, days, infractions);
    evolution = {
      scoreSeries: weeks.map((w) => w.score),
      distanceSeries: weeks.map((w) => w.distanceKm),
      labels: ["S1", "S2", "S3", "S4", "S5"].slice(0, weeks.length),
    };
  } else {
    const months = bucketByMonth(period.year, days, infractions);
    evolution = {
      scoreSeries: months.map((m) => m.score),
      distanceSeries: months.map((m) => m.distanceKm),
      labels: [
        "ene", "feb", "mar", "abr", "may", "jun",
        "jul", "ago", "sep", "oct", "nov", "dic",
      ],
    };
    monthsInGreen = months.filter((m) => m.score >= 80).length;
  }

  return {
    group: {
      id: group.id,
      name: group.name,
      accountName: group.account?.name ?? "—",
      parentName: group.parent?.name ?? null,
      idShort: group.id.slice(-4).toUpperCase(),
      totalAssets: assetIds.length,
    },
    summary: {
      distanceKm,
      tripCount,
      activeMin,
      score,
      activeDrivers: uniqueDrivers.size,
      activeAssets: uniqueAssets.size,
    },
    prev: {
      score: prevScore,
      distanceKm: prevDistanceKm > 0 ? prevDistanceKm : null,
      tripCount: prevTripCount > 0 ? prevTripCount : null,
      activeDrivers: prevUniqueDrivers > 0 ? prevUniqueDrivers : null,
      infractionCount: prevInfractions > 0 ? prevInfractions : null,
    },
    infractions: {
      total: infractions.length,
      leve,
      media,
      grave,
      per100km,
    },
    topDrivers,
    bottomDrivers,
    scatter: driverScores,
    evolution,
    monthsInGreen,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function emptyGroupBoletin(
  group: any,
  period: ParsedPeriod,
): GroupBoletinData {
  return {
    group: {
      id: group.id,
      name: group.name,
      accountName: group.account?.name ?? "—",
      parentName: group.parent?.name ?? null,
      idShort: group.id.slice(-4).toUpperCase(),
      totalAssets: 0,
    },
    summary: {
      distanceKm: 0,
      tripCount: 0,
      activeMin: 0,
      score: 100,
      activeDrivers: 0,
      activeAssets: 0,
    },
    prev: {
      score: null,
      distanceKm: null,
      tripCount: null,
      activeDrivers: null,
      infractionCount: null,
    },
    infractions: { total: 0, leve: 0, media: 0, grave: 0, per100km: 0 },
    topDrivers: [],
    bottomDrivers: [],
    scatter: [],
    evolution: {
      scoreSeries: [],
      distanceSeries: [],
      labels: [],
    },
    monthsInGreen: period.kind === "annual" ? 0 : null,
  };
}

function periodToDateRange(p: ParsedPeriod): { start: Date; end: Date } {
  if (p.kind === "monthly") {
    const start = new Date(Date.UTC(p.year, p.month! - 1, 1, 3));
    const end = new Date(Date.UTC(p.year, p.month!, 1, 3));
    return { start, end };
  }
  const start = new Date(Date.UTC(p.year, 0, 1, 3));
  const end = new Date(Date.UTC(p.year + 1, 0, 1, 3));
  return { start, end };
}

function getPreviousPeriod(p: ParsedPeriod): ParsedPeriod {
  if (p.kind === "monthly") {
    const prevMonth = p.month === 1 ? 12 : p.month! - 1;
    const prevYear = p.month === 1 ? p.year - 1 : p.year;
    return {
      kind: "monthly",
      year: prevYear,
      month: prevMonth,
      label: "",
      compact: "",
      previous: "",
    };
  }
  return {
    kind: "annual",
    year: p.year - 1,
    month: null,
    label: "",
    compact: "",
    previous: "",
  };
}

function computeScore(totalKm: number, excessKm: number): number {
  if (totalKm <= 0) return 100;
  const ratio = excessKm / totalKm;
  const raw = 100 - ratio * 100 * SCORE_MULTIPLIER;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function bucketByWeek(
  monthStart: Date,
  monthEnd: Date,
  days: any[],
  infs: any[],
): Array<{ score: number; distanceKm: number }> {
  const buckets: Array<{
    startMs: number;
    endMs: number;
    distanceKm: number;
    excessKm: number;
  }> = [];
  let cursor = monthStart.getTime();
  const endMs = monthEnd.getTime();
  while (cursor < endMs) {
    const next = Math.min(cursor + 7 * 86400000, endMs);
    buckets.push({ startMs: cursor, endMs: next, distanceKm: 0, excessKm: 0 });
    cursor = next;
  }
  for (const d of days) {
    const t = d.day.getTime();
    const b = buckets.find((bk) => t >= bk.startMs && t < bk.endMs);
    if (b) b.distanceKm += d.distanceKm;
  }
  for (const i of infs) {
    const t = i.startedAt.getTime();
    const b = buckets.find((bk) => t >= bk.startMs && t < bk.endMs);
    if (b) b.excessKm += i.distanceMeters / 1000;
  }
  return buckets.map((b) => ({
    distanceKm: round1(b.distanceKm),
    score: computeScore(b.distanceKm, b.excessKm),
  }));
}

function bucketByMonth(
  year: number,
  days: any[],
  infs: any[],
): Array<{ score: number; distanceKm: number }> {
  const buckets = Array.from({ length: 12 }, () => ({
    distanceKm: 0,
    excessKm: 0,
  }));
  for (const d of days) {
    if (d.day.getUTCFullYear() === year) {
      buckets[d.day.getUTCMonth()].distanceKm += d.distanceKm;
    }
  }
  for (const i of infs) {
    if (i.startedAt.getUTCFullYear() === year) {
      buckets[i.startedAt.getUTCMonth()].excessKm += i.distanceMeters / 1000;
    }
  }
  return buckets.map((b) => ({
    distanceKm: round1(b.distanceKm),
    score: computeScore(b.distanceKm, b.excessKm),
  }));
}
