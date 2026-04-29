// ═══════════════════════════════════════════════════════════════
//  Permissions · helpers para evaluar acceso por módulo
//  ─────────────────────────────────────────────────────────────
//  La forma de los permisos vive en el JSON `Profile.permissions`
//  pero el TYPE ESTÁ ACÁ. Cuando el seed crea los 4 perfiles
//  builtin, copia DEFAULT_PERMISSIONS[key].
//
//  Patrón de uso:
//    import { getSession } from "@/lib/session";
//    import { canWrite, getScopedAccountIds } from "@/lib/permissions";
//
//    const session = await getSession();
//    if (!canWrite(session, "catalogos")) {
//      // ocultar botón "+ Nuevo"
//    }
//    const ids = getScopedAccountIds(session, "catalogos");
//    const where = ids === null ? {} : { accountId: { in: ids } };
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
  | "backoffice_dispositivos"
  | "backoffice_sims"
  | "backoffice_instalaciones"
  | "backoffice_usuarios"
  | "backoffice_perfiles";

export type Scope = "ALL" | "OWN_ACCOUNT";

export interface Permission {
  read: boolean;
  write: boolean;
  /** Solo aplica para módulos data-driven. Modulos del backoffice
   *  como Clientes / Dispositivos no tienen scope (son globales). */
  scope?: Scope;
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

export const DEFAULT_PERMISSIONS: Record<ProfileKeyTs, PermissionsMap> = {
  SUPER_ADMIN: {
    ...(dataModulesPerm(true, true, "ALL") as PermissionsMap),
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: true, write: true },
    backoffice_dispositivos: { read: true, write: true },
    backoffice_sims: { read: true, write: true },
    backoffice_instalaciones: { read: true, write: true },
    backoffice_usuarios: { read: true, write: true, scope: "ALL" },
    backoffice_perfiles: { read: true, write: true },
  },
  MAXTRACKER_ADMIN: {
    ...(dataModulesPerm(true, true, "ALL") as PermissionsMap),
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: true, write: true },
    backoffice_dispositivos: { read: true, write: true },
    backoffice_sims: { read: true, write: true },
    backoffice_instalaciones: { read: true, write: true },
    backoffice_usuarios: { read: true, write: true, scope: "ALL" },
    /// MA puede ver perfiles pero no editarlos
    backoffice_perfiles: { read: true, write: false },
  },
  CLIENT_ADMIN: {
    ...(dataModulesPerm(true, true, "OWN_ACCOUNT") as PermissionsMap),
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: false, write: false },
    backoffice_dispositivos: { read: false, write: false },
    backoffice_sims: { read: false, write: false },
    backoffice_instalaciones: { read: false, write: false },
    /// CA gestiona OPERATORS de su account
    backoffice_usuarios: { read: true, write: true, scope: "OWN_ACCOUNT" },
    backoffice_perfiles: { read: false, write: false },
  },
  OPERATOR: {
    ...(dataModulesPerm(true, false, "OWN_ACCOUNT") as PermissionsMap),
    configuracion: { read: true, write: true },
    backoffice_clientes: { read: false, write: false },
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
  // permissions viene como Json del DB · cast a PermissionsMap
  const map = session.profile.permissions as unknown as PermissionsMap;
  return map?.[module];
}

export function canRead(session: SessionData, module: ModuleKey): boolean {
  return getPerm(session, module)?.read === true;
}

export function canWrite(session: SessionData, module: ModuleKey): boolean {
  return getPerm(session, module)?.write === true;
}

/**
 * Devuelve los accountIds que el usuario puede ver en este módulo.
 *  - null  → no filtrar (scope ALL · ve todo)
 *  - []    → no ve nada (sin permiso o scope=OWN_ACCOUNT pero
 *            el user no tiene accountId)
 *  - [id]  → solo ve los registros de este account
 *
 * Cuando es null, las queries deben hacer findMany sin filtro de
 * accountId. Cuando es array, usar where: { accountId: { in: ids } }.
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

/**
 * Atajo · el usuario es global (puede operar entre clientes)?
 * True para Super admin y Admin Maxtracker.
 */
export function isCrossAccount(session: SessionData): boolean {
  return session.user.accountId === null;
}
