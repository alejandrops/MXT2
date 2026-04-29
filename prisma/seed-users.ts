// ═══════════════════════════════════════════════════════════════
//  Seed users & profiles · Lote F1
//  ─────────────────────────────────────────────────────────────
//  Crea los 4 perfiles builtin + 8 usuarios demo cubriendo todos
//  los casos del switcher de identidad:
//    · 1 Super admin
//    · 1 Admin Maxtracker
//    · 3 Admin Cliente (uno por cada Account seedeado)
//    · 3 Operadores (uno por cada Account seedeado)
//
//  Se invoca desde prisma/seed.ts después de que existen
//  Organization y los 3 Accounts.
//
//  passwordHash: dummy "demo:<userId>" · NUNCA usar en producción.
//  Auth real con Auth0 reemplaza este flujo en v1.1+.
// ═══════════════════════════════════════════════════════════════

import type { PrismaClient } from "@prisma/client";

// Las 4 plantillas de permisos · esto duplica DEFAULT_PERMISSIONS
// de src/lib/permissions.ts pero el seed corre fuera del bundle
// de Next así que mejor inline para evitar resolución de @ paths.
const DATA_MODULES = [
  "seguimiento",
  "actividad",
  "seguridad",
  "direccion",
  "catalogos",
] as const;

function dataPerm(read: boolean, write: boolean, scope: "ALL" | "OWN_ACCOUNT") {
  const out: Record<string, { read: boolean; write: boolean; scope: string }> = {};
  for (const m of DATA_MODULES) {
    out[m] = { read, write, scope };
  }
  return out;
}

const PERMISSIONS = {
  SUPER_ADMIN: {
    ...dataPerm(true, true, "ALL"),
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: true, write: true },
    backoffice_dispositivos: { read: true, write: true },
    backoffice_sims: { read: true, write: true },
    backoffice_instalaciones: { read: true, write: true },
    backoffice_usuarios: { read: true, write: true, scope: "ALL" },
    backoffice_perfiles: { read: true, write: true },
  },
  MAXTRACKER_ADMIN: {
    ...dataPerm(true, true, "ALL"),
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: true, write: true },
    backoffice_dispositivos: { read: true, write: true },
    backoffice_sims: { read: true, write: true },
    backoffice_instalaciones: { read: true, write: true },
    backoffice_usuarios: { read: true, write: true, scope: "ALL" },
    backoffice_perfiles: { read: true, write: false },
  },
  CLIENT_ADMIN: {
    ...dataPerm(true, true, "OWN_ACCOUNT"),
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: false, write: false },
    backoffice_dispositivos: { read: false, write: false },
    backoffice_sims: { read: false, write: false },
    backoffice_instalaciones: { read: false, write: false },
    backoffice_usuarios: { read: true, write: true, scope: "OWN_ACCOUNT" },
    backoffice_perfiles: { read: false, write: false },
  },
  OPERATOR: {
    ...dataPerm(true, false, "OWN_ACCOUNT"),
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: false, write: false },
    backoffice_dispositivos: { read: false, write: false },
    backoffice_sims: { read: false, write: false },
    backoffice_instalaciones: { read: false, write: false },
    backoffice_usuarios: { read: false, write: false },
    backoffice_perfiles: { read: false, write: false },
  },
} as const;

// ═══════════════════════════════════════════════════════════════
//  Seed
// ═══════════════════════════════════════════════════════════════

export async function seedUsersAndProfiles(db: PrismaClient): Promise<void> {
  // Borrar lo previo (idempotente · permite re-seedear)
  await db.user.deleteMany();
  await db.profile.deleteMany();

  // ── 1. Profiles ──────────────────────────────────────────
  const profileSuperAdmin = await db.profile.create({
    data: {
      systemKey: "SUPER_ADMIN",
      nameLabel: "Super admin",
      description:
        "Acceso completo al sistema · puede gestionar la plataforma entera, incluyendo perfiles y permisos.",
      permissions: PERMISSIONS.SUPER_ADMIN,
      isBuiltin: true,
    },
  });

  const profileMaxtrackerAdmin = await db.profile.create({
    data: {
      systemKey: "MAXTRACKER_ADMIN",
      nameLabel: "Admin Maxtracker",
      description:
        "Personal interno de Maxtracker · gestiona clientes, dispositivos, líneas SIM. No puede editar perfiles.",
      permissions: PERMISSIONS.MAXTRACKER_ADMIN,
      isBuiltin: true,
    },
  });

  const profileClientAdmin = await db.profile.create({
    data: {
      systemKey: "CLIENT_ADMIN",
      nameLabel: "Admin de cliente",
      description:
        "Administrador de un cliente · puede gestionar la flota, conductores, grupos y operadores de su cliente.",
      permissions: PERMISSIONS.CLIENT_ADMIN,
      isBuiltin: true,
    },
  });

  const profileOperator = await db.profile.create({
    data: {
      systemKey: "OPERATOR",
      nameLabel: "Operador",
      description:
        "Solo lectura · puede ver toda la operación de su cliente pero no modificar datos.",
      permissions: PERMISSIONS.OPERATOR,
      isBuiltin: true,
    },
  });

  console.log("   ✓ 4 perfiles creados");

  // ── 2. Resolver Organization y Accounts (ya existen) ─────
  const org = await db.organization.findFirst();
  if (!org) {
    throw new Error("seedUsersAndProfiles: no hay Organization · corré antes el seed principal");
  }

  const accounts = await db.account.findMany();
  const transportes = accounts.find((a) => a.slug === "transportes-del-sur");
  const minera = accounts.find((a) => a.slug === "minera-la-cumbre");
  const rappi = accounts.find((a) => a.slug === "rappi-cono-sur");

  if (!transportes || !minera || !rappi) {
    throw new Error(
      `seedUsersAndProfiles: faltan accounts · corré antes el seed principal. Encontré ${accounts.map((a) => a.slug).join(", ")}`,
    );
  }

  // ── 3. Users ─────────────────────────────────────────────
  const usersSpec = [
    // Super admin
    {
      email: "alejandro@maxtracker.com",
      firstName: "Alejandro",
      lastName: "Sánchez",
      phone: "+54 11 5555-0001",
      profileId: profileSuperAdmin.id,
      accountId: null,
    },
    // Admin Maxtracker
    {
      email: "carla@maxtracker.com",
      firstName: "Carla",
      lastName: "Méndez",
      phone: "+54 11 5555-0002",
      profileId: profileMaxtrackerAdmin.id,
      accountId: null,
    },
    // Admin Cliente · uno por cada cliente
    {
      email: "marcos@transportes-del-sur.com.ar",
      firstName: "Marcos",
      lastName: "Pérez",
      phone: "+54 11 4444-0001",
      profileId: profileClientAdmin.id,
      accountId: transportes.id,
    },
    {
      email: "sofia@minera-la-cumbre.com.ar",
      firstName: "Sofía",
      lastName: "Quintana",
      phone: "+54 381 4444-0002",
      profileId: profileClientAdmin.id,
      accountId: minera.id,
    },
    {
      email: "diego@rappi-cono-sur.com.ar",
      firstName: "Diego",
      lastName: "Romero",
      phone: "+54 11 4444-0003",
      profileId: profileClientAdmin.id,
      accountId: rappi.id,
    },
    // Operadores · uno por cada cliente
    {
      email: "juan@transportes-del-sur.com.ar",
      firstName: "Juan",
      lastName: "González",
      phone: "+54 11 3333-0001",
      profileId: profileOperator.id,
      accountId: transportes.id,
    },
    {
      email: "lucia@minera-la-cumbre.com.ar",
      firstName: "Lucía",
      lastName: "Romero",
      phone: "+54 381 3333-0002",
      profileId: profileOperator.id,
      accountId: minera.id,
    },
    {
      email: "pablo@rappi-cono-sur.com.ar",
      firstName: "Pablo",
      lastName: "Castro",
      phone: "+54 11 3333-0003",
      profileId: profileOperator.id,
      accountId: rappi.id,
    },
  ];

  for (const spec of usersSpec) {
    await db.user.create({
      data: {
        ...spec,
        passwordHash: `demo:${spec.email}`,
        organizationId: org.id,
        status: "ACTIVE",
        language: "es-AR",
        theme: "LIGHT",
      },
    });
  }

  console.log(`   ✓ ${usersSpec.length} usuarios creados (1 SA · 1 MA · 3 CA · 3 OP)`);
}
