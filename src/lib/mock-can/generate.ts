// ═══════════════════════════════════════════════════════════════
//  src/lib/mock-can/generate.ts
//  ─────────────────────────────────────────────────────────────
//  Generación determinística de datos CAN bus para la simulación
//  demo · los mismos inputs producen siempre los mismos outputs.
//
//  Filosofía:
//    · Cada asset tiene un baseline estable derivado de su ID
//      (odómetro inicial, horas motor, eficiencia base, etc)
//    · El tick produce variaciones suaves alrededor del baseline
//      reactivas a velocidad/ignición y al wallClockMs
//    · Sin estado mutable · la función es pure
//
//  Realismo:
//    · Calibrado para diesel pesado tipo Iveco/Mercedes/Scania
//      operando en transporte regional argentino
//    · Valores plausibles según ranges de Teltonika FMC003 docs
//    · DTC codes y eventos discretos usan probabilidades bajas
//      (5-10%) para que aparezcan en el demo sin saturar
// ═══════════════════════════════════════════════════════════════

import type { CanSnapshot, DeviceCapabilities } from "./types";

// ── Hash determinístico por assetId ──────────────────────────
// Convierte un string en un número 32-bit estable y bien distribuido.
// FNV-1a · simple, rápido, sin dependencias.
function hashAssetId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0; // unsigned
}

/** PRNG mulberry32 seedeado · da floats en [0,1) determinísticos */
function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Helper · valor en rango [min, max] determinístico por seed */
function range(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

// ── Capabilities por asset · estable de por vida del demo ───
// 80% de la flota tiene CAN (FMC003) · 20% son equipos legacy o
// FMB920 (solo GPS, sin acceso CAN). Esto hace que el UI muestre
// el patrón mixto que pidió el PO ("si no hay CAN, "—").
export function getDeviceCapabilities(assetId: string): DeviceCapabilities {
  const seed = hashAssetId(assetId);
  const rand = seededRand(seed);
  const r = rand();
  if (r < 0.7) return { hasCanBus: true, deviceModel: "FMC003" };
  if (r < 0.8) return { hasCanBus: true, deviceModel: "FMC130" };
  if (r < 0.92) return { hasCanBus: false, deviceModel: "FMB920" };
  return { hasCanBus: false, deviceModel: "Legacy" };
}

// ── Generador principal de snapshot ─────────────────────────
//
// Inputs:
//   · assetId · seed estable por vehículo
//   · speedKmh · velocidad actual del tick
//   · ignition · motor encendido?
//   · wallClockMs · timestamp del tick (afecta fuel decay y odom)
//
// Output:
//   · null si el vehículo no tiene CAN (legacy o FMB920)
//   · CanSnapshot con valores plausibles si tiene CAN
export function generateCanSnapshot(
  assetId: string,
  speedKmh: number,
  ignition: boolean,
  wallClockMs: number,
): CanSnapshot | null {
  const caps = getDeviceCapabilities(assetId);
  if (!caps.hasCanBus) return null;

  // Baseline determinístico por asset · NO depende de wallClock
  const seed = hashAssetId(assetId);
  const rand = seededRand(seed);

  // Características intrínsecas del vehículo · estables
  const baselineOdometerKm = Math.round(range(rand, 50_000, 280_000));
  const baselineEngineHours = Math.round(range(rand, 1_500, 9_000));
  // Eficiencia base · cubre flota mixta LATAM:
  //   · diesel pesado (camiones, buses) · 2.5-5 km/L típico
  //   · utilitarios medianos · 5-9 km/L
  //   · autos livianos · 9-13 km/L
  // Distribución: 60% pesado/mediano (banda baja-media), 40% liviano.
  // Esto da consumos plausibles de 7.7 a 40 L/100km en el demo.
  const isHeavyDuty = rand() < 0.6;
  const baselineFuelEfficiencyKmL = isHeavyDuty
    ? range(rand, 2.5, 6.5)
    : range(rand, 7.0, 13.0);
  const baselineEcoSkill = range(rand, 0.5, 1.0); // qué tan eco es el conductor
  const ptoEnabled = rand() < 0.15; // ~15% de la flota es operativa con PTO

  // ── RPM ──────────────────────────────────────────────────
  // Idle 700 · luego sube con velocidad (curva no-lineal típica
  // de diesel pesado · cambia de marcha a 30, 55, 80 km/h)
  let rpm: number;
  if (!ignition) {
    rpm = 0;
  } else if (speedKmh < 1) {
    rpm = 700 + range(rand, -50, 80);
  } else if (speedKmh < 30) {
    rpm = 1200 + speedKmh * 20 + range(rand, -100, 100);
  } else if (speedKmh < 55) {
    rpm = 1400 + (speedKmh - 30) * 15 + range(rand, -100, 100);
  } else if (speedKmh < 85) {
    rpm = 1600 + (speedKmh - 55) * 10 + range(rand, -80, 80);
  } else {
    rpm = 2000 + (speedKmh - 85) * 12 + range(rand, -80, 100);
  }
  rpm = Math.max(0, Math.round(rpm));

  // ── Temperatura motor ────────────────────────────────────
  // Sube con uso · ronda 85-95°C cuando trabaja · 60-70 al arrancar
  let engineTempC: number;
  if (!ignition) {
    // Después de apagar baja gradualmente · simulamos 75°C residual
    engineTempC = 75 + range(rand, -15, 5);
  } else if (speedKmh < 5) {
    engineTempC = 82 + range(rand, -5, 5);
  } else {
    engineTempC = 88 + range(rand, -3, 7);
  }
  engineTempC = Math.round(engineTempC * 10) / 10;

  // ── Presión aceite ───────────────────────────────────────
  // Nula sin motor, sube con RPM
  const oilPressureKpa = !ignition
    ? 0
    : Math.round(180 + (rpm / 3000) * 220 + range(rand, -20, 20));

  // ── Combustible ──────────────────────────────────────────
  // Nivel decae a lo largo del día · arranca 100% a las 06:00 AR,
  // baja al 40% al final del turno · resetea diariamente.
  // Modelo simple: tomamos hora del día (0-24) y escalamos.
  const dayMs = 86_400_000;
  const dayProgress = (wallClockMs % dayMs) / dayMs; // 0..1
  // Ajuste: queremos que arranque alto en la mañana operativa.
  // Aprox: nivel = 100 - dayProgress * 60 (decae linealmente)
  const fuelLevelPct = Math.max(
    8,
    Math.min(100, 100 - dayProgress * 60 + range(rand, -8, 8)),
  );

  // Consumo instantáneo · depende de velocidad y eficiencia base
  // Diesel pesado · 25-45 L/100km típico
  let fuelConsumptionLper100km: number;
  if (!ignition || speedKmh < 1) {
    fuelConsumptionLper100km = 0; // detenido o apagado
  } else {
    // Bajo en crucero (60-80 km/h), alto en idle/arranque o velocidad alta
    const baseConsumption = 100 / baselineFuelEfficiencyKmL; // L/100km baseline
    const speedFactor =
      speedKmh < 20
        ? 1.5 // arrancando, ineficiente
        : speedKmh < 70
          ? 1.0 // crucero óptimo
          : 1.0 + (speedKmh - 70) * 0.015; // sube con velocidad alta
    fuelConsumptionLper100km =
      baseConsumption * speedFactor + range(rand, -2, 2);
  }
  fuelConsumptionLper100km = Math.round(fuelConsumptionLper100km * 10) / 10;

  const fuelEfficiencyKmL =
    fuelConsumptionLper100km > 0
      ? Math.round((100 / fuelConsumptionLper100km) * 100) / 100
      : 0;

  // ── Odómetro real ──────────────────────────────────────────
  // Baseline + delta acumulado del día (aproximación · suma plausible).
  // No es 100% real porque no llevamos estado entre ticks, pero el
  // valor avanza monótonamente con wallClock que es lo que importa
  // para visualizar · al pasar a schema real (Sprint 2) este cálculo
  // se reemplaza por el odómetro persistido.
  const todayKmTraveled = dayProgress * range(rand, 80, 320); // distintos kms por asset
  const odometerKm = Math.round(baselineOdometerKm + todayKmTraveled);

  // ── Horas motor ─────────────────────────────────────────────
  // Suman cuando ignition true · aprox proporcional al dayProgress
  // y a si es vehículo de mucho uso o no.
  const todayEngineHours = dayProgress * range(rand, 4, 11);
  const engineHours = Math.round((baselineEngineHours + todayEngineHours) * 10) / 10;

  // ── Idle seconds today ──────────────────────────────────────
  // Si la velocidad es baja con ignition, sumamos idle.
  // Aprox · 5-15% del tiempo activo es idle · varía por conductor.
  const idleSecondsToday = Math.round(
    dayProgress * range(rand, 600, 4_200),
  );

  // ── PTO active ──────────────────────────────────────────────
  // Solo si el vehículo tiene PTO habilitado · activa en escenarios
  // específicos (detenido con motor, o usando accesorio).
  const ptoActive =
    ptoEnabled &&
    ignition &&
    speedKmh < 5 &&
    (Math.floor(wallClockMs / 60_000) % 7 === 0); // ciclos esporádicos

  // ── Eventos discretos ────────────────────────────────────
  // Probabilidades bajas para que aparezcan ocasionalmente
  const doorEventRand = seededRand(seed ^ Math.floor(wallClockMs / 30_000));
  const doorOpen = doorEventRand() < 0.04 && speedKmh < 5;

  const seatbeltOk = ignition ? rand() > 0.05 : true; // 5% cinturón mal puesto
  const parkingBrake = !ignition || speedKmh < 1;

  // ── DTC codes ────────────────────────────────────────────
  // ~8% de assets tienen 1-2 codes activos · muestra la realidad
  // de una flota mixta con vehículos de distintas edades.
  const dtcCodes: string[] = [];
  if (rand() < 0.08) {
    const codePool = [
      "P0301", // misfire cilindro 1
      "P0420", // catalizador eficiencia
      "P0455", // EVAP large leak
      "U0100", // lost comm with ECM
      "P0171", // sistema mezcla pobre
      "P2002", // particulate filter
    ];
    const codeIdx = Math.floor(rand() * codePool.length);
    dtcCodes.push(codePool[codeIdx]!);
    if (rand() < 0.3) {
      const i2 = (codeIdx + 1 + Math.floor(rand() * 3)) % codePool.length;
      dtcCodes.push(codePool[i2]!);
    }
  }

  // ── Eco score ────────────────────────────────────────────
  // Combina baseline del conductor con la suavidad de la conducción
  // actual · eventos de aceleración brusca bajan el score temporal.
  const ecoBase = baselineEcoSkill * 100;
  const ecoVariation = ignition ? range(rand, -8, 8) : 0;
  const ecoScore = Math.max(
    0,
    Math.min(100, Math.round(ecoBase + ecoVariation)),
  );

  return {
    rpm,
    engineTempC,
    oilPressureKpa,
    fuelLevelPct: Math.round(fuelLevelPct * 10) / 10,
    fuelConsumptionLper100km,
    fuelEfficiencyKmL,
    odometerKm,
    engineHours,
    idleSecondsToday,
    ptoActive,
    doorOpen,
    seatbeltOk,
    parkingBrake,
    dtcCodes,
    ecoScore,
  };
}
