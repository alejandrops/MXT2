/**
 * generate-weekly-stats.ts
 *
 * Genera la tabla AssetWeeklyStats agregando datos de:
 *   · AssetDriverDay (kilómetros, minutos activos, viajes)
 *   · Event (conteos por severidad y speeding)
 *   · Trip (max speed por semana)
 *
 * Buckets · Lunes 00:00 AR-local (UTC-3) · misma convención que el seed.ts.
 *
 * Uso:
 *   npx tsx prisma/generate-weekly-stats.ts
 *
 * El script es idempotente · borra todo AssetWeeklyStats antes de
 * regenerar. Toma ~30-60 segundos para 120 assets con 3 meses de
 * data.
 *
 * Origen del bug · seed-viajes.ts (que es el que corriste
 * recientemente) borra esta tabla pero no la regenera. La función
 * rollupAssetWeeklyStats existe en seed.ts pero no fue portada a
 * seed-viajes. Este script extrae esa lógica.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MS_DAY = 24 * 60 * 60 * 1000;
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** UTC instant of the most recent AR-local Monday 00:00 ≤ ts */
function arLocalMondayUtc(ts: number): Date {
  const localMs = ts - AR_OFFSET_MS;
  const local = new Date(localMs);
  const dow = local.getUTCDay();
  const daysBack = dow === 0 ? 6 : dow - 1;
  const mondayLocalMs =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
    ) -
    daysBack * MS_DAY;
  return new Date(mondayLocalMs + AR_OFFSET_MS);
}

function ymdSeed(ts: number): string {
  const local = new Date(ts - AR_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(
    local.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

interface WeekAcc {
  weekStart: Date;
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  activeDayKeys: Set<string>;
  eventCount: number;
  highEventCount: number;
  speedingCount: number;
  maxSpeedKmh: number;
}

async function rollupOne(asset: { id: string; accountId: string }): Promise<number> {
  // 1 · pull AssetDriverDay
  const driverDays = await db.assetDriverDay.findMany({
    where: { assetId: asset.id },
    select: {
      day: true,
      distanceKm: true,
      activeMin: true,
      tripCount: true,
    },
  });
  if (driverDays.length === 0) return 0;

  // 2 · pull events + trips en el mismo rango
  const minDay: Date = driverDays.reduce(
    (m, d) => (d.day < m ? d.day : m),
    driverDays[0]!.day,
  );
  const maxDay: Date = driverDays.reduce(
    (m, d) => (d.day > m ? d.day : m),
    driverDays[0]!.day,
  );
  const events = await db.event.findMany({
    where: {
      assetId: asset.id,
      occurredAt: {
        gte: minDay,
        lt: new Date(maxDay.getTime() + MS_DAY),
      },
    },
    select: { occurredAt: true, type: true, severity: true },
  });
  const trips = await db.trip.findMany({
    where: {
      assetId: asset.id,
      startedAt: {
        gte: minDay,
        lt: new Date(maxDay.getTime() + MS_DAY),
      },
    },
    select: { startedAt: true, maxSpeedKmh: true },
  });

  // 3 · bucket por week-start
  const buckets = new Map<number, WeekAcc>();

  function bucketFor(ts: number): WeekAcc {
    const wk = arLocalMondayUtc(ts);
    const key = wk.getTime();
    let acc = buckets.get(key);
    if (!acc) {
      acc = {
        weekStart: wk,
        distanceKm: 0,
        activeMin: 0,
        tripCount: 0,
        activeDayKeys: new Set(),
        eventCount: 0,
        highEventCount: 0,
        speedingCount: 0,
        maxSpeedKmh: 0,
      };
      buckets.set(key, acc);
    }
    return acc;
  }

  for (const dd of driverDays) {
    const acc = bucketFor(dd.day.getTime());
    acc.distanceKm += dd.distanceKm;
    acc.activeMin += dd.activeMin;
    acc.tripCount += dd.tripCount;
    acc.activeDayKeys.add(ymdSeed(dd.day.getTime()));
  }
  for (const ev of events) {
    const acc = bucketFor(ev.occurredAt.getTime());
    acc.eventCount += 1;
    if (ev.severity === "HIGH" || ev.severity === "CRITICAL")
      acc.highEventCount += 1;
    const t = String(ev.type);
    if (t === "SPEEDING" || t.includes("SPEED")) acc.speedingCount += 1;
  }
  for (const t of trips) {
    const acc = bucketFor(t.startedAt.getTime());
    if (t.maxSpeedKmh > acc.maxSpeedKmh) acc.maxSpeedKmh = t.maxSpeedKmh;
  }

  // 4 · persist
  const rows = Array.from(buckets.values()).map((acc) => ({
    accountId: asset.accountId,
    assetId: asset.id,
    weekStart: acc.weekStart,
    distanceKm: Math.round(acc.distanceKm * 10) / 10,
    activeMin: acc.activeMin,
    idleMin: Math.round(acc.activeMin * 0.25),
    activeDays: acc.activeDayKeys.size,
    tripCount: acc.tripCount,
    eventCount: acc.eventCount,
    highEventCount: acc.highEventCount,
    speedingCount: acc.speedingCount,
    maxSpeedKmh: Math.round(acc.maxSpeedKmh * 10) / 10,
    fuelLiters: Math.round(acc.activeMin * 0.12 * 10) / 10,
  }));

  let inserted = 0;
  while (rows.length > 0) {
    const chunk = rows.splice(0, 200);
    const result = await db.assetWeeklyStats.createMany({ data: chunk });
    inserted += result.count;
  }
  return inserted;
}

async function main() {
  console.log("\n📊 generate-weekly-stats · regenerando AssetWeeklyStats");
  console.time("rollup");

  // Solo rollupeamos assets con mobility MOBILE · los FIXED no
  // tienen viajes ni distancia.
  const mobileAssets = await db.asset.findMany({
    where: { mobilityType: "MOBILE" },
    select: { id: true, accountId: true },
  });
  console.log(`   ${mobileAssets.length} assets MOBILE encontrados`);

  console.log("   · borrando AssetWeeklyStats existente...");
  const deleted = await db.assetWeeklyStats.deleteMany();
  console.log(`     borrados: ${deleted.count}`);

  let totalInserted = 0;
  let processed = 0;
  for (const asset of mobileAssets) {
    const inserted = await rollupOne(asset);
    totalInserted += inserted;
    processed += 1;
    if (processed % 20 === 0) {
      console.log(`   · ${processed}/${mobileAssets.length} assets · ${totalInserted} weeks`);
    }
  }

  console.log(`\n✅ ${totalInserted} AssetWeeklyStats generados desde ${processed} assets`);
  console.timeEnd("rollup");
}

main()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
