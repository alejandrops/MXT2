// ═══════════════════════════════════════════════════════════════
//  Maxtracker · Deterministic Seed
//  ─────────────────────────────────────────────────────────────
//  Generates a coherent fictional dataset for the Seguridad
//  vertical slice of Lote 1.
//
//  Determinism: faker.seed(42) is set once at the top so that
//  every run produces identical data. This means demos are
//  reproducible across machines and presentations.
//
//  Scale (from project memory + Lote 1 plan):
//    · 1   Organization
//    · 3   Accounts (Logística · Minería · Delivery)
//    · 6   Groups (with one 2-level subhierarchy)
//    · 80  Assets (40 trucks · 25 mining · 15 motos)
//    ·  5  Fixed assets (silos)  (counted in the 25 mining)
//    · 60  Persons (drivers/operators)
//    · 80  Devices (one primary per asset)
//    · ~15k Positions (last 30 days)
//    · ~400 Events
//    · ~80  Alarms
//
//  Run:    npm run db:seed
//  Reset:  npm run db:reset && npm run db:seed
// ═══════════════════════════════════════════════════════════════

import {
  PrismaClient,
  type AssetStatus,
  type EventType,
  type Severity,
  type AlarmType,
  type AlarmStatus,
  type AlarmDomain,
  type MobilityType,
} from "@prisma/client";
import { faker } from "@faker-js/faker";
import {
  ROUTE_BSAS_MAR_DEL_PLATA,
  ROUTE_BSAS_BAHIA_BLANCA,
  ROUTE_GBA_REPARTO,
  ROUTE_GBA_NORTE,
  ROUTE_GBA_SUR,
  ROUTE_MENDOZA_SAN_RAFAEL,
  ROUTE_PATAGONIA_COMODORO,
  ROUTE_PATAGONIA_CALETA,
  ROUTE_MINA_CATAMARCA,
  FIXED_SILO_POSITIONS,
  CABA_BOUNDS,
  TRUCK_MODELS,
  MINING_VEHICLES,
  MOTORCYCLE_MODELS,
  SILO_MODELS,
  type Route,
  type Waypoint,
} from "./seed-data/geo";
import { REAL_VEHICLES } from "./seed-data/real-vehicles";
import { parseRealCsv } from "./seed-data/parse-real-csv";
import { join } from "node:path";

faker.seed(42);
faker.setDefaultRefDate(new Date("2026-04-24T12:00:00Z"));

const db = new PrismaClient();

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

const NOW = new Date("2026-04-24T12:00:00Z");
const MS_DAY = 24 * 60 * 60 * 1000;

function pick<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("pick from empty array");
  const idx = faker.number.int({ min: 0, max: arr.length - 1 });
  // Non-null assertion safe: idx is bounded to arr length
  return arr[idx]!;
}

function weightedPick<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let r = faker.number.float({ min: 0, max: total });
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  // Fallback for floating point edge case
  return entries[entries.length - 1]![0];
}

function jitter(value: number, magnitude = 0.0005): number {
  return value + faker.number.float({ min: -magnitude, max: magnitude });
}

/**
 * Linearly interpolate along a route (sequence of waypoints).
 * t ∈ [0, 1]; t=0 is route start, t=1 is route end.
 */
function interpolateRoute(route: Route, t: number): Waypoint {
  if (route.length < 2) throw new Error("route must have ≥2 waypoints");
  if (t <= 0) return route[0]!;
  if (t >= 1) return route[route.length - 1]!;

  const totalSegments = route.length - 1;
  const scaled = t * totalSegments;
  const segIdx = Math.floor(scaled);
  const localT = scaled - segIdx;

  const a = route[segIdx]!;
  const b = route[Math.min(segIdx + 1, route.length - 1)]!;
  return [
    a[0] + (b[0] - a[0]) * localT,
    a[1] + (b[1] - a[1]) * localT,
  ];
}

function pointInBounds(b: { latMin: number; latMax: number; lngMin: number; lngMax: number }): Waypoint {
  return [
    faker.number.float({ min: b.latMin, max: b.latMax }),
    faker.number.float({ min: b.lngMin, max: b.lngMax }),
  ];
}

function severityFromEventType(type: EventType): Severity {
  // Conducción
  if (type === "SPEEDING") {
    return weightedPick({ LOW: 10, MEDIUM: 40, HIGH: 35, CRITICAL: 15 });
  }

  // Seguridad · always elevated
  const ALWAYS_CRITICAL: EventType[] = [
    "PANIC_BUTTON",
    "SABOTAGE",
    "JAMMING_DETECTED",
    "TRAILER_DETACH",
  ];
  if (ALWAYS_CRITICAL.includes(type)) return "CRITICAL";

  const ALWAYS_HIGH: EventType[] = [
    "UNAUTHORIZED_USE",
    "GPS_DISCONNECT",
    "POWER_DISCONNECT",
    "CARGO_DOOR_OPEN",
  ];
  if (ALWAYS_HIGH.includes(type)) {
    return weightedPick({ LOW: 0, MEDIUM: 10, HIGH: 70, CRITICAL: 20 });
  }

  // Default distribution for the rest
  return weightedPick({ LOW: 30, MEDIUM: 45, HIGH: 20, CRITICAL: 5 });
}

/**
 * Maps an EventType to its corresponding (AlarmDomain, AlarmType)
 * pair when escalating to an alarm. Returns null if the event
 * type doesn't naturally escalate.
 */
function mapEventToAlarm(
  type: EventType,
): { domain: AlarmDomain; type: AlarmType } | null {
  // Conducción · driver behavior escalations
  if (type === "SPEEDING") {
    return { domain: "CONDUCCION", type: "SPEEDING_CRITICAL" };
  }
  if (
    type === "HARSH_BRAKING" ||
    type === "HARSH_ACCELERATION" ||
    type === "HARSH_CORNERING"
  ) {
    return { domain: "CONDUCCION", type: "HARSH_DRIVING_PATTERN" };
  }

  // Seguridad · threats / sabotage
  if (type === "PANIC_BUTTON") return { domain: "SEGURIDAD", type: "PANIC" };
  if (type === "UNAUTHORIZED_USE")
    return { domain: "SEGURIDAD", type: "UNAUTHORIZED_USE" };
  if (type === "SABOTAGE")
    return { domain: "SEGURIDAD", type: "SABOTAGE" };
  if (type === "GPS_DISCONNECT")
    return { domain: "SEGURIDAD", type: "GPS_DISCONNECT" };
  if (type === "POWER_DISCONNECT")
    return { domain: "SEGURIDAD", type: "POWER_DISCONNECT" };
  if (type === "JAMMING_DETECTED")
    return { domain: "SEGURIDAD", type: "JAMMING" };
  if (type === "TRAILER_DETACH")
    return { domain: "SEGURIDAD", type: "TRAILER_DETACH" };
  if (type === "CARGO_DOOR_OPEN")
    return { domain: "SEGURIDAD", type: "CARGO_BREACH" };
  if (type === "DOOR_OPEN" || type === "SIDE_DOOR_OPEN")
    return { domain: "SEGURIDAD", type: "DOOR_BREACH" };
  if (type === "GEOFENCE_ENTRY" || type === "GEOFENCE_EXIT")
    return { domain: "SEGURIDAD", type: "GEOFENCE_BREACH_CRITICAL" };

  // IDLING / IGNITION_ON / IGNITION_OFF don't escalate
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Reset
// ═══════════════════════════════════════════════════════════════

async function reset() {
  // Delete in reverse FK order. SQLite doesn't enforce FKs unless
  // pragma is enabled, but Prisma respects relation deletes.
  await db.alarm.deleteMany();
  await db.event.deleteMany();
  await db.position.deleteMany();
  await db.device.deleteMany();
  await db.asset.deleteMany();
  await db.person.deleteMany();
  await db.group.deleteMany();
  await db.account.deleteMany();
  await db.organization.deleteMany();
}

// ═══════════════════════════════════════════════════════════════
//  Account specifications (declarative, not generated)
// ═══════════════════════════════════════════════════════════════

interface AccountSpec {
  name: string;
  slug: string;
  industry: string;
  tier: "BASE" | "PRO" | "ENTERPRISE";
  groups: GroupSpec[];
  fleet: FleetSpec;
  personCount: number;
}

interface GroupSpec {
  name: string;
  subgroups?: string[];
}

interface FleetSpec {
  count: number;
  mobility: MobilityType;
  vehicleType: "TRUCK" | "MINING" | "MOTORCYCLE" | "SILO";
  routes: Route[];
}

const ACCOUNTS: AccountSpec[] = [
  {
    name: "Transportes del Sur SA",
    slug: "transportes-del-sur",
    industry: "Logística larga distancia",
    tier: "ENTERPRISE",
    groups: [
      { name: "Larga distancia" },
      { name: "Reparto urbano" },
      { name: "Refrigerados" },
    ],
    fleet: {
      count: 40,
      mobility: "MOBILE",
      vehicleType: "TRUCK",
      routes: [
        ROUTE_BSAS_MAR_DEL_PLATA,
        ROUTE_BSAS_BAHIA_BLANCA,
        ROUTE_GBA_REPARTO,
      ],
    },
    personCount: 30,
  },
  {
    name: "Minera La Cumbre",
    slug: "minera-la-cumbre",
    industry: "Minería",
    tier: "ENTERPRISE",
    groups: [
      {
        name: "Operativa",
        subgroups: ["Carga pesada", "Acarreo"],
      },
      { name: "Apoyo" },
    ],
    fleet: {
      count: 25, // 20 mobile + 5 silos
      mobility: "MOBILE", // overridden per-asset for silos
      vehicleType: "MINING",
      routes: [ROUTE_MINA_CATAMARCA],
    },
    personCount: 20,
  },
  {
    name: "Rappi Cono Sur",
    slug: "rappi-cono-sur",
    industry: "Delivery last-mile",
    tier: "PRO",
    groups: [{ name: "Flota CABA" }],
    fleet: {
      count: 15,
      mobility: "MOBILE",
      vehicleType: "MOTORCYCLE",
      routes: [], // bounds-based, not route-based
    },
    personCount: 10,
  },
];

// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════

/**
 * Maps a region label (used by REAL_VEHICLES) to a Route. The
 * route is used as a fallback in case the real CSV import fails;
 * normally the real positions take precedence.
 */
function regionToRoute(
  region: "GBA" | "Cuyo" | "Patagonia" | "NOA" | "Pampa",
): Route {
  switch (region) {
    case "Cuyo":
      return ROUTE_MENDOZA_SAN_RAFAEL;
    case "Patagonia":
      // Pick one of the two patagonia routes
      return faker.datatype.boolean()
        ? ROUTE_PATAGONIA_COMODORO
        : ROUTE_PATAGONIA_CALETA;
    case "NOA":
    case "Pampa":
      // Use the long-haul Mendoza route as a generic placeholder.
      // The actual positions come from the CSV anyway; this is
      // only used if the CSV import fails.
      return ROUTE_MENDOZA_SAN_RAFAEL;
    case "GBA":
    default:
      return faker.helpers.arrayElement([
        ROUTE_GBA_REPARTO,
        ROUTE_GBA_NORTE,
        ROUTE_GBA_SUR,
      ]);
  }
}

async function main() {
  console.log("🌱  Seed start");
  console.time("seed");

  await reset();
  console.log("   ✓ DB reset");

  // ── Organization ──────────────────────────────────────────────
  const org = await db.organization.create({
    data: {
      name: "Maxtracker Demo",
      slug: "maxtracker-demo",
    },
  });

  // ── Accounts + Groups + Persons + Assets + Devices ────────────
  const allAssets: { id: string; accountId: string; route: Route | null; bounds: keyof typeof CABA_BOUNDS | null; mobility: MobilityType; status: AssetStatus; realCsvFile?: string }[] = [];
  const allPersons: { id: string; accountId: string }[] = [];

  let totalGroups = 0;
  let totalAssets = 0;
  let totalPersons = 0;
  let totalDevices = 0;
  const allAccounts: { id: string; name: string }[] = [];

  for (const spec of ACCOUNTS) {
    // Account
    const account = await db.account.create({
      data: {
        organizationId: org.id,
        name: spec.name,
        slug: spec.slug,
        tier: spec.tier,
        industry: spec.industry,
      },
    });
    allAccounts.push({ id: account.id, name: account.name });

    // Groups (with optional 2-level hierarchy)
    const groupsByName: Record<string, string> = {};
    for (const g of spec.groups) {
      const parent = await db.group.create({
        data: { accountId: account.id, name: g.name },
      });
      groupsByName[g.name] = parent.id;
      totalGroups++;
      if (g.subgroups) {
        for (const sgName of g.subgroups) {
          const sg = await db.group.create({
            data: {
              accountId: account.id,
              name: sgName,
              parentId: parent.id,
            },
          });
          groupsByName[sgName] = sg.id;
          totalGroups++;
        }
      }
    }
    const groupIds = Object.values(groupsByName);

    // Persons
    const personsForAccount: { id: string }[] = [];
    for (let i = 0; i < spec.personCount; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const p = await db.person.create({
        data: {
          accountId: account.id,
          firstName,
          lastName,
          document: faker.number.int({ min: 20000000, max: 45000000 }).toString(),
          licenseExpiresAt: faker.date.future({ years: 2, refDate: NOW }),
          hiredAt: faker.date.past({ years: 5, refDate: NOW }),
          // Initial score, will be recomputed after events are seeded.
          safetyScore: faker.number.int({ min: 50, max: 95 }),
        },
      });
      personsForAccount.push({ id: p.id });
      allPersons.push({ id: p.id, accountId: account.id });
      totalPersons++;
    }

    // ─── Synthetic assets removed ──────────────────────────
    //  Previously this block created hundreds of synthetic assets
    //  with simulated trajectories. We now use exclusively the
    //  REAL_VEHICLES catalog (real CSV-backed trajectories) below.
    //
    //  Synthetic Persons are still created above so we have driver
    //  candidates to assign to the real vehicles.

  }

  console.log(`   ✓ ${ACCOUNTS.length} accounts · ${totalGroups} groups · ${totalPersons} persons · ${totalAssets} assets · ${totalDevices} devices`);

  // ─── Real-trajectory vehicles (the only fleet now) ──────────────
  // Create the 23 vehicles from the REAL_VEHICLES catalog. Their
  // positions come from CSV exports of the production system.
  console.log("   · creating real-trajectory vehicles…");
  const firstAccount = allAccounts[0]!;
  const firstAccountGroups: { id: string }[] = await db.group.findMany({
    where: { accountId: firstAccount.id },
    select: { id: true },
  });
  const realPersons = allPersons.filter((p) => p.accountId === firstAccount.id);
  let realVehicleCount = 0;

  for (const spec of REAL_VEHICLES) {
    const route = regionToRoute(spec.region);
    const driverId =
      realPersons.length > 0 ? pick(realPersons).id : null;
    const groupId =
      firstAccountGroups.length > 0 ? pick(firstAccountGroups).id : null;

    const asset = await db.asset.create({
      data: {
        accountId: firstAccount.id,
        groupId,
        name: spec.name,
        plate: spec.plate,
        vin: faker.vehicle.vin(),
        mobilityType: "MOBILE",
        vehicleType: spec.vehicleType,
        make: spec.make,
        model: spec.model,
        year: faker.number.int({ min: 2019, max: 2024 }),
        status: "MOVING",
        currentDriverId: driverId,
      },
    });

    // Pick a device model based on vehicle type · trucks usually
    // ship full-featured FMB devices, motorcycles use lighter ones.
    const deviceModel = spec.vehicleType === "MOTORCYCLE" ? "FMB001" : "FMB920";

    await db.device.create({
      data: {
        assetId: asset.id,
        imei: faker.string.numeric(15),
        vendor: "Teltonika",
        model: deviceModel,
        isPrimary: true,
        installedAt: faker.date.past({ years: 2, refDate: NOW }),
        lastSeenAt: faker.date.recent({ days: 1, refDate: NOW }),
      },
    });

    allAssets.push({
      id: asset.id,
      accountId: firstAccount.id,
      route,
      bounds: null,
      mobility: "MOBILE",
      status: "MOVING",
      realCsvFile: spec.csvFile,
    });
    totalAssets++;
    totalDevices++;
    realVehicleCount++;
  }
  console.log(`   ✓ ${realVehicleCount} real-trajectory vehicles created`);

  // ── Synthetic positions removed ──────────────────────────
  //  All positions now come from the real CSV importer below.
  let totalPositions = 0;


  // ── Synthetic demo-day positions removed ────────────────
  //  Real CSVs cover the demo day naturally · no synthesis needed.


  // ─── Import real trajectories from CSV exports (Sub-lote 3.4) ──
  // These positions belong to the 12 vehicles flagged with
  // `realCsvFile` and replace the synthetic demo-day for them.
  // The import re-anchors timestamps so they fall on "yesterday"
  // regardless of the actual date of the export file.
  console.log("   · importing real trajectories…");
  let realPositions = 0;
  let realEvents = 0;

  for (const a of allAssets) {
    if (!a.realCsvFile) continue;

    const csvPath = join(
      process.cwd(),
      "prisma",
      "seed-data",
      "real-trajectories",
      a.realCsvFile,
    );
    let parsed;
    try {
      parsed = parseRealCsv(csvPath);
    } catch (err) {
      console.warn(`   ⚠ could not parse ${a.realCsvFile}:`, (err as Error).message);
      continue;
    }

    if (parsed.positions.length === 0) {
      console.warn(`   ⚠ ${a.realCsvFile} produced 0 positions`);
      continue;
    }

    // No re-anchor: keep the CSV's original timestamps. The
    // demo will show data on the actual dates from the export
    // (e.g. 23/04 and 24/04). Operators pick those dates from
    // the date filter; the default date logic on the page
    // points to the latest date with data so they don't have
    // to guess.
    const shiftMs = 0;

    // Insert positions in chunks of 200 (SQLite param limit)
    const positionRows = parsed.positions.map((p) => ({
      assetId: a.id,
      recordedAt: new Date(p.recordedAt.getTime() + shiftMs),
      receivedAt: new Date(p.receivedAt.getTime() + shiftMs),
      lat: p.lat,
      lng: p.lng,
      speedKmh: p.speedKmh,
      heading: p.heading,
      ignition: p.ignition,
    }));
    while (positionRows.length > 0) {
      const chunk = positionRows.splice(0, 200);
      await db.position.createMany({ data: chunk });
      realPositions += chunk.length;
      totalPositions += chunk.length;
    }

    // Insert events too (from the same CSV)
    const eventRows = parsed.events.map((e) => ({
      assetId: a.id,
      personId: null, // real CSVs don't carry our person IDs
      type: e.type,
      severity: e.severity,
      occurredAt: new Date(e.occurredAt.getTime() + shiftMs),
      lat: e.lat,
      lng: e.lng,
      speedKmh: e.speedKmh,
      metadata: e.metadata,
    }));
    while (eventRows.length > 0) {
      const chunk = eventRows.splice(0, 200);
      await db.event.createMany({ data: chunk });
      realEvents += chunk.length;
    }
  }
  console.log(`   ✓ ${realPositions} real positions, ${realEvents} real events imported`);

  // ── Events (last 30 days) ───────────────────────────────────────
  // These are SYNTHETIC events with personId attached; they power
  // the Safety Dashboard (which aggregates events per person).
  // Real CSVs already brought their own events (no personId · the
  // CSVs don't have a "Chofer" column populated yet); both sets
  // coexist in the Event table.
  console.log("   · generating events…");
  let totalEvents = 0;
  const eventsByPerson: Record<string, { severity: Severity }[]> = {};
  for (const a of allAssets) {
    if (a.mobility === "FIXED") continue; // silos don't drive
    if (a.status === "OFFLINE") continue;

    // ── Eventos de CONDUCCIÓN (driver behavior) ──────────────
    // These come from telemetry-derived patterns. Higher volume,
    // mostly LOW/MEDIUM, only some HIGH/CRITICAL escalate later.
    const conduccionCount = faker.number.int({ min: 3, max: 7 });
    for (let i = 0; i < conduccionCount; i++) {
      const type = weightedPick({
        HARSH_BRAKING:      35,
        SPEEDING:           28,
        HARSH_ACCELERATION: 14,
        HARSH_CORNERING:    10,
        IDLING:             8,
        IGNITION_ON:        2.5,
        IGNITION_OFF:       2.5,
      });
      await createEvent(a, type);
    }

    // ── Eventos de SEGURIDAD (threats / sabotage) ────────────
    // Lower volume, but each one matters. ~0-2 per asset on
    // average, distributed by realistic frequency.
    const seguridadCount = faker.number.int({ min: 0, max: 2 });
    for (let i = 0; i < seguridadCount; i++) {
      const type = weightedPick({
        // Most common: openings during operation
        DOOR_OPEN:          25,
        SIDE_DOOR_OPEN:     18,
        CARGO_DOOR_OPEN:    12,
        // Connectivity / power tampering
        GPS_DISCONNECT:     12,
        POWER_DISCONNECT:   8,
        // Geofence-related (transversal but read as security)
        GEOFENCE_ENTRY:     8,
        GEOFENCE_EXIT:      6,
        // Severe / rare
        UNAUTHORIZED_USE:   5,
        TRAILER_DETACH:     3,
        PANIC_BUTTON:       1.5,
        SABOTAGE:           0.8,
        JAMMING_DETECTED:   0.7,
      });
      await createEvent(a, type);
    }
  }

  // ── Helper that creates an Event row given asset + type ────
  // Closure over allPersons, NOW, jitter, etc. defined above.
  async function createEvent(
    a: typeof allAssets[number],
    type: EventType,
  ) {
    const severity = severityFromEventType(type);

    let lat: number | undefined, lng: number | undefined;
    if (a.route) {
      const wp = interpolateRoute(
        a.route,
        faker.number.float({ min: 0, max: 1 }),
      );
      lat = jitter(wp[0], 0.002);
      lng = jitter(wp[1], 0.002);
    } else if (a.bounds) {
      const pt = pointInBounds(CABA_BOUNDS[a.bounds]);
      lat = pt[0];
      lng = pt[1];
    }

    // 70% of events have a person attached (the one driving)
    const personId = faker.datatype.boolean({ probability: 0.7 })
      ? pick(allPersons.filter((p) => p.accountId === a.accountId)).id
      : null;

    const ageMs = faker.number.float({ min: 0, max: 30 * MS_DAY });
    const occurredAt = new Date(NOW.getTime() - ageMs);

    await db.event.create({
      data: {
        assetId: a.id,
        personId,
        type,
        severity,
        occurredAt,
        lat,
        lng,
        speedKmh:
          type === "SPEEDING"
            ? faker.number.float({ min: 100, max: 145 })
            : faker.number.float({ min: 0, max: 80 }),
        metadata: JSON.stringify({ source: "demo-seed" }),
      },
    });
    totalEvents++;

    if (personId) {
      eventsByPerson[personId] ??= [];
      eventsByPerson[personId]!.push({ severity });
    }
  }
  console.log(`   ✓ ${totalEvents} events`);

  // ── Alarms (subset of HIGH/CRITICAL events escalate) ────────────
  console.log("   · generating alarms…");
  const candidateEvents = await db.event.findMany({
    where: { severity: { in: ["HIGH", "CRITICAL"] } },
    take: 200,
    orderBy: { occurredAt: "desc" },
  });

  let totalAlarms = 0;
  for (const ev of candidateEvents) {
    // ~50% of HIGH/CRITICAL events escalate to alarm
    if (!faker.datatype.boolean({ probability: 0.5 })) continue;

    // Map EventType → (AlarmDomain, AlarmType)
    const mapping = mapEventToAlarm(ev.type as EventType);
    if (!mapping) continue;
    const { domain, type: alarmType } = mapping;

    const status: AlarmStatus = weightedPick({
      OPEN: 30,
      ATTENDED: 35,
      CLOSED: 30,
      DISMISSED: 5,
    });

    const triggeredAt = ev.occurredAt;
    const attendedAt = status !== "OPEN"
      ? new Date(triggeredAt.getTime() + faker.number.int({ min: 60_000, max: 30 * 60_000 }))
      : null;
    const closedAt = (status === "CLOSED" || status === "DISMISSED") && attendedAt
      ? new Date(attendedAt.getTime() + faker.number.int({ min: 5 * 60_000, max: 4 * 60 * 60_000 }))
      : null;

    // Find the asset to know which account it belongs to
    const asset = await db.asset.findUnique({ where: { id: ev.assetId }, select: { accountId: true } });
    if (!asset) continue;

    await db.alarm.create({
      data: {
        accountId: asset.accountId,
        assetId: ev.assetId,
        personId: ev.personId,
        domain,
        type: alarmType,
        severity: ev.severity,
        status,
        triggeredAt,
        attendedAt,
        closedAt,
        lat: ev.lat,
        lng: ev.lng,
        notes: status === "CLOSED" ? faker.helpers.arrayElement([
          "Conductor reportó condición climática adversa.",
          "Verificado vía cámara, falsa alarma.",
          "Llamada al chofer, situación normalizada.",
          "Mantenimiento programado revisó el vehículo.",
          "Operador de seguridad confirmó situación normalizada.",
        ]) : null,
      },
    });
    totalAlarms++;
  }
  console.log(`   ✓ ${totalAlarms} alarms`);

  // ── Recompute Person.safetyScore from their events ──────────────
  console.log("   · recomputing person safety scores…");
  for (const [personId, events] of Object.entries(eventsByPerson)) {
    const score = computeSafetyScore(events);
    await db.person.update({
      where: { id: personId },
      data: { safetyScore: score },
    });
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.timeEnd("seed");
  console.log("");
  console.log("✅  Seed complete");
  console.log("   Open Prisma Studio: npm run db:studio");
  console.log("   Browse debug page:  /debug");
}

/**
 * Penalty-based score (0-100) starting at 100.
 * Each event subtracts according to severity.
 */
function computeSafetyScore(events: { severity: Severity }[]): number {
  const penalty = events.reduce((acc, e) => {
    if (e.severity === "CRITICAL") return acc + 12;
    if (e.severity === "HIGH") return acc + 6;
    if (e.severity === "MEDIUM") return acc + 2;
    return acc + 0.5;
  }, 0);
  return Math.max(20, Math.min(100, Math.round(100 - penalty)));
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
