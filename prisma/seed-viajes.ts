// ═══════════════════════════════════════════════════════════════
//  seed-viajes.ts (S2 · Lote de datos de movimiento)
//  ─────────────────────────────────────────────────────────────
//  Genera datos sintéticos de movimiento para los 120 vehículos
//  ya creados por seed-flespi-test:
//
//   · ~10,800 viajes (3 meses, ~3 viajes/vehículo/día)
//   · ~80,000 eventos (mayoría info, pocos críticos)
//   · ~600 alarmas (de eventos HIGH/CRITICAL)
//   · ~325,000 positions (puntos decimados de las rutas)
//   · 120 LivePosition (estado actual)
//
//  ⚠️ ATENCIÓN: borra y regenera Trip/Event/Alarm/Position/
//  LivePosition existentes. NO toca Account/Asset/Person.
//
//  Usage: npx tsx prisma/seed-viajes.ts
// ═══════════════════════════════════════════════════════════════

import {
  PrismaClient,
  Prisma,
  EventType,
  Severity,
  AlarmDomain,
  AlarmType,
  AlarmStatus,
} from "@prisma/client";

const db = new PrismaClient();

// ── Configuración ────────────────────────────────────────────

const HISTORY_DAYS = 90; // 3 meses
const NOW = new Date();

interface AccountConfig {
  slug: string;
  hubName: string;
  /** Centro de operaciones · de ahí salen los viajes */
  hubLat: number;
  hubLng: number;
  /** Destinos típicos · radios variables */
  destinations: { name: string; lat: number; lng: number }[];
}

const ACCOUNT_HUBS: AccountConfig[] = [
  {
    slug: "transportes-del-sur",
    hubName: "Buenos Aires",
    hubLat: -34.6037,
    hubLng: -58.3816,
    destinations: [
      { name: "Mar del Plata", lat: -38.0055, lng: -57.5426 },
      { name: "Rosario", lat: -32.9468, lng: -60.6393 },
      { name: "Córdoba", lat: -31.4201, lng: -64.1888 },
      { name: "La Plata", lat: -34.9215, lng: -57.9545 },
      { name: "Tigre", lat: -34.4264, lng: -58.5797 },
      { name: "Pilar", lat: -34.4587, lng: -58.9142 },
      { name: "San Nicolás", lat: -33.3357, lng: -60.2099 },
    ],
  },
  {
    slug: "frigorificos-andinos",
    hubName: "Santiago",
    hubLat: -33.4489,
    hubLng: -70.6693,
    destinations: [
      { name: "Valparaíso", lat: -33.0472, lng: -71.6127 },
      { name: "Rancagua", lat: -34.1708, lng: -70.7444 },
      { name: "San Antonio", lat: -33.5928, lng: -71.6066 },
      { name: "Los Andes", lat: -32.8344, lng: -70.5982 },
      { name: "Talca", lat: -35.4264, lng: -71.6554 },
      { name: "Melipilla", lat: -33.6906, lng: -71.2148 },
    ],
  },
  {
    slug: "logistica-norte",
    hubName: "Mendoza",
    hubLat: -32.8895,
    hubLng: -68.8458,
    destinations: [
      { name: "San Juan", lat: -31.5375, lng: -68.5364 },
      { name: "San Luis", lat: -33.2950, lng: -66.3356 },
      { name: "San Rafael", lat: -34.6177, lng: -68.3301 },
      { name: "Tunuyán", lat: -33.5772, lng: -69.0184 },
      { name: "Maipú", lat: -32.9847, lng: -68.7857 },
    ],
  },
  {
    slug: "distribuidora-central",
    hubName: "Córdoba",
    hubLat: -31.4201,
    hubLng: -64.1888,
    destinations: [
      { name: "Río Cuarto", lat: -33.1232, lng: -64.3493 },
      { name: "Villa María", lat: -32.4096, lng: -63.2401 },
      { name: "Carlos Paz", lat: -31.4242, lng: -64.4979 },
      { name: "Alta Gracia", lat: -31.6534, lng: -64.4286 },
      { name: "Jesús María", lat: -30.9866, lng: -64.0999 },
      { name: "San Francisco", lat: -31.4287, lng: -62.0832 },
    ],
  },
];

// ── Utils ────────────────────────────────────────────────────

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function randInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randFloat(rand: () => number, min: number, max: number): number {
  return rand() * (max - min) + min;
}

function pickOne<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function weightedPick<T>(
  rand: () => number,
  items: { item: T; weight: number }[],
): T {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = rand() * total;
  for (const x of items) {
    r -= x.weight;
    if (r <= 0) return x.item;
  }
  return items[items.length - 1]!.item;
}

/** Distancia haversine en km */
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Genera N puntos de ruta interpolados con ruido (simula calle real) */
function generateRoute(
  rand: () => number,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  steps: number,
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const noiseScale = 0.005; // ~500m de ruido lateral

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Curva levemente irregular
    const tSmooth = t + (Math.sin(t * Math.PI) * (rand() - 0.5)) * 0.05;
    const lat = startLat + (endLat - startLat) * tSmooth + (rand() - 0.5) * noiseScale;
    const lng = startLng + (endLng - startLng) * tSmooth + (rand() - 0.5) * noiseScale;
    points.push({ lat, lng });
  }
  return points;
}

/** Decimación · saltea puntos para reducir densidad (mantiene el primero y el último) */
function decimate<T>(arr: T[], targetCount: number): T[] {
  if (arr.length <= targetCount) return arr;
  const step = arr.length / targetCount;
  const out: T[] = [];
  for (let i = 0; i < targetCount; i++) {
    out.push(arr[Math.floor(i * step)]!);
  }
  out.push(arr[arr.length - 1]!);
  return out;
}

// ── Perfil de actividad por vehículo ─────────────────────────

type ActivityLevel = "HIGH" | "MEDIUM" | "LOW";

function activityLevel(rand: () => number): ActivityLevel {
  return weightedPick(rand, [
    { item: "HIGH" as const, weight: 60 },
    { item: "MEDIUM" as const, weight: 30 },
    { item: "LOW" as const, weight: 10 },
  ]);
}

function tripsForDay(
  rand: () => number,
  level: ActivityLevel,
  isWeekend: boolean,
): number {
  const baseRange =
    level === "HIGH" ? [2, 4] : level === "MEDIUM" ? [1, 2] : [0, 1];
  let trips = randInt(rand, baseRange[0]!, baseRange[1]!);

  if (isWeekend) {
    // 50% de actividad en fin de semana
    trips = Math.floor(trips * 0.5);
  }

  return trips;
}

// ─── MAIN ────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  seed-viajes · 3 meses de movimiento");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // ── 1. Verificar que existan los datos base ──────────────
  console.log("Verificando datos base…");
  const accounts = await db.account.findMany({
    where: { slug: { in: ACCOUNT_HUBS.map((h) => h.slug) } },
    include: {
      assets: { where: { mobilityType: "MOBILE" },},
      groups: true,
    },
  });

  if (accounts.length !== 4) {
    throw new Error(
      `❌ Esperaba 4 cuentas (de seed-flespi-test). Encontradas: ${accounts.length}. Correr seed-flespi-test.ts primero.`,
    );
  }

  const totalAssets = accounts.reduce((s, a) => s + a.assets.length, 0);
  if (totalAssets < 100) {
    throw new Error(
      `❌ Pocos vehículos · ${totalAssets}. Esperaba ~120. Correr seed-flespi-test.ts.`,
    );
  }

  const persons = await db.person.findMany();
  console.log(
    `  ${accounts.length} cuentas · ${totalAssets} vehículos · ${persons.length} conductores`,
  );

  // Mapa de account.slug → AccountConfig
  const hubBySlug = new Map(ACCOUNT_HUBS.map((h) => [h.slug, h]));

  // ── 2. WIPE de datos anteriores ──────────────────────────
  console.log("");
  console.log("Borrando viajes/eventos/alarmas/positions previos…");
  const [
    delLive,
    delPos,
    delAlarm,
    delEvent,
    delTrip,
    delAssetDay,
    delWeekly,
  ] = await db.$transaction([
    db.livePosition.deleteMany(),
    db.position.deleteMany(),
    db.alarm.deleteMany(),
    db.event.deleteMany(),
    db.trip.deleteMany(),
    db.assetDriverDay.deleteMany(),
    db.assetWeeklyStats.deleteMany(),
  ]);

  console.log(
    `  ✓ ${delLive.count} live · ${delPos.count} pos · ${delAlarm.count} alarmas · ${delEvent.count} eventos · ${delTrip.count} viajes · ${delAssetDay.count} day-rolls · ${delWeekly.count} weekly`,
  );

  // ── 3. Generar viajes ────────────────────────────────────
  console.log("");
  console.log("Generando viajes…");

  const allTrips: Prisma.TripCreateManyInput[] = [];
  const allEvents: Prisma.EventCreateManyInput[] = [];
  const allAlarms: Prisma.AlarmCreateManyInput[] = [];
  const allPositions: Prisma.PositionCreateManyInput[] = [];
  const allLivePositions: Prisma.LivePositionCreateManyInput[] = [];
  const allAssetDays: Prisma.AssetDriverDayCreateManyInput[] = [];

  let processedAssets = 0;

  for (const account of accounts) {
    const hub = hubBySlug.get(account.slug);
    if (!hub) continue;

// Person SÍ tiene accountId directo · queryeamos los de este account
    const accountPersons = persons.filter((p) => p.accountId === account.id);

    for (const asset of account.assets) {
      const seed = parseInt(asset.id.replace(/\D/g, "").slice(0, 6), 10) || 1;
      const rand = rng(seed);

      const level = activityLevel(rand);
      const baseDriver = pickOne(rand, accountPersons.length > 0 ? accountPersons : persons);

      // Generar viajes por día
      for (let dayOffset = HISTORY_DAYS; dayOffset > 0; dayOffset--) {
        const dayDate = new Date(NOW.getTime() - dayOffset * 24 * 60 * 60 * 1000);
        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
        const dayTripCount = tripsForDay(rand, level, isWeekend);

        if (dayTripCount === 0) continue;

        // Driver del día (90% el "asignado", 10% rotación)
        const dayDriver =
          rand() < 0.9 ? baseDriver : pickOne(rand, accountPersons.length > 0 ? accountPersons : persons);

        let dayDistance = 0;
        let dayActiveMin = 0;
        let firstTripAt: Date | null = null;
        let lastTripAt: Date | null = null;

        for (let t = 0; t < dayTripCount; t++) {
          // Hora del día · entre 6am y 8pm (mayoría)
          const startHour = randInt(rand, 6, 19);
          const startMin = randInt(rand, 0, 59);
          const startedAt = new Date(dayDate);
          startedAt.setHours(startHour, startMin, 0, 0);

          // Destino
          const dest = pickOne(rand, hub.destinations);
          const useDestination = rand() < 0.7;
          const targetLat = useDestination
            ? dest.lat
            : hub.hubLat + randFloat(rand, -0.15, 0.15);
          const targetLng = useDestination
            ? dest.lng
            : hub.hubLng + randFloat(rand, -0.15, 0.15);

          // Origen · puede ser hub o un punto aleatorio (random pickup)
          const fromHub = rand() < 0.6;
          const startLat = fromHub
            ? hub.hubLat + randFloat(rand, -0.02, 0.02)
            : hub.hubLat + randFloat(rand, -0.1, 0.1);
          const startLng = fromHub
            ? hub.hubLng + randFloat(rand, -0.02, 0.02)
            : hub.hubLng + randFloat(rand, -0.1, 0.1);

          const totalDistKm = distanceKm(startLat, startLng, targetLat, targetLng);
          // velocidad promedio · mix urbano/ruta
          const avgSpeedKmh = totalDistKm > 30 ? randFloat(rand, 60, 90) : randFloat(rand, 30, 50);
          const durationMs = Math.round((totalDistKm / avgSpeedKmh) * 60 * 60 * 1000);
          const endedAt = new Date(startedAt.getTime() + durationMs);

          // Si endedAt > NOW, el viaje quedaría en el futuro · skip
          if (endedAt > NOW) continue;

          // ── Generar puntos de ruta ──
          const pointSteps = Math.min(80, Math.max(10, Math.floor(totalDistKm * 1.5)));
          const route = generateRoute(rand, startLat, startLng, targetLat, targetLng, pointSteps);

          const polyline = decimate(route, 30).map((p) => [p.lat, p.lng]);

          // Velocidades a lo largo de la ruta · pico al medio
          const maxSpeed = avgSpeedKmh * randFloat(rand, 1.15, 1.5);

          const tripId = `tr_${asset.id.slice(-8)}_${dayOffset}_${t}`;

          allTrips.push({
            id: tripId,
            assetId: asset.id,
            personId: dayDriver.id,
            startedAt,
            endedAt,
            durationMs,
            distanceKm: Math.round(totalDistKm * 100) / 100,
            avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
            maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
            idleMs: randInt(rand, 30000, 600000),
            startLat,
            startLng,
            endLat: targetLat,
            endLng: targetLng,
            positionCount: route.length,
            polylineJson: JSON.stringify(polyline),
            eventCount: 0, // se rellena después
            highSeverityEventCount: 0,
            createdAt: endedAt,
          });

          dayDistance += totalDistKm;
          dayActiveMin += Math.round(durationMs / 60000);
          if (!firstTripAt || startedAt < firstTripAt) firstTripAt = startedAt;
          if (!lastTripAt || endedAt > lastTripAt) lastTripAt = endedAt;

          // ── Generar Positions decimadas (~30 por viaje) ──
          const decimatedRoute = decimate(route, 30);
          for (let i = 0; i < decimatedRoute.length; i++) {
            const p = decimatedRoute[i]!;
            const tFraction = i / Math.max(1, decimatedRoute.length - 1);
            const ts = new Date(startedAt.getTime() + tFraction * durationMs);
            const speed =
              i === 0 || i === decimatedRoute.length - 1
                ? 0
                : avgSpeedKmh * (0.7 + Math.sin(tFraction * Math.PI) * 0.5);

            allPositions.push({
              assetId: asset.id,
              recordedAt: ts,
              receivedAt: ts,
              lat: p.lat,
              lng: p.lng,
              speedKmh: Math.round(speed * 10) / 10,
              heading: randInt(rand, 0, 359),
              ignition: i > 0 && i < decimatedRoute.length - 1,
            });
          }

          // ── Generar Eventos del viaje ──
          let eventCount = 0;
          let highSevCount = 0;

          // IGNITION_ON al inicio
          allEvents.push({
            assetId: asset.id,
            personId: dayDriver.id,
            type: "IGNITION_ON",
            severity: "LOW",
            occurredAt: startedAt,
            lat: startLat,
            lng: startLng,
            speedKmh: 0,
            metadata: null,
          });
          eventCount++;

          // Eventos durante el viaje · 0-15 según duración
          const travelEvents = randInt(rand, 0, Math.min(15, Math.floor(totalDistKm / 5) + 2));
          for (let e = 0; e < travelEvents; e++) {
            const tFrac = randFloat(rand, 0.05, 0.95);
            const evTime = new Date(startedAt.getTime() + tFrac * durationMs);
            const evIdx = Math.floor(tFrac * decimatedRoute.length);
            const pos = decimatedRoute[evIdx]!;

            const evType = weightedPick<EventType>(rand, [
              { item: "HARSH_BRAKING", weight: 25 },
              { item: "HARSH_ACCELERATION", weight: 20 },
              { item: "HARSH_CORNERING", weight: 15 },
              { item: "SPEEDING", weight: 25 },
              { item: "IDLING", weight: 8 },
              { item: "GEOFENCE_ENTRY", weight: 4 },
              { item: "GEOFENCE_EXIT", weight: 3 },
            ]);

            const sev = weightedPick<Severity>(rand, [
              { item: "LOW", weight: 50 },
              { item: "MEDIUM", weight: 30 },
              { item: "HIGH", weight: 15 },
              { item: "CRITICAL", weight: 5 },
            ]);

            const evSpeed =
              evType === "SPEEDING"
                ? randFloat(rand, 110, 160)
                : evType === "IDLING"
                ? 0
                : randFloat(rand, 20, 80);

            allEvents.push({
              assetId: asset.id,
              personId: dayDriver.id,
              type: evType,
              severity: sev,
              occurredAt: evTime,
              lat: pos.lat,
              lng: pos.lng,
              speedKmh: Math.round(evSpeed * 10) / 10,
              metadata: null,
            });
            eventCount++;
            if (sev === "HIGH" || sev === "CRITICAL") {
              highSevCount++;

              // ── Alarma · 15% de eventos HIGH/CRITICAL → alarma ──
              if (rand() < 0.15) {
                const ageDays = (NOW.getTime() - evTime.getTime()) / (1000 * 60 * 60 * 24);
                // Alarmas más viejas más cerradas
                let status: AlarmStatus;
                if (ageDays < 2) {
                  status = weightedPick(rand, [
                    { item: "OPEN" as AlarmStatus, weight: 70 },
                    { item: "ATTENDED" as AlarmStatus, weight: 25 },
                    { item: "CLOSED" as AlarmStatus, weight: 5 },
                  ]);
                } else if (ageDays < 14) {
                  status = weightedPick(rand, [
                    { item: "OPEN" as AlarmStatus, weight: 15 },
                    { item: "ATTENDED" as AlarmStatus, weight: 35 },
                    { item: "CLOSED" as AlarmStatus, weight: 50 },
                  ]);
                } else {
                  status = weightedPick(rand, [
                    { item: "OPEN" as AlarmStatus, weight: 5 },
                    { item: "ATTENDED" as AlarmStatus, weight: 20 },
                    { item: "CLOSED" as AlarmStatus, weight: 75 },
                  ]);
                }

                let attendedAt: Date | null = null;
                let closedAt: Date | null = null;
                if (status !== "OPEN") {
                  attendedAt = new Date(evTime.getTime() + randInt(rand, 5, 60) * 60000);
                }
                if (status === "CLOSED" || status === "DISMISSED") {
                  closedAt = new Date(
                    (attendedAt ?? evTime).getTime() + randInt(rand, 10, 240) * 60000,
                  );
                }

                const alarmType = mapEventToAlarmType(evType);
                if (alarmType) {
                  allAlarms.push({
                    accountId: account.id,
                    assetId: asset.id,
                    personId: dayDriver.id,
                    domain: alarmType.domain,
                    type: alarmType.type,
                    severity: sev,
                    status,
                    triggeredAt: evTime,
                    attendedAt,
                    closedAt,
                    lat: pos.lat,
                    lng: pos.lng,
                    notes: null,
                  });
                }
              }
            }
          }

          // IGNITION_OFF al final
          allEvents.push({
            assetId: asset.id,
            personId: dayDriver.id,
            type: "IGNITION_OFF",
            severity: "LOW",
            occurredAt: endedAt,
            lat: targetLat,
            lng: targetLng,
            speedKmh: 0,
            metadata: null,
          });
          eventCount++;

          // Update trip counters
          const tripIdx = allTrips.length - 1;
          allTrips[tripIdx]!.eventCount = eventCount;
          allTrips[tripIdx]!.highSeverityEventCount = highSevCount;
        }

        // ── AssetDriverDay para este día ──
        if (firstTripAt && lastTripAt && dayDistance > 0) {
          const dayLocal = new Date(dayDate);
          dayLocal.setUTCHours(3, 0, 0, 0); // 00:00 AR-local
          allAssetDays.push({
            accountId: account.id,
            assetId: asset.id,
            personId: dayDriver.id,
            day: dayLocal,
            distanceKm: Math.round(dayDistance * 100) / 100,
            activeMin: dayActiveMin,
            tripCount: dayTripCount,
            firstTripAt,
            lastTripAt,
          });
        }
      }

      // ── LivePosition · estado actual del vehículo ──
      // Mix · 40% en movimiento, 50% detenido (ignition off), 10% ralentí
      const liveState = weightedPick(rand, [
        { item: "MOVING" as const, weight: 40 },
        { item: "STOPPED" as const, weight: 50 },
        { item: "IDLE" as const, weight: 10 },
      ]);

      const lastPosLat = hub.hubLat + randFloat(rand, -0.2, 0.2);
      const lastPosLng = hub.hubLng + randFloat(rand, -0.2, 0.2);
      const liveSpeed =
        liveState === "MOVING"
          ? randFloat(rand, 30, 90)
          : liveState === "IDLE"
          ? 0
          : 0;
      const liveIgnition = liveState !== "STOPPED";
      // Recencia · MOVING/IDLE = ahora, STOPPED = hace algunas horas
      const liveAge = liveState === "STOPPED" ? randInt(rand, 1, 48) * 3600000 : randInt(rand, 1, 30) * 60000;
      const liveTs = new Date(NOW.getTime() - liveAge);

      allLivePositions.push({
        assetId: asset.id,
        recordedAt: liveTs,
        lat: lastPosLat,
        lng: lastPosLng,
        speedKmh: Math.round(liveSpeed * 10) / 10,
        heading: randInt(rand, 0, 359),
        ignition: liveIgnition,
        updatedAt: liveTs,
      });

      processedAssets++;
      if (processedAssets % 20 === 0) {
        console.log(
          `  ${processedAssets}/${totalAssets} vehículos · ${allTrips.length.toLocaleString()} trips · ${allEvents.length.toLocaleString()} events · ${allAlarms.length.toLocaleString()} alarms`,
        );
      }
    }
  }

  console.log("");
  console.log(`  ✓ Generación completa · ${processedAssets} vehículos`);
  console.log(`    ${allTrips.length.toLocaleString()} viajes`);
  console.log(`    ${allEvents.length.toLocaleString()} eventos`);
  console.log(`    ${allAlarms.length.toLocaleString()} alarmas`);
  console.log(`    ${allPositions.length.toLocaleString()} positions`);
  console.log(`    ${allLivePositions.length.toLocaleString()} live positions`);
  console.log(`    ${allAssetDays.length.toLocaleString()} day rollups`);

  // ── 4. INSERTAR en batches ───────────────────────────────
  console.log("");
  console.log("Insertando en DB (batches de 1000)…");

  await batchInsert("Trip", allTrips, (chunk) =>
    db.trip.createMany({ data: chunk, skipDuplicates: true }),
  );

  await batchInsert("Event", allEvents, (chunk) =>
    db.event.createMany({ data: chunk, skipDuplicates: true }),
  );

  await batchInsert("Alarm", allAlarms, (chunk) =>
    db.alarm.createMany({ data: chunk, skipDuplicates: true }),
  );

  await batchInsert("Position", allPositions, (chunk) =>
    db.position.createMany({ data: chunk, skipDuplicates: true }),
  );

  await batchInsert("LivePosition", allLivePositions, (chunk) =>
    db.livePosition.createMany({ data: chunk, skipDuplicates: true }),
  );

  await batchInsert("AssetDriverDay", allAssetDays, (chunk) =>
    db.assetDriverDay.createMany({ data: chunk, skipDuplicates: true }),
  );

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✓ seed-viajes completado");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("  Próximo: refrescá tu app y andá a /seguimiento/mapa");
  console.log("");
}

// ─── Helpers ────────────────────────────────────────────────

async function batchInsert<T>(
  tableName: string,
  rows: T[],
  fn: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  const BATCH_SIZE = 1000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await fn(chunk);
    inserted += chunk.length;
    if (rows.length > 5000 && inserted % 5000 < BATCH_SIZE) {
      console.log(`  ${tableName}: ${inserted.toLocaleString()} / ${rows.length.toLocaleString()}`);
    }
  }
  console.log(`  ✓ ${tableName}: ${inserted.toLocaleString()} filas`);
}

function mapEventToAlarmType(
  evType: EventType,
): { domain: AlarmDomain; type: AlarmType } | null {
  switch (evType) {
    case "HARSH_BRAKING":
    case "HARSH_ACCELERATION":
    case "HARSH_CORNERING":
      return { domain: "CONDUCCION", type: "HARSH_DRIVING_PATTERN" };
    case "SPEEDING":
      return { domain: "CONDUCCION", type: "SPEEDING_CRITICAL" };
    case "PANIC_BUTTON":
      return { domain: "SEGURIDAD", type: "PANIC" };
    case "UNAUTHORIZED_USE":
      return { domain: "SEGURIDAD", type: "UNAUTHORIZED_USE" };
    case "JAMMING_DETECTED":
      return { domain: "SEGURIDAD", type: "JAMMING" };
    case "GPS_DISCONNECT":
      return { domain: "SEGURIDAD", type: "GPS_DISCONNECT" };
    case "POWER_DISCONNECT":
      return { domain: "SEGURIDAD", type: "POWER_DISCONNECT" };
    case "TRAILER_DETACH":
      return { domain: "SEGURIDAD", type: "TRAILER_DETACH" };
    case "SABOTAGE":
      return { domain: "SEGURIDAD", type: "SABOTAGE" };
    default:
      return null;
  }
}

// ─── Run ────────────────────────────────────────────────────

main()
  .catch((err) => {
    console.error("");
    console.error(`❌ Error: ${err}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
