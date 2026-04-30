// ═══════════════════════════════════════════════════════════════
//  Permissions · helpers para evaluar acceso por módulo y entidad
//  ─────────────────────────────────────────────────────────────
//  Nivel 1 · MÓDULO. Un permiso por módulo con read/write/scope.
//    canRead(session, "catalogos")
//    canWrite(session, "catalogos")
//    getScopedAccountIds(session, "catalogos")
//
//  Nivel 2 · ENTIDAD (H7a). Para módulos que manejan varias
//  entidades (hoy solo "catalogos" con vehiculos/conductores/
//  grupos), permisos granulares por acción:
//    canCreateEntity(session, "catalogos", "vehiculos")
//    canUpdateEntity(session, "catalogos", "vehiculos")
//    canDeleteEntity(session, "catalogos", "vehiculos")
//
//  Diseño: nivel 2 es ADITIVO. Las pantallas viejas siguen
//  usando canWrite() y todo sigue funcionando. Las pantallas
//  que necesitan granularidad migran a canCreate/canUpdate/
//  canDelete por entidad.
//
//  Backwards-compat:
//    canWrite(session, "catalogos") devuelve true si CUALQUIER
//    sub-acción de la entidad está habilitada. Esto preserva
//    el comportamiento existente · si en el JSON no hay sub-
//    permisos definidos, fallback al boolean write top-level.
// ═══════════════════════════════════════════════════════════════

import type { SessionData } from "@/lib/session";

export type ModuleKey =
  | "seguimiento"
  | "actividad"
  | "seguridad"
  | "direccion"
  | "catalogos"
  | "configuracion"
  | "backoffice_clientes"
  | "backoffice_vehiculos"
  | "backoffice_conductores"
  | "backoffice_dispositivos"
  | "backoffice_sims"
  | "backoffice_instalaciones"
  | "backoffice_usuarios"
  | "backoffice_perfiles";

export type Scope = "ALL" | "OWN_ACCOUNT";

/** Entidades del módulo catalogos · cada una con sus sub-acciones */
export type CatalogosEntity = "vehiculos" | "conductores" | "grupos";

export const CATALOGOS_ENTITIES: CatalogosEntity[] = [
  "vehiculos",
  "conductores",
  "grupos",
];

export interface EntityActions {
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface Permission {
  read: boolean;
  write: boolean;
  /** Solo aplica para módulos data-driven */
  scope?: Scope;
  /** Solo en "catalogos" · sub-acciones por entidad */
  vehiculos?: EntityActions;
  conductores?: EntityActions;
  grupos?: EntityActions;
}

export type PermissionsMap = Record<ModuleKey, Permission>;

// ═══════════════════════════════════════════════════════════════
//  Profile keys · matchea enum ProfileKey en schema.prisma
// ═══════════════════════════════════════════════════════════════

export type ProfileKeyTs =
  | "SUPER_ADMIN"
  | "MAXTRACKER_ADMIN"
  | "CLIENT_ADMIN"
  | "OPERATOR";

export const PROFILE_LABEL: Record<ProfileKeyTs, string> = {
  SUPER_ADMIN: "Super admin",
  MAXTRACKER_ADMIN: "Admin Maxtracker",
  CLIENT_ADMIN: "Admin de cliente",
  OPERATOR: "Operador",
};

// ═══════════════════════════════════════════════════════════════
//  DEFAULT_PERMISSIONS · semilla de los 4 perfiles builtin
// ═══════════════════════════════════════════════════════════════

const DATA_MODULES: ModuleKey[] = [
  "seguimiento",
  "actividad",
  "seguridad",
  "direccion",
  "catalogos",
];

function dataModulesPerm(
  read: boolean,
  write: boolean,
  scope: Scope,
): Partial<PermissionsMap> {
  const out: Partial<PermissionsMap> = {};
  for (const m of DATA_MODULES) {
    out[m] = { read, write, scope };
  }
  return out;
}

/**
 * Sub-permisos de catalogos por nivel:
 *  - "full"  · todo habilitado
 *  - "ca"    · CLIENT_ADMIN típico · crear+editar pero NO eliminar
 *              vehículos/conductores. Sí eliminar grupos (decisión
 *              organizativa del cliente).
 *  - "none"  · todo deshabilitado
 */
function catalogosSubPerms(
  preset: "full" | "ca" | "none",
): Pick<Permission, "vehiculos" | "conductores" | "grupos"> {
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

export const DEFAULT_PERMISSIONS: Record<ProfileKeyTs, PermissionsMap> = {
  SUPER_ADMIN: {
    ...(dataModulesPerm(true, true, "ALL") as PermissionsMap),
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
    ...(dataModulesPerm(true, true, "ALL") as PermissionsMap),
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
    ...(dataModulesPerm(true, true, "OWN_ACCOUNT") as PermissionsMap),
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
    ...(dataModulesPerm(true, false, "OWN_ACCOUNT") as PermissionsMap),
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
};

// ═══════════════════════════════════════════════════════════════
//  Helpers · operan sobre SessionData (que trae profile.permissions)
// ═══════════════════════════════════════════════════════════════

function getPerm(
  session: SessionData,
  module: ModuleKey,
): Permission | undefined {
  const map = session.profile.permissions as unknown as PermissionsMap;
  return map?.[module];
}

export function canRead(session: SessionData, module: ModuleKey): boolean {
  return getPerm(session, module)?.read === true;
}

/**
 * canWrite con backwards-compat:
 *
 * Para módulos sin sub-entidades, evalúa el flag `write` directo.
 *
 * Para "catalogos" (que tiene sub-entidades), devuelve true si:
 *   - El gate `write` está activo Y
 *   - Cualquier sub-acción de cualquier entidad está activa
 *
 * Esto preserva el comportamiento de las pantallas legacy que
 * usan canWrite("catalogos") como gate genérico.
 */
export function canWrite(session: SessionData, module: ModuleKey): boolean {
  const perm = getPerm(session, module);
  if (!perm) return false;
  if (perm.write !== true) return false;

  // Para módulo catalogos · check sub-acciones para honrar
  // configuraciones más restrictivas
  if (module === "catalogos") {
    const entities: CatalogosEntity[] = ["vehiculos", "conductores", "grupos"];
    for (const e of entities) {
      const acts = perm[e];
      if (acts && (acts.create || acts.update || acts.delete)) return true;
    }
    // Si no hay sub-permisos definidos (perfiles legacy), respetamos
    // el gate write top-level
    if (
      perm.vehiculos === undefined &&
      perm.conductores === undefined &&
      perm.grupos === undefined
    ) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Devuelve los accountIds que el usuario puede ver en este módulo.
 *  - null  → no filtrar (scope ALL · ve todo)
 *  - []    → no ve nada
 *  - [id]  → solo ve los registros de este account
 */
export function getScopedAccountIds(
  session: SessionData,
  module: ModuleKey,
): string[] | null {
  const perm = getPerm(session, module);
  if (!perm || !perm.read) return [];
  if (perm.scope === "ALL" || perm.scope === undefined) return null;
  if (perm.scope === "OWN_ACCOUNT") {
    return session.user.accountId ? [session.user.accountId] : [];
  }
  return [];
}

export function isCrossAccount(session: SessionData): boolean {
  return session.user.accountId === null;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers granulares por entidad (H7a)
//  ─────────────────────────────────────────────────────────────
//  Aplican solo cuando module="catalogos" · los otros módulos
//  no tienen sub-entidades hoy.
//
//  Patrón:
//    if (canCreateEntity(session, "catalogos", "vehiculos")) {
//      // mostrar botón "+ Nuevo vehículo"
//    }
// ═══════════════════════════════════════════════════════════════

function getEntityActions(
  session: SessionData,
  module: ModuleKey,
  entity: CatalogosEntity,
): EntityActions | null {
  const perm = getPerm(session, module);
  if (!perm || !perm.write) return null;
  const actions = perm[entity];
  if (!actions) {
    // Backwards-compat · perfiles legacy sin sub-permisos
    // Si write=true y no hay sub-permisos, asumimos full access
    return { create: true, update: true, delete: true };
  }
  return actions;
}

export function canCreateEntity(
  session: SessionData,
  module: ModuleKey,
  entity: CatalogosEntity,
): boolean {
  return getEntityActions(session, module, entity)?.create === true;
}

export function canUpdateEntity(
  session: SessionData,
  module: ModuleKey,
  entity: CatalogosEntity,
): boolean {
  return getEntityActions(session, module, entity)?.update === true;
}

export function canDeleteEntity(
  session: SessionData,
  module: ModuleKey,
  entity: CatalogosEntity,
): boolean {
  return getEntityActions(session, module, entity)?.delete === true;
}
