// ═══════════════════════════════════════════════════════════════
//  force-seed-users.ts · script de recuperación
//  ─────────────────────────────────────────────────────────────
//  Crea los 4 perfiles + 8 usuarios sin depender del seed.ts
//  principal. Idempotente · si los users existen, los upsertea.
//
//  Uso:
//    npx tsx prisma/force-seed-users.ts
//
//  REQUISITOS:
//    · Tablas Profile y User existen (ya hiciste prisma db push)
//    · Existen Organization y los 3 Accounts seedeados
//      (transportes-del-sur, minera-la-cumbre, rappi-cono-sur)
//
//  NO TOCA:
//    Asset, Person, Group, Trip, Event, Alarm, etc.
//    Solo Profile y User.
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DATA_MODULES = [
  "seguimiento",
  "actividad",
  "seguridad",
  "direccion",
] as const;

function dataPerm(read: boolean, write: boolean, scope: "ALL" | "OWN_ACCOUNT") {
  const out: Record<string, { read: boolean; write: boolean; scope: string }> = {};
  for (const m of DATA_MODULES) {
    out[m] = { read, write, scope };
  }
  return out;
}

/**
 * H7a · sub-acciones de catalogos por preset:
 *  - "full" · todo habilitado
 *  - "ca"   · CLIENT_ADMIN típico · crear+editar pero NO eliminar
 *             vehículos/conductores. Sí grupos.
 *  - "none" · todo deshabilitado (read-only)
 */
function catalogosSubPerms(preset: "full" | "ca" | "none") {
  if (preset === "full") {
    return {
      vehiculos: { create: true, update: true, delete: true },
      conductores: { create: true, update: true, delete: true },
      grupos: { create: true, update: true, delete: true },
    };
  }
  if (preset === "ca") {
    return {
      vehiculos: { create: true, update: true, delete: false },
      conductores: { create: true, update: true, delete: false },
      grupos: { create: true, update: true, delete: true },
    };
  }
  return {
    vehiculos: { create: false, update: false, delete: false },
    conductores: { create: false, update: false, delete: false },
    grupos: { create: false, update: false, delete: false },
  };
}

const PERMISSIONS = {
  SUPER_ADMIN: {
    ...dataPerm(true, true, "ALL"),
    catalogos: {
      read: true,
      write: true,
      scope: "ALL",
      ...catalogosSubPerms("full"),
    },
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: true, write: true },
    backoffice_vehiculos: { read: true, write: true },
    backoffice_conductores: { read: true, write: true },
    backoffice_dispositivos: { read: true, write: true },
    backoffice_sims: { read: true, write: true },
    backoffice_instalaciones: { read: true, write: true },
    backoffice_usuarios: { read: true, write: true, scope: "ALL" },
    backoffice_perfiles: { read: true, write: true },
  },
  MAXTRACKER_ADMIN: {
    ...dataPerm(true, true, "ALL"),
    catalogos: {
      read: true,
      write: true,
      scope: "ALL",
      ...catalogosSubPerms("full"),
    },
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: true, write: true },
    backoffice_vehiculos: { read: true, write: true },
    backoffice_conductores: { read: true, write: true },
    backoffice_dispositivos: { read: true, write: true },
    backoffice_sims: { read: true, write: true },
    backoffice_instalaciones: { read: true, write: true },
    backoffice_usuarios: { read: true, write: true, scope: "ALL" },
    backoffice_perfiles: { read: true, write: false },
  },
  CLIENT_ADMIN: {
    ...dataPerm(true, true, "OWN_ACCOUNT"),
    catalogos: {
      read: true,
      write: true,
      scope: "OWN_ACCOUNT",
      ...catalogosSubPerms("ca"),
    },
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: false, write: false },
    backoffice_vehiculos: { read: false, write: false },
    backoffice_conductores: { read: false, write: false },
    backoffice_dispositivos: { read: false, write: false },
    backoffice_sims: { read: false, write: false },
    backoffice_instalaciones: { read: false, write: false },
    backoffice_usuarios: { read: true, write: true, scope: "OWN_ACCOUNT" },
    backoffice_perfiles: { read: false, write: false },
  },
  OPERATOR: {
    ...dataPerm(true, false, "OWN_ACCOUNT"),
    catalogos: {
      read: true,
      write: false,
      scope: "OWN_ACCOUNT",
      ...catalogosSubPerms("none"),
    },
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: false, write: false },
    backoffice_vehiculos: { read: false, write: false },
    backoffice_conductores: { read: false, write: false },
    backoffice_dispositivos: { read: false, write: false },
    backoffice_sims: { read: false, write: false },
    backoffice_instalaciones: { read: false, write: false },
    backoffice_usuarios: { read: false, write: false },
    backoffice_perfiles: { read: false, write: false },
  },
} as const;

const PROFILE_SPECS = [
  {
    systemKey: "SUPER_ADMIN" as const,
    nameLabel: "Super admin",
    description:
      "Acceso completo al sistema · puede gestionar la plataforma entera, incluyendo perfiles y permisos.",
    permissions: PERMISSIONS.SUPER_ADMIN,
  },
  {
    systemKey: "MAXTRACKER_ADMIN" as const,
    nameLabel: "Admin Maxtracker",
    description:
      "Personal interno de Maxtracker · gestiona clientes, dispositivos, líneas SIM. No puede editar perfiles.",
    permissions: PERMISSIONS.MAXTRACKER_ADMIN,
  },
  {
    systemKey: "CLIENT_ADMIN" as const,
    nameLabel: "Admin de cliente",
    description:
      "Administrador de un cliente · puede gestionar la flota, conductores, grupos y operadores de su cliente.",
    permissions: PERMISSIONS.CLIENT_ADMIN,
  },
  {
    systemKey: "OPERATOR" as const,
    nameLabel: "Operador",
    description:
      "Solo lectura · puede ver toda la operación de su cliente pero no modificar datos.",
    permissions: PERMISSIONS.OPERATOR,
  },
];

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("force-seed-users · recuperación de User + Profile");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // ── 0. Verificar que existan Organization y los 3 Accounts ──
  const org = await db.organization.findFirst();
  if (!org) {
    console.error("❌ No hay Organization en la base.");
    console.error("   Corré primero `npm run db:seed` para crear los datos base,");
    console.error("   o verificá que la tabla Organization tenga al menos una fila.");
    process.exit(1);
  }
  console.log(`✓ Organization: ${org.name}`);

  const accounts = await db.account.findMany();
  const transportes = accounts.find((a) => a.slug === "transportes-del-sur");
  const minera = accounts.find((a) => a.slug === "minera-la-cumbre");
  const rappi = accounts.find((a) => a.slug === "rappi-cono-sur");

  if (!transportes || !minera || !rappi) {
    console.error("❌ Faltan accounts seedeados.");
    console.error(`   Encontré: ${accounts.map((a) => a.slug).join(", ") || "(ninguno)"}`);
    console.error(`   Esperaba: transportes-del-sur, minera-la-cumbre, rappi-cono-sur`);
    process.exit(1);
  }
  console.log(`✓ Accounts: ${accounts.length} encontradas`);
  console.log("");

  // ── 1. Profiles · upsert por systemKey ──
  console.log("Creando perfiles…");
  const profilesById: Record<string, { id: string }> = {};
  for (const spec of PROFILE_SPECS) {
    const profile = await db.profile.upsert({
      where: { systemKey: spec.systemKey },
      update: {
        nameLabel: spec.nameLabel,
        description: spec.description,
        permissions: spec.permissions as object,
      },
      create: {
        systemKey: spec.systemKey,
        nameLabel: spec.nameLabel,
        description: spec.description,
        permissions: spec.permissions as object,
        isBuiltin: true,
      },
    });
    profilesById[spec.systemKey] = profile;
    console.log(`  ✓ ${spec.nameLabel}`);
  }
  console.log("");

  // ── 2. Users · upsert por email ──
  const usersSpec = [
    { email: "alejandro@maxtracker.com", firstName: "Alejandro", lastName: "Sánchez", phone: "+54 11 5555-0001", profileKey: "SUPER_ADMIN", accountId: null },
    { email: "carla@maxtracker.com", firstName: "Carla", lastName: "Méndez", phone: "+54 11 5555-0002", profileKey: "MAXTRACKER_ADMIN", accountId: null },
    { email: "marcos@transportes-del-sur.com.ar", firstName: "Marcos", lastName: "Pérez", phone: "+54 11 4444-0001", profileKey: "CLIENT_ADMIN", accountId: transportes.id },
    { email: "sofia@minera-la-cumbre.com.ar", firstName: "Sofía", lastName: "Quintana", phone: "+54 381 4444-0002", profileKey: "CLIENT_ADMIN", accountId: minera.id },
    { email: "diego@rappi-cono-sur.com.ar", firstName: "Diego", lastName: "Romero", phone: "+54 11 4444-0003", profileKey: "CLIENT_ADMIN", accountId: rappi.id },
    { email: "juan@transportes-del-sur.com.ar", firstName: "Juan", lastName: "González", phone: "+54 11 3333-0001", profileKey: "OPERATOR", accountId: transportes.id },
    { email: "lucia@minera-la-cumbre.com.ar", firstName: "Lucía", lastName: "Romero", phone: "+54 381 3333-0002", profileKey: "OPERATOR", accountId: minera.id },
    { email: "pablo@rappi-cono-sur.com.ar", firstName: "Pablo", lastName: "Castro", phone: "+54 11 3333-0003", profileKey: "OPERATOR", accountId: rappi.id },
  ];

  console.log("Creando usuarios…");
  for (const spec of usersSpec) {
    const profileId = profilesById[spec.profileKey].id;
    await db.user.upsert({
      where: { email: spec.email },
      update: {
        firstName: spec.firstName,
        lastName: spec.lastName,
        phone: spec.phone,
        profileId,
        accountId: spec.accountId,
        status: "ACTIVE",
      },
      create: {
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phone: spec.phone,
        passwordHash: `demo:${spec.email}`,
        organizationId: org.id,
        accountId: spec.accountId,
        profileId,
        status: "ACTIVE",
        language: "es-AR",
        theme: "LIGHT",
      },
    });
    console.log(`  ✓ ${spec.firstName} ${spec.lastName} (${spec.profileKey})`);
  }
  console.log("");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Listo · 4 perfiles + 8 usuarios populados");
  console.log("Reiniciá el dev server y refresheá el navegador");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
