/**
 * ═══════════════════════════════════════════════════════════════
 *  Seed multi-tenant para testing flespi (I2)
 *  ─────────────────────────────────────────────────────────────
 *  Crea 4 cuentas con 3 users + 30 vehículos + 30 devices + 30
 *  sims + 10 conductores cada una.
 *
 *  Los IMEIs siguen un patrón predecible:
 *    Cuenta 1 (Transportes del Sur)    : 350612073987001-030
 *    Cuenta 2 (Frigoríficos Andinos)   : 350612073987031-060
 *    Cuenta 3 (Logística Norte)        : 350612073987061-090
 *    Cuenta 4 (Distribuidora Central)  : 350612073987091-120
 *
 *  Esto permite que cuando flespi reenvíe datos reales con el
 *  IMEI correspondiente, /api/ingest/flespi pueda matchearlos
 *  con el Device → Asset y persistir telemetría real.
 *
 *  Idempotencia: si una cuenta con el mismo slug ya existe, la
 *  saltea sin tocar nada. Para forzar recreación, usar primero:
 *    npx tsx prisma/wipe-flespi-test.ts   (no incluido · si lo
 *    necesitás avisame, pero por ahora preferimos no destruir
 *    datos existentes)
 *
 *  Uso:
 *    npx tsx prisma/seed-flespi-test.ts
 *
 *  El seed actual (prisma/seed.ts) NO se toca. Si vas a usar
 *  testing real con flespi, conviene tener una DB limpia y solo
 *  correr este seed (sin el de demo) para no mezclar datos.
 * ═══════════════════════════════════════════════════════════════
 */

import { PrismaClient, type Prisma } from "@prisma/client";

const db = new PrismaClient();

// ═══════════════════════════════════════════════════════════════
//  Specs declarativos · una source of truth para todo el seed
// ═══════════════════════════════════════════════════════════════

interface UserSpec {
  email: string;
  firstName: string;
  lastName: string;
  role: "CLIENT_ADMIN" | "OPERATOR";
}

interface AccountSpec {
  slug: string;
  name: string;
  industry: string;
  tier: "BASE" | "PRO" | "ENTERPRISE";
  imeiBase: number; // primer IMEI sufijo · ej 1, 31, 61, 91
  plateCountry: "AR" | "CL";
  vehicleMix: { type: "CAMION_LIVIANO" | "MAQUINA_VIAL" | "LIVIANO"; count: number }[];
  users: UserSpec[];
  driverNames: { first: string; last: string }[];
}

const IMEI_PREFIX = "350612073987"; // 12 dígitos, completar con 3 más
const ICCID_PREFIX = "895431012345678";  // 15 dígitos, completar con 4 más
const ASSETS_PER_ACCOUNT = 30;
const DRIVERS_PER_ACCOUNT = 10;

const ACCOUNTS: AccountSpec[] = [
  {
    slug: "transportes-del-sur",
    name: "Transportes del Sur",
    industry: "Transporte de carga general",
    tier: "PRO",
    imeiBase: 1,
    plateCountry: "AR",
    vehicleMix: [
      { type: "CAMION_LIVIANO", count: 22 },
      { type: "LIVIANO", count: 6 },
      { type: "MAQUINA_VIAL", count: 2 },
    ],
    users: [
      { email: "admin@transportes-del-sur.com.ar", firstName: "Roberto", lastName: "Giménez", role: "CLIENT_ADMIN" },
      { email: "operador1@transportes-del-sur.com.ar", firstName: "Marcela", lastName: "Quiroga", role: "OPERATOR" },
      { email: "operador2@transportes-del-sur.com.ar", firstName: "Diego", lastName: "Herrera", role: "OPERATOR" },
    ],
    driverNames: [
      { first: "Carlos", last: "Aguirre" },
      { first: "Hugo", last: "Méndez" },
      { first: "Pablo", last: "Romero" },
      { first: "Sergio", last: "Fernández" },
      { first: "Walter", last: "Rivera" },
      { first: "Néstor", last: "Pereyra" },
      { first: "Daniel", last: "Cabrera" },
      { first: "Marcos", last: "Vázquez" },
      { first: "Adrián", last: "Sosa" },
      { first: "Fabián", last: "Luna" },
    ],
  },
  {
    slug: "frigorificos-andinos",
    name: "Frigoríficos Andinos",
    industry: "Cadena de frío y carnes",
    tier: "ENTERPRISE",
    imeiBase: 31,
    plateCountry: "CL",
    vehicleMix: [
      { type: "CAMION_LIVIANO", count: 26 },
      { type: "LIVIANO", count: 4 },
    ],
    users: [
      { email: "admin@frigorificos-andinos.cl", firstName: "Patricia", lastName: "Vargas", role: "CLIENT_ADMIN" },
      { email: "operador1@frigorificos-andinos.cl", firstName: "Cristián", lastName: "Muñoz", role: "OPERATOR" },
      { email: "operador2@frigorificos-andinos.cl", firstName: "Verónica", lastName: "Salinas", role: "OPERATOR" },
    ],
    driverNames: [
      { first: "Felipe", last: "Reyes" },
      { first: "Manuel", last: "Tapia" },
      { first: "Rodrigo", last: "Castro" },
      { first: "Luis", last: "Espinoza" },
      { first: "Andrés", last: "Soto" },
      { first: "Patricio", last: "Bustamante" },
      { first: "Miguel", last: "Henríquez" },
      { first: "José", last: "Cortés" },
      { first: "Eduardo", last: "Valenzuela" },
      { first: "Jorge", last: "Sandoval" },
    ],
  },
  {
    slug: "logistica-norte",
    name: "Logística Norte SA",
    industry: "Distribución regional",
    tier: "PRO",
    imeiBase: 61,
    plateCountry: "AR",
    vehicleMix: [
      { type: "LIVIANO", count: 18 },
      { type: "CAMION_LIVIANO", count: 12 },
    ],
    users: [
      { email: "admin@logistica-norte.com.ar", firstName: "Lucía", lastName: "Bianchi", role: "CLIENT_ADMIN" },
      { email: "operador1@logistica-norte.com.ar", firstName: "Federico", lastName: "Acosta", role: "OPERATOR" },
      { email: "operador2@logistica-norte.com.ar", firstName: "Mónica", lastName: "Paredes", role: "OPERATOR" },
    ],
    driverNames: [
      { first: "Ezequiel", last: "Domínguez" },
      { first: "Mariano", last: "Coronel" },
      { first: "Leonardo", last: "Bustos" },
      { first: "Maximiliano", last: "Gómez" },
      { first: "Cristian", last: "Páez" },
      { first: "Gustavo", last: "Maldonado" },
      { first: "Esteban", last: "Núñez" },
      { first: "Julián", last: "Vega" },
      { first: "Hernán", last: "Morales" },
      { first: "Matías", last: "Ferreyra" },
    ],
  },
  {
    slug: "distribuidora-central",
    name: "Distribuidora Central",
    industry: "Última milla y reparto urbano",
    tier: "BASE",
    imeiBase: 91,
    plateCountry: "CL",
    vehicleMix: [
      { type: "LIVIANO", count: 24 },
      { type: "CAMION_LIVIANO", count: 6 },
    ],
    users: [
      { email: "admin@distribuidora-central.cl", firstName: "Camila", lastName: "Pizarro", role: "CLIENT_ADMIN" },
      { email: "operador1@distribuidora-central.cl", firstName: "Sebastián", lastName: "Lagos", role: "OPERATOR" },
      { email: "operador2@distribuidora-central.cl", firstName: "Daniela", lastName: "Yáñez", role: "OPERATOR" },
    ],
    driverNames: [
      { first: "Ignacio", last: "Ortiz" },
      { first: "Tomás", last: "Carvajal" },
      { first: "Vicente", last: "Pinto" },
      { first: "Bastián", last: "Olivares" },
      { first: "Joaquín", last: "Riveros" },
      { first: "Álvaro", last: "Toro" },
      { first: "Diego", last: "Vergara" },
      { first: "Mauricio", last: "Lara" },
      { first: "Nicolás", last: "Cortez" },
      { first: "Gabriel", last: "Quezada" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function imeiOf(suffix: number): string {
  return IMEI_PREFIX + String(suffix).padStart(3, "0");
}

function iccidOf(suffix: number): string {
  return ICCID_PREFIX + String(suffix).padStart(4, "0");
}

function vinOf(suffix: number): string {
  // 17 chars válidos · prefijo Volvo (1FUJBBCK) + numero secuencial
  return "1FUJBBCK57LX" + String(suffix).padStart(5, "0");
}

function plateOf(country: "AR" | "CL", suffix: number): string {
  if (country === "AR") {
    // Patente arg formato MERCOSUR · AB123CD
    const letters1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letters2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const a = letters1[(suffix * 7) % 26];
    const b = letters1[(suffix * 13) % 26];
    const c = letters2[(suffix * 5) % 26];
    const d = letters2[(suffix * 11) % 26];
    const num = String((suffix * 17) % 1000).padStart(3, "0");
    return `${a}${b}${num}${c}${d}`;
  } else {
    // Patente chilena · BBLL12 (4 letras + 2 números)
    const letters = "BCDFGHJKLPRSTVWXYZ"; // sin vocales (norma CL)
    const a = letters[(suffix * 3) % letters.length];
    const b = letters[(suffix * 7) % letters.length];
    const c = letters[(suffix * 11) % letters.length];
    const d = letters[(suffix * 17) % letters.length];
    const num = String((suffix * 13) % 100).padStart(2, "0");
    return `${a}${b}${c}${d}${num}`;
  }
}

function buildVehicleSpec(
  spec: AccountSpec,
  index: number,
): { name: string; vehicleType: "CAMION_LIVIANO" | "MAQUINA_VIAL" | "LIVIANO"; make: string; model: string; year: number } {
  // Distribuir vehículos según vehicleMix · index 0-29
  let cumulative = 0;
  let vehicleType: "CAMION_LIVIANO" | "MAQUINA_VIAL" | "LIVIANO" = "CAMION_LIVIANO";
  for (const m of spec.vehicleMix) {
    if (index < cumulative + m.count) {
      vehicleType = m.type;
      break;
    }
    cumulative += m.count;
  }

  // Make/model verosímiles según tipo
  const makesAndModels: Record<typeof vehicleType, [string, string][]> = {
    CAMION_LIVIANO: [
      ["Volvo", "FH540"],
      ["Scania", "R450"],
      ["Mercedes-Benz", "Actros 2545"],
      ["Iveco", "Stralis 460"],
      ["Volkswagen", "Constellation 24.280"],
    ],
    MAQUINA_VIAL: [
      ["Caterpillar", "966H"],
      ["Komatsu", "WA470"],
      ["Volvo", "L120F"],
    ],
    LIVIANO: [
      ["Ford", "Transit Custom"],
      ["Mercedes-Benz", "Sprinter 415"],
      ["Renault", "Master L3H2"],
      ["Fiat", "Ducato 2.3"],
      ["Iveco", "Daily 35S14"],
    ],
  };

  const list = makesAndModels[vehicleType];
  const [make, model] = list[index % list.length];
  const year = 2018 + (index % 7); // 2018-2024
  const unitNumber = String(index + 1).padStart(3, "0");

  return {
    name: `${make} ${model} #${unitNumber}`,
    vehicleType,
    make,
    model,
    year,
  };
}

function documentOf(country: "AR" | "CL", suffix: number): string {
  if (country === "AR") {
    // CUIT formato: 20-12345678-3
    return `20-${String(20000000 + suffix * 137).padStart(8, "0")}-${suffix % 10}`;
  } else {
    // RUT formato: 12.345.678-9
    const num = 10000000 + suffix * 137;
    const a = Math.floor(num / 1000000);
    const b = Math.floor((num % 1000000) / 1000);
    const c = num % 1000;
    return `${a}.${String(b).padStart(3, "0")}.${String(c).padStart(3, "0")}-${suffix % 10}`;
  }
}

// ═══════════════════════════════════════════════════════════════
//  Seed
// ═══════════════════════════════════════════════════════════════

async function findOrCreateOrg(): Promise<{ id: string; name: string }> {
  // Reusar la primera Org si existe · si no, crear "Maxtracker"
  const existing = await db.organization.findFirst();
  if (existing) {
    return { id: existing.id, name: existing.name };
  }
  console.log("[seed] no encontré Organization · creando 'Maxtracker'");
  const created = await db.organization.create({
    data: {
      name: "Maxtracker",
      slug: "maxtracker",
    },
  });
  return { id: created.id, name: created.name };
}

async function ensureProfiles(): Promise<{
  CLIENT_ADMIN: string;
  OPERATOR: string;
}> {
  const ca = await db.profile.findUnique({ where: { systemKey: "CLIENT_ADMIN" } });
  const op = await db.profile.findUnique({ where: { systemKey: "OPERATOR" } });
  if (!ca || !op) {
    throw new Error(
      "[seed] No encontré los Profiles CLIENT_ADMIN / OPERATOR. " +
        "Antes de correr este seed, asegurate que el seed base ya creó los profiles. " +
        "Corré: npx tsx prisma/force-seed-users.ts",
    );
  }
  return { CLIENT_ADMIN: ca.id, OPERATOR: op.id };
}

interface SeedSummary {
  account: string;
  status: "created" | "skipped";
  imei_range?: string;
  users_created?: number;
  assets_created?: number;
}

async function seedAccount(
  spec: AccountSpec,
  orgId: string,
  profiles: { CLIENT_ADMIN: string; OPERATOR: string },
): Promise<SeedSummary> {
  // Idempotencia: si la cuenta con este slug ya existe, no hacer nada
  const existing = await db.account.findUnique({ where: { slug: spec.slug } });
  if (existing) {
    return { account: spec.name, status: "skipped" };
  }

  console.log(`\n[seed] creando cuenta: ${spec.name} (${spec.slug})`);

  // ── 1. Account ────────────────────────────────────────────────
  const account = await db.account.create({
    data: {
      organizationId: orgId,
      name: spec.name,
      slug: spec.slug,
      tier: spec.tier,
      industry: spec.industry,
    },
  });

  // ── 2. Group "Flota principal" ───────────────────────────────
  const group = await db.group.create({
    data: {
      accountId: account.id,
      name: "Flota principal",
    },
  });

  // ── 3. Users ──────────────────────────────────────────────────
  for (const u of spec.users) {
    await db.user.create({
      data: {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash: `demo:${u.email}`,
        organizationId: orgId,
        accountId: account.id,
        profileId: u.role === "CLIENT_ADMIN" ? profiles.CLIENT_ADMIN : profiles.OPERATOR,
        status: "ACTIVE",
        language: "es-AR",
      },
    });
  }

  // ── 4. Persons (conductores) ─────────────────────────────────
  const driverIds: string[] = [];
  for (let i = 0; i < spec.driverNames.length; i++) {
    const d = spec.driverNames[i];
    const driver = await db.person.create({
      data: {
        accountId: account.id,
        firstName: d.first,
        lastName: d.last,
        document: documentOf(spec.plateCountry, spec.imeiBase + i),
        // Licencia válida por 1 a 3 años desde hoy (variado)
        licenseExpiresAt: new Date(
          Date.now() + (365 + (i * 137) % 730) * 24 * 60 * 60 * 1000,
        ),
        hiredAt: new Date(
          Date.now() - (365 + (i * 217) % 1500) * 24 * 60 * 60 * 1000,
        ),
      },
    });
    driverIds.push(driver.id);
  }

  // ── 5. Assets + Devices + SIMs ───────────────────────────────
  for (let i = 0; i < ASSETS_PER_ACCOUNT; i++) {
    const imeiSuffix = spec.imeiBase + i;
    const v = buildVehicleSpec(spec, i);
    const plate = plateOf(spec.plateCountry, imeiSuffix);
    const vin = vinOf(imeiSuffix);

    const asset = await db.asset.create({
      data: {
        accountId: account.id,
        groupId: group.id,
        name: v.name,
        plate,
        vin,
        vehicleType: v.vehicleType,
        make: v.make,
        model: v.model,
        year: v.year,
        initialOdometerKm: 50000 + (i * 7919) % 350000,
        // Asignar conductor a los primeros 10 vehículos (1 driver = 1 vehiculo)
        currentDriverId: i < driverIds.length ? driverIds[i] : null,
        status: "OFFLINE", // recién creado, sin telemetría · pasará a IDLE/MOVING al recibir
      },
    });

    // SIM
    const sim = await db.sim.create({
      data: {
        iccid: iccidOf(imeiSuffix),
        carrier: spec.plateCountry === "AR" ? "MOVISTAR" : "ENTEL",
        apn: spec.plateCountry === "AR" ? "internet.movistar.com.ar" : "bam.entelpcs.cl",
        phoneNumber: spec.plateCountry === "AR"
          ? `+5491156${String(imeiSuffix).padStart(6, "0")}`
          : `+5692${String(imeiSuffix * 13).padStart(7, "0").slice(-7)}`,
        dataPlanMb: 50,
        status: "ACTIVE",
        activatedAt: new Date(Date.now() - (i * 5 + 30) * 24 * 60 * 60 * 1000),
      },
    });

    // Device · status INSTALLED, asignado al asset, isPrimary
    await db.device.create({
      data: {
        assetId: asset.id,
        simId: sim.id,
        imei: imeiOf(imeiSuffix),
        serialNumber: `TLT-${imeiSuffix}`,
        vendor: "TELTONIKA",
        model: i % 5 === 0 ? "FMC130" : "FMB920",
        firmwareVersion: "03.27.07.Rev.00",
        status: "INSTALLED",
        isPrimary: true,
      },
    });
  }

  return {
    account: spec.name,
    status: "created",
    imei_range: `${imeiOf(spec.imeiBase)}-${imeiOf(spec.imeiBase + ASSETS_PER_ACCOUNT - 1)}`,
    users_created: spec.users.length,
    assets_created: ASSETS_PER_ACCOUNT,
  };
}

async function main() {
  console.log("═══ Maxtracker · Seed multi-tenant testing flespi (I2) ═══\n");

  const org = await findOrCreateOrg();
  console.log(`[seed] Organization: ${org.name} (${org.id})`);

  const profiles = await ensureProfiles();
  console.log(`[seed] Profiles OK: CLIENT_ADMIN, OPERATOR`);

  const summaries: SeedSummary[] = [];
  for (const spec of ACCOUNTS) {
    const summary = await seedAccount(spec, org.id, profiles);
    summaries.push(summary);
  }

  // ── Resumen final ──────────────────────────────────────────────
  console.log("\n═══ RESUMEN ═══\n");

  for (const s of summaries) {
    if (s.status === "skipped") {
      console.log(`  ⏭  ${s.account} · YA EXISTÍA · saltada`);
    } else {
      console.log(`  ✓  ${s.account}`);
      console.log(`     IMEIs: ${s.imei_range}`);
      console.log(`     ${s.assets_created} vehículos · ${s.users_created} users · 10 conductores`);
    }
  }

  console.log("\n═══ USERS PARA LOGIN ═══\n");
  console.log("Estos son los emails para testing. La cookie demo");
  console.log("(mxt-demo-user-id) actualmente acepta el primer SA · usá");
  console.log("el switcher de identidad del topbar para cambiar a estos:\n");

  for (const acc of ACCOUNTS) {
    console.log(`  · ${acc.name}:`);
    for (const u of acc.users) {
      console.log(`      ${u.email}  (${u.role})`);
    }
  }

  console.log("\n═══ TESTING FLESPI ═══\n");
  console.log("Ahora cuando flespi mande datos con un IMEI entre");
  console.log(`  ${imeiOf(1)} y ${imeiOf(120)}`);
  console.log("el endpoint POST /api/ingest/flespi va a matchearlo");
  console.log("contra el Device → Asset y persistir la position.\n");

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
