// @ts-nocheck · pre-existing patterns (Prisma types stale)
// ═══════════════════════════════════════════════════════════════
//  getAccountBoletinData · S5-E3
//  ─────────────────────────────────────────────────────────────
//  Query agregadora para boletín de empresa · cross-grupo.
//  Quinto y último nivel del Sistema Editorial.
//
//  Output:
//    · KPIs de la empresa entera
//    · Score promedio empresa · ponderado por km
//    · Distribución de infracciones agregada
//    · Ranking top 5 + bottom 5 GRUPOS (no conductores)
//    · Scatter (km, score) por grupo
//    · Evolución 12 meses
//    · Comparativa anual vs año anterior
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { ParsedPeriod } from "@/lib/conduccion/boletin-driver-text";

const SCORE_MULTIPLIER = 10;

export interface AccountBoletinData {
  account: {
    id: string;
    name: string;
    /** ID corto · 4 chars para folio */
    idShort: string;
    /** Total de grupos del account */
    groupsCount: number;
    /** Total de assets del account */
    assetsCount: number;
  };

  summary: {
    distanceKm: number;
    tripCount: number;
    activeMin: number;
    score: number;
    activeDrivers: number;
    activeAssets: number;
    activeGroups: number;
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
    per100km: number;
  };

  // Top y bottom 5 grupos
  topGroups: GroupRanking[];
  bottomGroups: GroupRanking[];

  // Scatter · puntos por grupo
  scatter: Array<{
    groupId: string;
    name: string;
    distanceKm: number;
    score: number;
    activeDrivers: number;
    activeAssets: number;
    infractionCount: number;
  }>;

  // Evolución
  evolution: {
    scoreSeries: number[];
    distanceSeries: number[];
    labels: string[];
  };

  monthsInGreen: number | null;

  // Tabla de top 3 infracciones más graves de la empresa
  topInfractions: Array<{
    id: string;
    startedAtIso: string;
    severity: "LEVE" | "MEDIA" | "GRAVE";
    peakSpeedKmh: number;
    vmaxKmh: number;
    maxExcessKmh: number;
    driverName: string;
    groupName: string;
    assetName: string;
  }>;
}

interface GroupRanking {
  groupId: string;
  name: string;
  distanceKm: number;
  score: number;
  activeDrivers: number;
  infractionCount: number;
}

export async function getAccountBoletinData(args: {
  accountId: string;
  period: ParsedPeriod;
}): Promise<AccountBoletinData | null> {
  const { accountId, period } = args;

  // ── 1. Account + structural data ─────────────────────
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      groups: {
        select: {
          id: true,
          name: true,
          assets: { select: { id: true } },
        },
      },
    },
  });
  if (!account) return null;

  const groups = account.groups;
  const allAssetIds = groups.flatMap((g: any) => g.assets.map((a: any) => a.id));
  const totalAssets = allAssetIds.length;

  if (totalAssets === 0) {
    return emptyAccountBoletin(account, period);
  }

  // ── 2. Períodos ────────────────────────────────────
  const { start, end } = periodToDateRange(period);
  const prevPeriod = getPreviousPeriod(period);
  const prev = periodToDateRange(prevPeriod);

  // ── 3. Queries paralelas ────────────────────────────
  const [days, prevDays, infractions, prevInfractions, topInfractionsRaw] =
    await Promise.all([
      db.assetDriverDay.findMany({
        where: {
          assetId: { in: allAssetIds },
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
          asset: { select: { groupId: true } },
        },
      }),
      db.assetDriverDay.findMany({
        where: {
          assetId: { in: allAssetIds },
          day: { gte: prev.start, lt: prev.end },
          personId: { not: null },
        },
        select: {
          personId: true,
          distanceKm: true,
          tripCount: true,
        },
      }),
      db.infraction.findMany({
        where: {
          accountId,
          startedAt: { gte: start, lt: end },
        },
        select: {
          startedAt: true,
          severity: true,
          distanceMeters: true,
          assetId: true,
          asset: { select: { groupId: true } },
        },
      }),
      db.infraction.count({
        where: {
          accountId,
          startedAt: { gte: prev.start, lt: prev.end },
        },
      }),
      // Top 3 infracciones más graves del período
      db.infraction.findMany({
        where: {
          accountId,
          startedAt: { gte: start, lt: end },
        },
        orderBy: { maxExcessKmh: "desc" },
        take: 3,
        select: {
          id: true,
          startedAt: true,
          severity: true,
          peakSpeedKmh: true,
          vmaxKmh: true,
          maxExcessKmh: true,
          asset: { select: { name: true, groupId: true } },
          driver: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

  // ── 4. Agregaciones del account ─────────────────────
  const distanceKm = round1(days.reduce((a, d) => a + d.distanceKm, 0));
  const activeMin = days.reduce((a, d) => a + d.activeMin, 0);
  const tripCount = days.reduce((a, d) => a + d.tripCount, 0);
  const uniqueDrivers = new Set(days.map((d) => d.personId).filter(Boolean));
  const uniqueAssets = new Set(days.map((d) => d.assetId));
  const uniqueGroups = new Set(
    days.map((d) => d.asset?.groupId).filter(Boolean),
  );

  // ── 5. Score por grupo · ponderado por km ───────────
  const groupAgg = new Map<
    string,
    {
      groupId: string;
      name: string;
      distanceKm: number;
      excessKm: number;
      drivers: Set<string>;
      infractionCount: number;
    }
  >();

  // Initialize buckets para todos los grupos del account (incluso sin actividad)
  for (const g of groups) {
    groupAgg.set(g.id, {
      groupId: g.id,
      name: g.name,
      distanceKm: 0,
      excessKm: 0,
      drivers: new Set<string>(),
      infractionCount: 0,
    });
  }

  for (const d of days) {
    const gid = d.asset?.groupId;
    if (!gid) continue;
    const gr = groupAgg.get(gid);
    if (gr) {
      gr.distanceKm += d.distanceKm;
      if (d.personId) gr.drivers.add(d.personId);
    }
  }

  for (const i of infractions) {
    const gid = i.asset?.groupId;
    if (!gid) continue;
    const gr = groupAgg.get(gid);
    if (gr) {
      gr.excessKm += i.distanceMeters / 1000;
      gr.infractionCount += 1;
    }
  }

  // Score por grupo
  const groupScores = Array.from(groupAgg.values())
    .filter((g) => g.distanceKm > 0) // solo grupos con actividad para el ranking
    .map((g) => ({
      groupId: g.groupId,
      name: g.name,
      distanceKm: round1(g.distanceKm),
      score: computeScore(g.distanceKm, g.excessKm),
      activeDrivers: g.drivers.size,
      activeAssets: 0, // se calcula abajo
      infractionCount: g.infractionCount,
    }));

  // Score account · promedio ponderado por km
  const totalKmGroups = groupScores.reduce((a, b) => a + b.distanceKm, 0);
  const weightedScore =
    totalKmGroups > 0
      ? groupScores.reduce(
          (acc, g) => acc + g.score * (g.distanceKm / totalKmGroups),
          0,
        )
      : 100;
  const score = Math.round(weightedScore);

  // ── 6. activeAssets por grupo ───────────────────────
  // Mapear assetIds activos a su groupId
  const assetsByGroup = new Map<string, Set<string>>();
  for (const d of days) {
    const gid = d.asset?.groupId;
    if (!gid) continue;
    if (!assetsByGroup.has(gid)) assetsByGroup.set(gid, new Set());
    assetsByGroup.get(gid)!.add(d.assetId);
  }
  for (const g of groupScores) {
    g.activeAssets = assetsByGroup.get(g.groupId)?.size ?? 0;
  }

  // ── 7. Comparativa prev ─────────────────────────────
  const prevDistanceKm = round1(
    prevDays.reduce((a, d) => a + d.distanceKm, 0),
  );
  const prevTripCount = prevDays.reduce((a, d) => a + d.tripCount, 0);
  const prevUniqueDrivers = new Set(
    prevDays.map((d) => d.personId).filter(Boolean),
  ).size;

  const prevExcessAgg = await db.infraction.aggregate({
    where: {
      accountId,
      startedAt: { gte: prev.start, lt: prev.end },
    },
    _sum: { distanceMeters: true },
  });
  const prevExcessKm = (prevExcessAgg._sum.distanceMeters ?? 0) / 1000;
  const prevScore =
    prevDistanceKm > 0 ? computeScore(prevDistanceKm, prevExcessKm) : null;

  // ── 8. Distribución infracciones ────────────────────
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

  // ── 9. Rankings ─────────────────────────────────────
  const sortedByScore = [...groupScores].sort((a, b) => b.score - a.score);
  const topGroups = sortedByScore.slice(0, 5);
  const bottomGroups = [...sortedByScore].reverse().slice(0, 5);

  // ── 10. Evolución ───────────────────────────────────
  let evolution: AccountBoletinData["evolution"];
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

  // ── 11. Top infracciones · resolver groupName ───────
  const groupNameById = new Map(groups.map((g: any) => [g.id, g.name]));
  const topInfractions = topInfractionsRaw.map((i) => ({
    id: i.id,
    startedAtIso: i.startedAt.toISOString(),
    severity: i.severity as "LEVE" | "MEDIA" | "GRAVE",
    peakSpeedKmh: Math.round(i.peakSpeedKmh),
    vmaxKmh: i.vmaxKmh,
    maxExcessKmh: Math.round(i.maxExcessKmh),
    driverName: i.driver
      ? `${i.driver.firstName ?? ""} ${i.driver.lastName ?? ""}`.trim() || "—"
      : "—",
    groupName: groupNameById.get(i.asset?.groupId ?? "") ?? "—",
    assetName: i.asset?.name ?? "—",
  }));

  return {
    account: {
      id: account.id,
      name: account.name,
      idShort: account.id.slice(-4).toUpperCase(),
      groupsCount: groups.length,
      assetsCount: totalAssets,
    },
    summary: {
      distanceKm,
      tripCount,
      activeMin,
      score,
      activeDrivers: uniqueDrivers.size,
      activeAssets: uniqueAssets.size,
      activeGroups: uniqueGroups.size,
    },
    prev: {
      score: prevScore,
      distanceKm: prevDistanceKm > 0 ? prevDistanceKm : null,
      tripCount: prevTripCount > 0 ? prevTripCount : null,
      activeDrivers: prevUniqueDrivers > 0 ? prevUniqueDrivers : null,
      infractionCount: prevInfractions > 0 ? prevInfractions : null,
    },
    infractions: { total: infractions.length, leve, media, grave, per100km },
    topGroups,
    bottomGroups,
    scatter: groupScores,
    evolution,
    monthsInGreen,
    topInfractions,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function emptyAccountBoletin(account: any, period: ParsedPeriod): AccountBoletinData {
  return {
    account: {
      id: account.id,
      name: account.name,
      idShort: account.id.slice(-4).toUpperCase(),
      groupsCount: 0,
      assetsCount: 0,
    },
    summary: {
      distanceKm: 0,
      tripCount: 0,
      activeMin: 0,
      score: 100,
      activeDrivers: 0,
      activeAssets: 0,
      activeGroups: 0,
    },
    prev: {
      score: null,
      distanceKm: null,
      tripCount: null,
      activeDrivers: null,
      infractionCount: null,
    },
    infractions: { total: 0, leve: 0, media: 0, grave: 0, per100km: 0 },
    topGroups: [],
    bottomGroups: [],
    scatter: [],
    evolution: { scoreSeries: [], distanceSeries: [], labels: [] },
    monthsInGreen: period.kind === "annual" ? 0 : null,
    topInfractions: [],
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
