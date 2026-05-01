// ═══════════════════════════════════════════════════════════════
//  seed-prod-users.ts (H2)
//  ─────────────────────────────────────────────────────────────
//  Reset de users · arrancamos producción limpia.
//
//  · Borra TODOS los users + todas las accounts del seed
//    flespi-test (las 4 con slug `transportes-del-sur`,
//    `frigorificos-andinos`, `logistica-norte`, `distribuidora-central`)
//  · Borra los users del seed.ts demo si quedaban
//  · Crea SOLO a Alejandro como SUPER_ADMIN
//
//  El seed flespi-test se puede correr DESPUÉS de este si querés
//  rearmar las 4 cuentas para testing de ingestion.
//
//  Uso:
//    npx tsx prisma/seed-prod-users.ts
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ADMIN_EMAIL = "alejandrops@gmail.com";
const ADMIN_FIRST_NAME = "Alejandro";
const ADMIN_LAST_NAME = "Sánchez";

async function main() {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("seed-prod-users · reset limpio para producción");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // ── 1. Verificar Organization ──
  const org = await db.organization.findFirst({
    where: { slug: "maxtracker" },
  });
  if (!org) {
    console.error("❌ No hay Organization 'maxtracker'.");
    console.error("   Crear primero con el INSERT del setup H1.");
    process.exit(1);
  }
  console.log(`✓ Organization: ${org.name}`);

  // ── 2. Verificar perfiles del sistema ──
  const profiles = await db.profile.findMany({
    where: { systemKey: { in: ["SUPER_ADMIN", "MAXTRACKER_ADMIN", "CLIENT_ADMIN", "OPERATOR"] } },
  });
  if (profiles.length < 4) {
    console.error("❌ Faltan perfiles del sistema.");
    console.error("   Ejecutá force-seed-users.ts primero para crearlos.");
    process.exit(1);
  }
  const superAdminProfile = profiles.find((p) => p.systemKey === "SUPER_ADMIN")!;
  console.log(`✓ Profiles: ${profiles.map((p) => p.systemKey).join(", ")}`);

  // ── 3. Borrar users + datos asociados ──
  console.log("");
  console.log("Borrando users existentes…");

  // Cualquier referencia "currentDriver" rota · limpiamos antes
  await db.asset.updateMany({ data: { currentDriverId: null } });

  // Borrar trips · derivados · pueden regenerarse
  const trips = await db.trip.deleteMany({});
  console.log(`  · ${trips.count} trips borrados`);

  const positions = await db.position.deleteMany({});
  console.log(`  · ${positions.count} positions borradas`);

  const livePositions = await db.livePosition.deleteMany({});
  console.log(`  · ${livePositions.count} live positions borradas`);

  // Borrar persons (drivers)
  const persons = await db.person.deleteMany({});
  console.log(`  · ${persons.count} persons borradas`);

  // Borrar SIMs y Devices
  const sims = await db.sim.deleteMany({});
  console.log(`  · ${sims.count} sims borradas`);

  const devices = await db.device.deleteMany({});
  console.log(`  · ${devices.count} devices borrados`);

  // Borrar assets
  const assets = await db.asset.deleteMany({});
  console.log(`  · ${assets.count} assets borrados`);

  // Borrar groups
  const groups = await db.group.deleteMany({});
  console.log(`  · ${groups.count} groups borrados`);

  // Borrar users (todos)
  const users = await db.user.deleteMany({});
  console.log(`  · ${users.count} users borrados`);

  // Borrar accounts (todas)
  const accounts = await db.account.deleteMany({});
  console.log(`  · ${accounts.count} accounts borradas`);

  console.log("");

  // ── 4. Crear el SUPER_ADMIN limpio ──
  console.log("Creando SUPER_ADMIN…");

  const newAdmin = await db.user.create({
    data: {
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      email: ADMIN_EMAIL,
      passwordHash: "supabase-auth-managed", // placeholder · auth real en Supabase
      organizationId: org.id,
      accountId: null, // SA es cross-account
      profileId: superAdminProfile.id,
      status: "ACTIVE",
      language: "es",
      theme: "LIGHT",
    },
  });
  console.log(`  ✓ ${newAdmin.firstName} ${newAdmin.lastName} (${newAdmin.email})`);
  console.log("");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Listo. Estado actual:");
  console.log(`  · 1 Organization (${org.name})`);
  console.log(`  · 4 Profiles del sistema`);
  console.log(`  · 1 User (Alejandro · SUPER_ADMIN)`);
  console.log(`  · 0 Accounts, 0 Assets, 0 Devices`);
  console.log("");
  console.log("Próximos pasos:");
  console.log("  1. Crear el user en Supabase Auth (dashboard o doc)");
  console.log("  2. Linkear ambos · UPDATE \"User\" SET \"supabaseAuthId\"=...");
  console.log("  3. Si querés data de testing, correr seed-flespi-test.ts");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((err) => {
    console.error("");
    console.error(`❌ Error: ${err}`);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
