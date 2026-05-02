/**
 * refresh-live-positions.ts
 *
 * Refresca todas las LivePositions para que la demo se vea "viva":
 *   · Mueve vehículos con ignition=true a posiciones nuevas
 *   · Sincroniza Asset.status con el estado derivado
 *   · Mantiene tracker timestamp en "ahora" para no caer en OFFLINE
 *
 * Reglas:
 *   1. Vehículos en MOVING · simulan movimiento · jitter en lat/lng,
 *      speedKmh entre 30-90 km/h, heading mantiene continuidad
 *   2. Vehículos en IDLE · motor encendido sin moverse · speedKmh=0,
 *      misma posición, updatedAt=ahora
 *   3. Vehículos STOPPED (apagados) · 70% se mantienen apagados,
 *      30% "arrancan" (transición a IDLE/MOVING)
 *   4. Vehículos OFFLINE (sin señal >24h) · 90% siguen offline,
 *      10% "vuelven" (transición a STOPPED)
 *
 * Usage:
 *   npx tsx prisma/refresh-live-positions.ts
 *   npx tsx prisma/refresh-live-positions.ts --aggressive  // todo MOVING
 *
 * Idempotente · podés correrlo todas las veces que quieras.
 */

import { PrismaClient, type AssetStatus } from "@prisma/client";

const db = new PrismaClient();

const AGGRESSIVE = process.argv.includes("--aggressive");

// Threshold de "moving" para sincronizar Asset.status
const MOVING_MIN_KMH = 5;

// Probabilidad de transiciones de estado por iteración
const STOPPED_TO_ON_PROB = AGGRESSIVE ? 0.7 : 0.15;
const OFFLINE_TO_BACK_PROB = AGGRESSIVE ? 0.5 : 0.1;
const ACTIVE_TO_OFF_PROB = AGGRESSIVE ? 0.05 : 0.1;

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function jitter(value: number, magnitude: number): number {
  return value + (Math.random() - 0.5) * magnitude * 2;
}

function deriveStatus(ignition: boolean, speedKmh: number): AssetStatus {
  if (!ignition) return "STOPPED";
  if (speedKmh > MOVING_MIN_KMH) return "MOVING";
  return "IDLE";
}

interface RefreshStats {
  total: number;
  moving: number;
  idle: number;
  stopped: number;
  offline: number;
}

async function main() {
  console.log("\n🔄 refresh-live-positions");
  console.log(`   Modo: ${AGGRESSIVE ? "AGGRESSIVE (todo en movimiento)" : "Normal"}`);
  console.time("refresh");

  const livePositions = await db.livePosition.findMany();
  console.log(`   ${livePositions.length} live positions encontradas`);

  const now = new Date();
  const stats: RefreshStats = { total: 0, moving: 0, idle: 0, stopped: 0, offline: 0 };

  for (const lp of livePositions) {
    const ageHours = (now.getTime() - lp.updatedAt.getTime()) / 3600000;
    const wasOffline = ageHours > 24;
    const wasOff = !lp.ignition;
    const wasMoving = lp.ignition && lp.speedKmh > MOVING_MIN_KMH;

    let newIgnition: boolean;
    let newSpeedKmh: number;
    let newLat = lp.lat;
    let newLng = lp.lng;
    let newHeading = lp.heading ?? Math.floor(rnd(0, 360));

    if (wasOffline) {
      // Vehículo "perdido" hace mucho · capaz vuelve
      if (Math.random() < OFFLINE_TO_BACK_PROB) {
        // Vuelve · arranca apagado
        newIgnition = false;
        newSpeedKmh = 0;
      } else {
        // Sigue offline · NO actualizamos updatedAt para que
        // siga siendo "viejo" y la lógica derivada lo mantenga
        // como OFFLINE.
        stats.offline += 1;
        stats.total += 1;
        continue;
      }
    } else if (wasOff) {
      // Apagado · capaz arranca
      if (Math.random() < STOPPED_TO_ON_PROB) {
        newIgnition = true;
        newSpeedKmh = Math.random() < 0.5 ? 0 : rnd(20, 70);
      } else {
        newIgnition = false;
        newSpeedKmh = 0;
      }
    } else if (wasMoving) {
      // En movimiento · sigue moviendo o se detiene
      if (Math.random() < ACTIVE_TO_OFF_PROB) {
        // Llegó a destino · apaga
        newIgnition = false;
        newSpeedKmh = 0;
      } else {
        // Sigue moviendo · jitter en velocidad y posición
        newIgnition = true;
        newSpeedKmh = Math.max(0, jitter(lp.speedKmh, 15));
        if (newSpeedKmh < MOVING_MIN_KMH) newSpeedKmh = rnd(30, 70);

        // Mover en dirección heading · ~0.0001-0.001 grados (~10-100m)
        // Aproximación grosera · suficiente para demo
        const distance = (newSpeedKmh / 3600) * 0.001; // grados aprox
        const radHeading = (newHeading * Math.PI) / 180;
        newLat += distance * Math.cos(radHeading);
        newLng += distance * Math.sin(radHeading);

        // Pequeño cambio de heading · ±15°
        newHeading = ((newHeading + Math.floor(rnd(-15, 15))) + 360) % 360;
      }
    } else {
      // En ralentí · capaz arranca a moverse o sigue ralentí
      newIgnition = true;
      if (Math.random() < 0.5) {
        newSpeedKmh = 0; // sigue ralentí
      } else {
        newSpeedKmh = rnd(20, 70); // arranca a moverse
        newHeading = Math.floor(rnd(0, 360));
      }
    }

    // En aggressive, fuerza todo a MOVING
    if (AGGRESSIVE) {
      newIgnition = true;
      newSpeedKmh = rnd(40, 90);
    }

    const newStatus = deriveStatus(newIgnition, newSpeedKmh);
    if (newStatus === "MOVING") stats.moving += 1;
    else if (newStatus === "IDLE") stats.idle += 1;
    else stats.stopped += 1;
    stats.total += 1;

    // Persistir
    await db.livePosition.update({
      where: { assetId: lp.assetId },
      data: {
        recordedAt: now,
        updatedAt: now,
        lat: newLat,
        lng: newLng,
        speedKmh: Math.round(newSpeedKmh * 10) / 10,
        heading: newHeading,
        ignition: newIgnition,
      },
    });

    // Sincronizar Asset.status (denormalizado · permite queries rápidos
    // en Catálogos que filtran por status sin join a LivePosition)
    await db.asset.update({
      where: { id: lp.assetId },
      data: { status: newStatus },
    });
  }

  console.log("\n📊 Resultado:");
  console.log(`   ${stats.moving} moving`);
  console.log(`   ${stats.idle} idle`);
  console.log(`   ${stats.stopped} stopped`);
  console.log(`   ${stats.offline} offline (sin actualizar)`);
  console.log(`   ${stats.total} total\n`);
  console.timeEnd("refresh");
}

main()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
