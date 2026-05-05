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
import { seedUsersAndProfiles } from "./seed-users";
import { join } from "node:path";

faker.seed(42);
faker.setDefaultRefDate(new Date("2026-04-24T12:00:00Z"));

const db = new PrismaClient();

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

// S3-L4.3 · NOW dinámico · siembra hasta el momento de correr el script.
// Antes era hardcodeado a "2026-04-24" y los datos siempre quedaban
// desactualizados respecto al día de la demo.
const NOW = new Date();
const MS_DAY = 24 * 60 * 60 * 1000;
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

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
  await db.user.deleteMany();
  await db.profile.deleteMany();
  await db.assetDriverDay.deleteMany();
  await db.trip.deleteMany();
  await db.livePosition.deleteMany();
  await db.alarm.deleteMany();
  await db.event.deleteMany();
  await db.position.deleteMany();
  await db.device.deleteMany();
  await db.sim.deleteMany();
  await db.assetWeeklyStats.deleteMany();
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

    // Crear primero la SIM · después el Device la referencia.
    // Distribuimos carriers por seed determinístico para variedad.
    const carrierPick = ["MOVISTAR", "CLARO", "PERSONAL"][totalAssets % 3] as
      | "MOVISTAR"
      | "CLARO"
      | "PERSONAL";
    const apnPick =
      carrierPick === "MOVISTAR"
        ? "internet.movistar.com.ar"
        : carrierPick === "CLARO"
          ? "internet.ctimovil.com.ar"
          : "internet.personal.com";

    const sim = await db.sim.create({
      data: {
        iccid: faker.string.numeric(20),
        phoneNumber: `+54 11 ${faker.string.numeric(4)}-${faker.string.numeric(4)}`,
        imsi: faker.string.numeric(15),
        carrier: carrierPick,
        apn: apnPick,
        dataPlanMb: spec.vehicleType === "TRUCK" ? 250 : 100,
        status: "ACTIVE",
        activatedAt: faker.date.past({ years: 1, refDate: NOW }),
      },
    });

    await db.device.create({
      data: {
        assetId: asset.id,
        imei: faker.string.numeric(15),
        vendor: "TELTONIKA",
        model: deviceModel,
        status: "INSTALLED",
        isPrimary: true,
        simId: sim.id,
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

  // ── Trip rollup (F1) ─────────────────────────────────────────
  // Detect trips from Position once at seed time and persist them
  // into the Trip table. The UI never iterates Position again ·
  // listTrips and getTripRoutes both read from Trip directly.
  // Each trip carries its simplified polyline as JSON (~80 pts).
  console.log("   · detecting and persisting trips…");
  let totalTrips = 0;
  for (const a of allAssets) {
    if (a.mobility === "FIXED") continue;
    const created = await persistTripsForAsset(a.id);
    totalTrips += created;
  }
  console.log(`   ✓ ${totalTrips} trips persisted`);

  // ── LivePosition rollup (E6-A) ───────────────────────────────────
  // For each asset that ever reported, take the latest Position
  // row and write it into LivePosition. In production this row
  // is overwritten on every fix received by the ingester · here
  // we snapshot it once at seed time so the listado de vehículos
  // can show "Velocidad instantánea" without hitting Position.
  console.log("   · computing LivePosition snapshot…");
  let livePosCount = 0;
  for (const a of allAssets) {
    const last = await db.position.findFirst({
      where: { assetId: a.id },
      orderBy: { recordedAt: "desc" },
      select: {
        recordedAt: true,
        lat: true,
        lng: true,
        speedKmh: true,
        heading: true,
        ignition: true,
      },
    });
    if (!last) continue;
    await db.livePosition.create({
      data: {
        assetId: a.id,
        recordedAt: last.recordedAt,
        lat: last.lat,
        lng: last.lng,
        speedKmh: last.speedKmh,
        heading: last.heading,
        ignition: last.ignition,
      },
    });
    livePosCount++;
  }
  console.log(`   ✓ ${livePosCount} live positions snapped`);

  // ── AssetDriverDay rollup (E5-A) ────────────────────────────────
  // Detect trips from Position once at seed time and roll them up
  // by (asset, day, driver). Driver rotation is simulated: each
  // asset draws a deterministic pool of 3 candidate drivers from
  // its account (currentDriver + 2 more) and rotates through them
  // by day. In production this table is the output of a daily
  // batch job · the UI never sees this code path.
  console.log("   · computing AssetDriverDay rollup…");
  let totalDriverDays = 0;
  await rollupAssetDriverDays(allAssets, allPersons);
  totalDriverDays = await db.assetDriverDay.count();
  console.log(`   ✓ ${totalDriverDays} asset-driver-day rows`);

  // ── AssetWeeklyStats rollup (Actividad · A1) ─────────────────────
  // Aggregates daily rows into weekly buckets (Mon-Sun, AR-local) +
  // pulls Event counts for the same week. Used by the Resumen and
  // Comparativas pages to compute deltas vs historical baselines.
  console.log("   · computing AssetWeeklyStats rollup…");
  await db.assetWeeklyStats.deleteMany();
  await rollupAssetWeeklyStats(allAssets);
  const totalWeeklyStats = await db.assetWeeklyStats.count();
  console.log(`   ✓ ${totalWeeklyStats} asset-weekly-stats rows`);

  // ── Users & Profiles (Lote F1 · fundamentos auth) ────────────────
  // Crea 4 perfiles builtin + 8 usuarios demo (1 SA, 1 MA, 3 CA, 3 OP)
  // cubriendo los 3 accounts seedeados. Auth real con Auth0 viene en
  // v1.1+ · por ahora sesión simulada con cookie + switcher demo.
  console.log("   · seeding users and profiles…");
  await seedUsersAndProfiles(db);

  // ── Summary ──────────────────────────────────────────────────────
  console.timeEnd("seed");
  console.log("");
  console.log("✅  Seed complete");
  console.log("   Open Prisma Studio: npm run db:studio");
  console.log("   Browse debug page:  /debug");
}

/**
 * Build AssetDriverDay rollup from the Trip table (F1).
 *
 * Driver rotation is simulated · for each asset we pick a pool of
 * 3 candidate drivers from the same account (current + 2 more,
 * deterministic by hash of assetId) and rotate by day index. Each
 * persisted Trip already has a personId resolved at trip-creation
 * time (see persistTripsForAsset · uses the same pool logic), so
 * here we just bucket by (asset, person, day).
 */
async function rollupAssetDriverDays(
  allAssets: { id: string; accountId: string; mobility: MobilityType }[],
  _allPersons: { id: string; accountId: string }[],
): Promise<void> {

  for (const a of allAssets) {
    if (a.mobility === "FIXED") continue;

    const trips = await db.trip.findMany({
      where: { assetId: a.id, personId: { not: null } },
      orderBy: { startedAt: "asc" },
      select: {
        personId: true,
        startedAt: true,
        endedAt: true,
        durationMs: true,
        distanceKm: true,
        idleMs: true,
      },
    });
    if (trips.length === 0) continue;

    interface DayBucket {
      personId: string;
      distanceKm: number;
      activeMs: number;
      tripCount: number;
      firstTripAt: Date;
      lastTripAt: Date;
    }
    const buckets = new Map<string, DayBucket>(); // key: dayISO|personId

    for (const t of trips) {
      const personId = t.personId!;
      const dayISO = ymdAr(t.startedAt.getTime(), AR_OFFSET_MS);
      const key = `${dayISO}|${personId}`;
      const activeMs = Math.max(0, t.durationMs - t.idleMs);
      const existing = buckets.get(key);
      if (existing) {
        existing.distanceKm += t.distanceKm;
        existing.activeMs += activeMs;
        existing.tripCount += 1;
        if (t.startedAt < existing.firstTripAt)
          existing.firstTripAt = t.startedAt;
        if (t.endedAt > existing.lastTripAt) existing.lastTripAt = t.endedAt;
      } else {
        buckets.set(key, {
          personId,
          distanceKm: t.distanceKm,
          activeMs,
          tripCount: 1,
          firstTripAt: t.startedAt,
          lastTripAt: t.endedAt,
        });
      }
    }

    const rows = Array.from(buckets.entries()).map(([key, b]) => {
      const dayISO = key.split("|")[0]!;
      const dayUtc = new Date(`${dayISO}T00:00:00.000Z`);
      const dayStart = new Date(dayUtc.getTime() + AR_OFFSET_MS);
      return {
        accountId: a.accountId,
        assetId: a.id,
        personId: b.personId,
        day: dayStart,
        distanceKm: Math.round(b.distanceKm * 10) / 10,
        activeMin: Math.round(b.activeMs / 60_000),
        tripCount: b.tripCount,
        firstTripAt: b.firstTripAt,
        lastTripAt: b.lastTripAt,
      };
    });

    while (rows.length > 0) {
      const chunk = rows.splice(0, 200);
      await db.assetDriverDay.createMany({ data: chunk });
    }
  }
}

/**
 * Build AssetWeeklyStats rollup from AssetDriverDay + Event + Trip.
 *
 * Buckets are AR-local Mon-Sun. We anchor each driver-day to its
 * containing week (Monday 00:00 AR · UTC instant 03:00 of Monday).
 *
 * Per-week aggregates (per asset):
 *   · distanceKm     · sum of AssetDriverDay.distanceKm
 *   · activeMin      · sum of AssetDriverDay.activeMin
 *   · idleMin        · approximated as 25% of activeMin · placeholder
 *   · activeDays     · distinct days of AssetDriverDay rows
 *   · tripCount      · sum of AssetDriverDay.tripCount
 *   · eventCount     · count of Event rows with assetId in week
 *   · highEventCount · same, severity HIGH or CRITICAL
 *   · speedingCount  · same, type matches isSpeedingType
 *   · maxSpeedKmh    · max of Trip.maxSpeedKmh in week (else 0)
 *   · fuelLiters     · approximated as activeMin × 0.12 (~7L/h)
 */
async function rollupAssetWeeklyStats(
  allAssets: { id: string; accountId: string; mobility: MobilityType }[],
): Promise<void> {
  const mobileAssets = allAssets.filter((a) => a.mobility === "MOBILE");

  for (const asset of mobileAssets) {
    // 1 · pull AssetDriverDay for this asset
    const driverDays = await db.assetDriverDay.findMany({
      where: { assetId: asset.id },
      select: {
        day: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
      },
    });
    if (driverDays.length === 0) continue;

    // 2 · pull events for this asset in the same date range
    const minDay: Date = driverDays.reduce(
      (m: Date, d: { day: Date }) => (d.day < m ? d.day : m),
      driverDays[0]!.day,
    );
    const maxDay: Date = driverDays.reduce(
      (m: Date, d: { day: Date }) => (d.day > m ? d.day : m),
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

    // 3 · bucket by week-start UTC instant
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
      if (t === "SPEEDING" || t === "OVER_SPEED" || t.includes("SPEED"))
        acc.speedingCount += 1;
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
    while (rows.length > 0) {
      const chunk = rows.splice(0, 200);
      await db.assetWeeklyStats.createMany({ data: chunk });
    }
  }
}

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
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Detect trips from Position for one asset and persist them into
 * the Trip table. Each Trip carries its simplified polyline as
 * JSON. Returns the number of trips created.
 *
 * Driver assignment per trip uses the same deterministic pool as
 * the AssetDriverDay rollup so both rollups agree.
 *
 * Trip detection mirrors src/lib/queries/trips.ts thresholds:
 *   · trip starts on ignition ON
 *   · trip ends on ignition OFF, or on a 15-min gap with ignition
 *   · drop trips < 5 min OR < 0.5 km
 */
async function persistTripsForAsset(assetId: string): Promise<number> {
  const TRIP_GAP_MS = 15 * 60 * 1000;
  const MIN_TRIP_MS = 5 * 60 * 1000;
  const MIN_TRIP_KM = 0.5;
  const MAX_SEGMENT_MS = 5 * 60 * 1000;
  /** Target polyline density per Trip · stride decimation hits this */
  const TARGET_POINTS_PER_TRIP = 80;

  // ── Build driver rotation pool for this asset ──────────────
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: { accountId: true, currentDriverId: true },
  });
  if (!asset) return 0;
  const accountPersons = await db.person.findMany({
    where: { accountId: asset.accountId },
    select: { id: true },
  });
  if (accountPersons.length === 0) return 0;
  const pool = buildDriverPool(
    asset.currentDriverId,
    accountPersons.map((p: { id: string }) => p.id),
    assetId,
  );

  // ── Pull positions in chronological order ─────────────────
  const positions = await db.position.findMany({
    where: { assetId },
    orderBy: { recordedAt: "asc" },
    select: {
      recordedAt: true,
      lat: true,
      lng: true,
      speedKmh: true,
      ignition: true,
    },
  });
  if (positions.length < 2) return 0;

  // ── Detect trips ───────────────────────────────────────────
  interface DetectedTrip {
    startIdx: number;
    endIdx: number;
    startedAt: Date;
    endedAt: Date;
    distanceKm: number;
    activeMs: number;
    idleMs: number;
    maxSpeedKmh: number;
  }
  const trips: DetectedTrip[] = [];

  let inTrip = false;
  let tripStart = 0;
  let tripStartIdx = 0;
  let lastIgnIdx = -1;

  const finishTrip = (endIdx: number) => {
    if (!inTrip) return;
    let dist = 0;
    let activeMs = 0;
    let idleMs = 0;
    let maxSpeedKmh = 0;
    for (let j = tripStartIdx + 1; j <= endIdx; j++) {
      const prev = positions[j - 1]!;
      const cur = positions[j]!;
      if (cur.speedKmh > maxSpeedKmh) maxSpeedKmh = cur.speedKmh;
      if (prev.ignition) {
        dist += haversineKmSeed(prev.lat, prev.lng, cur.lat, cur.lng);
        const dt = cur.recordedAt.getTime() - prev.recordedAt.getTime();
        const segMs = Math.min(dt, MAX_SEGMENT_MS);
        if (cur.speedKmh < 3 && prev.speedKmh < 3) {
          idleMs += segMs;
        } else {
          activeMs += segMs;
        }
      }
    }
    const durMs = positions[endIdx]!.recordedAt.getTime() - tripStart;
    if (durMs >= MIN_TRIP_MS && dist >= MIN_TRIP_KM) {
      trips.push({
        startIdx: tripStartIdx,
        endIdx,
        startedAt: new Date(tripStart),
        endedAt: positions[endIdx]!.recordedAt,
        distanceKm: dist,
        activeMs,
        idleMs,
        maxSpeedKmh,
      });
    }
    inTrip = false;
  };

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!;
    if (p.ignition) {
      if (!inTrip) {
        inTrip = true;
        tripStart = p.recordedAt.getTime();
        tripStartIdx = i;
      }
      if (lastIgnIdx >= 0) {
        const gap =
          p.recordedAt.getTime() -
          positions[lastIgnIdx]!.recordedAt.getTime();
        if (gap > TRIP_GAP_MS) {
          finishTrip(lastIgnIdx);
          inTrip = true;
          tripStart = p.recordedAt.getTime();
          tripStartIdx = i;
        }
      }
      lastIgnIdx = i;
    } else if (inTrip) {
      finishTrip(i);
    }
  }
  if (inTrip) finishTrip(positions.length - 1);

  if (trips.length === 0) return 0;

  // ── Pull events for this asset once · we'll bucket per trip
  const allEvents = await db.event.findMany({
    where: { assetId },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true, severity: true },
  });

  // ── Build Trip rows · simplify polyline + count events ────
  const rows = trips.map((t) => {
    // Simplify polyline by stride (Douglas-Peucker is overkill
    // for the demo · stride decimation hits the target count).
    const len = t.endIdx - t.startIdx + 1;
    const stride = Math.max(1, Math.floor(len / TARGET_POINTS_PER_TRIP));
    const polyline: number[][] = [];
    for (let i = t.startIdx; i <= t.endIdx; i += stride) {
      const p = positions[i]!;
      polyline.push([p.lat, p.lng]);
    }
    // Always include the very last point
    const last = positions[t.endIdx]!;
    const tail = polyline[polyline.length - 1];
    if (!tail || tail[0] !== last.lat || tail[1] !== last.lng) {
      polyline.push([last.lat, last.lng]);
    }

    // Count events that fall inside the trip window
    let evCount = 0;
    let evHigh = 0;
    for (const e of allEvents) {
      const ms = e.occurredAt.getTime();
      if (ms < t.startedAt.getTime()) continue;
      if (ms > t.endedAt.getTime()) break;
      evCount++;
      if (e.severity === "HIGH" || e.severity === "CRITICAL") evHigh++;
    }

    // Driver assignment by day index (same logic as
    // AssetDriverDay rollup so both tables agree).
    const dayIdx = Math.floor(
      (t.startedAt.getTime() - AR_OFFSET_MS) / MS_DAY,
    );
    const personId = pool.length > 0 ? pool[dayIdx % pool.length]! : null;

    const startP = positions[t.startIdx]!;
    const endP = positions[t.endIdx]!;
    const durationMs = t.endedAt.getTime() - t.startedAt.getTime();
    const movingMs = Math.max(1, durationMs - t.idleMs);
    const avgSpeedKmh = t.distanceKm / (movingMs / 3_600_000);

    return {
      assetId,
      personId,
      startedAt: t.startedAt,
      endedAt: t.endedAt,
      durationMs,
      distanceKm: Math.round(t.distanceKm * 100) / 100,
      avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
      maxSpeedKmh: Math.round(t.maxSpeedKmh * 10) / 10,
      idleMs: t.idleMs,
      startLat: startP.lat,
      startLng: startP.lng,
      endLat: endP.lat,
      endLng: endP.lng,
      positionCount: len,
      polylineJson: JSON.stringify(polyline),
      eventCount: evCount,
      highSeverityEventCount: evHigh,
    };
  });

  // ── Persist in chunks ─────────────────────────────────────
  let count = 0;
  while (rows.length > 0) {
    const chunk = rows.splice(0, 100);
    await db.trip.createMany({ data: chunk });
    count += chunk.length;
  }
  return count;
}

/**
 * Build a deterministic 3-driver pool for an asset.
 * Always includes the current driver if set; fills the rest from
 * the account roster picked by a stable hash of the asset id.
 */
function buildDriverPool(
  currentDriverId: string | null,
  candidates: string[],
  assetId: string,
): string[] {
  const pool: string[] = [];
  if (currentDriverId && candidates.includes(currentDriverId)) {
    pool.push(currentDriverId);
  }
  // Stable hash of assetId · simple djb2 variant
  let h = 5381;
  for (let i = 0; i < assetId.length; i++) {
    h = ((h << 5) + h + assetId.charCodeAt(i)) & 0xffffffff;
  }
  const others = candidates.filter((c) => c !== currentDriverId);
  if (others.length === 0) return pool;
  // Rotate the candidates list by hash, then take the first 2
  const start = Math.abs(h) % others.length;
  for (let i = 0; i < Math.min(2, others.length); i++) {
    pool.push(others[(start + i) % others.length]!);
  }
  return pool;
}

function ymdAr(ts: number, offsetMs: number): string {
  const local = new Date(ts - offsetMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysSinceEpochAr(ts: number, offsetMs: number): number {
  return Math.floor((ts - offsetMs) / MS_DAY);
}

function haversineKmSeed(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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
