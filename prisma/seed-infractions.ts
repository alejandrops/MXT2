// ═══════════════════════════════════════════════════════════════
//  Conducción · seed-infractions
//  ─────────────────────────────────────────────────────────────
//  Backfill de Infraction desde las Position generadas por el
//  seed principal. Se invoca al final de seed.ts cuando todos
//  los assets y posiciones están persistidos.
//
//  Pasos:
//    1. Para cada Position sin roadType, asignar uno heurístico
//       desde la velocidad (necesario porque no tenemos OSM real
//       en el demo · cuando llegue el ingestor de Flespi este
//       paso desaparece).
//    2. Para cada Asset con vehicleType ≠ ASSET_FIJO, ejecutar
//       computeInfractions sobre sus Position del período seed.
//    3. Crear los registros Infraction con createMany.
//    4. Resolver direcciones de inicio/fin con un placeholder
//       (post-MVP · llamar Nominatim cacheado).
//
//  Idempotente · al iniciar borra todas las Infraction del account
//  para no acumular duplicados entre re-seeds.
// ═══════════════════════════════════════════════════════════════

import type { PrismaClient, VehicleType } from "@prisma/client";
import {
  computeInfractions,
  inferRoadTypeFromSpeed,
} from "../src/lib/conduccion/compute-infractions";
import { parseGeofence } from "../src/lib/conduccion/resolve-vmax";
import type { ResolvedGeofence, SpeedSample } from "../src/lib/conduccion/types";

export async function seedInfractions(db: PrismaClient): Promise<void> {
  console.log("");
  console.log("┌─ Backfill de Infracciones ────────────────────────────");

  // ─── 0. Limpiar infracciones previas (idempotencia) ──────────
  const deleted = await db.infraction.deleteMany({});
  if (deleted.count > 0) {
    console.log(`│  · borradas ${deleted.count} infracciones previas`);
  }

  // ─── 1. Asignar roadType heurístico a Position que no lo tienen
  // Hacemos un update masivo SQL-style por bandas de velocidad.
  // Es mucho más rápido que iterar Position por Position con
  // Prisma update individual.
  console.log(`│  · asignando roadType heurístico a Position…`);
  const beforeWithoutRoadType = await db.position.count({
    where: { roadType: null },
  });

  if (beforeWithoutRoadType > 0) {
    await db.position.updateMany({
      where: { roadType: null, speedKmh: { lte: 0 } },
      data: { roadType: "DESCONOCIDO" },
    });
    await db.position.updateMany({
      where: { roadType: null, speedKmh: { gt: 0, lte: 50 } },
      data: { roadType: "URBANO_CALLE" },
    });
    await db.position.updateMany({
      where: { roadType: null, speedKmh: { gt: 50, lte: 80 } },
      data: { roadType: "URBANO_AVENIDA" },
    });
    await db.position.updateMany({
      where: { roadType: null, speedKmh: { gt: 80, lte: 100 } },
      data: { roadType: "RURAL" },
    });
    await db.position.updateMany({
      where: { roadType: null, speedKmh: { gt: 100 } },
      data: { roadType: "AUTOPISTA" },
    });
    console.log(`│    ✓ ${beforeWithoutRoadType} Position con roadType asignado`);
  }

  // ─── 2. Cargar todos los assets candidatos (no-fijos) ────────
  const accounts = await db.account.findMany({ select: { id: true, name: true } });
  let totalCreated = 0;
  let totalSegments = 0;

  for (const account of accounts) {
    // Pre-cargar geofences activas de este account
    const geofenceRows = await db.geofence.findMany({
      where: { accountId: account.id, active: true },
      select: {
        id: true,
        name: true,
        polygonGeoJson: true,
        vmaxOverrideJson: true,
        priority: true,
      },
    });
    const geofences: ResolvedGeofence[] = geofenceRows.map(parseGeofence);

    const assets = await db.asset.findMany({
      where: { accountId: account.id, vehicleType: { not: "ASSET_FIJO" } },
      select: {
        id: true,
        vehicleType: true,
        currentDriverId: true,
      },
    });

    let accountInfractions = 0;
    let accountSegments = 0;

    for (const asset of assets) {
      const positions = await db.position.findMany({
        where: { assetId: asset.id },
        orderBy: { recordedAt: "asc" },
        select: {
          recordedAt: true,
          lat: true,
          lng: true,
          speedKmh: true,
          roadType: true,
        },
      });

      if (positions.length < 2) continue;

      const samples: SpeedSample[] = positions.map((p) => ({
        recordedAt: p.recordedAt,
        lat: p.lat,
        lng: p.lng,
        speedKmh: p.speedKmh,
        roadType: p.roadType ?? inferRoadTypeFromSpeed(p.speedKmh),
      }));

      const detected = computeInfractions({
        samples,
        vehicleType: asset.vehicleType as VehicleType,
        geofences,
      });

      accountSegments += detected.length;
      if (detected.length === 0) continue;

      // Persistir en batch
      await db.infraction.createMany({
        data: detected.map((inf) => {
          const firstSample = inf.samples[0]!;
          const lastSample = inf.samples[inf.samples.length - 1]!;
          return {
            accountId: account.id,
            assetId: asset.id,
            driverId: asset.currentDriverId,
            startedAt: inf.startedAt,
            endedAt: inf.endedAt,
            durationSec: inf.durationSec,
            vmaxKmh: inf.vmaxKmh,
            peakSpeedKmh: inf.peakSpeedKmh,
            maxExcessKmh: inf.maxExcessKmh,
            distanceMeters: inf.distanceMeters,
            severity: inf.severity,
            vehicleType: asset.vehicleType as VehicleType,
            roadType: inf.roadType,
            startLat: firstSample.lat,
            startLon: firstSample.lng,
            endLat: lastSample.lat,
            endLon: lastSample.lng,
            // Direcciones quedan null en MVP · post-MVP llamar Nominatim
            startAddress: null,
            endAddress: null,
            trackJson: inf.trackJson,
          };
        }),
      });

      accountInfractions += detected.length;
    }

    totalCreated += accountInfractions;
    totalSegments += accountSegments;
    console.log(
      `│  · ${account.name.padEnd(26)} · ${assets.length.toString().padStart(3)} assets · ${accountInfractions.toString().padStart(5)} infracciones`,
    );
  }

  console.log(`│`);
  console.log(`│  ✓ Total: ${totalCreated} infracciones creadas`);
  console.log("└────────────────────────────────────────────────────");
}
