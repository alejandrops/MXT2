"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";
import type { ModuleKey, PermissionsMap, Scope } from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════
//  Server actions · update Profile (Backoffice B2)
//  ─────────────────────────────────────────────────────────────
//  Reglas:
//    · Solo SUPER_ADMIN puede modificar perfiles
//      (canWrite("backoffice_perfiles") es true solo para SA)
//    · El perfil SUPER_ADMIN NO se puede editar (perfil sistema ·
//      protección anti-lock-out)
//    · El nameLabel sí se puede editar (display) pero el systemKey
//      es inmutable
//    · Las claves de módulo y scope se validan antes de guardar
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
}

const VALID_MODULE_KEYS: ModuleKey[] = [
  "seguimiento",
  "actividad",
  "seguridad",
  "direccion",
  "catalogos",
  "configuracion",
  "backoffice_clientes",
  "backoffice_dispositivos",
  "backoffice_sims",
  "backoffice_instalaciones",
  "backoffice_usuarios",
  "backoffice_perfiles",
];

const DATA_MODULES: ModuleKey[] = [
  "seguimiento",
  "actividad",
  "seguridad",
  "direccion",
  "catalogos",
];

const VALID_SCOPES: Scope[] = ["ALL", "OWN_ACCOUNT"];

export interface UpdateProfileInput {
  nameLabel: string;
  permissions: PermissionsMap;
}

/**
 * Sanitiza la PermissionsMap entrante:
 *  - elimina claves desconocidas
 *  - garantiza shape correcto por módulo (read, write, scope opcional)
 *  - para módulos data, scope obligatorio (ALL o OWN_ACCOUNT)
 *  - para módulos no-data, scope se omite
 *  - write requiere read (no se puede tener escritura sin lectura)
 */
function sanitizePermissions(input: unknown): {
  ok: boolean;
  message?: string;
  permissions?: PermissionsMap;
} {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Permisos inválidos" };
  }
  const inMap = input as Record<string, unknown>;
  const out: Partial<PermissionsMap> = {};

  for (const moduleKey of VALID_MODULE_KEYS) {
    const raw = inMap[moduleKey];
    if (!raw || typeof raw !== "object") {
      // Si falta una entrada, asumimos sin acceso · {read:false, write:false}
      if (moduleKey === "catalogos") {
        out[moduleKey] = {
          read: false,
          write: false,
          scope: "OWN_ACCOUNT",
          vehiculos: { create: false, update: false, delete: false },
          conductores: { create: false, update: false, delete: false },
          grupos: { create: false, update: false, delete: false },
        };
      } else if (DATA_MODULES.includes(moduleKey)) {
        out[moduleKey] = { read: false, write: false, scope: "OWN_ACCOUNT" };
      } else {
        out[moduleKey] = { read: false, write: false };
      }
      continue;
    }
    const r = raw as Record<string, unknown>;
    const read = r.read === true;
    const write = r.write === true;
    if (write && !read) {
      return {
        ok: false,
        message: `Inconsistencia · "${moduleKey}" tiene escritura sin lectura`,
      };
    }
    if (DATA_MODULES.includes(moduleKey)) {
      const scope = r.scope;
      if (typeof scope !== "string" || !VALID_SCOPES.includes(scope as Scope)) {
        return {
          ok: false,
          message: `Scope inválido en "${moduleKey}"`,
        };
      }

      // Para catalogos, también sanitizar sub-acciones por entidad
      if (moduleKey === "catalogos") {
        const entities = ["vehiculos", "conductores", "grupos"] as const;
        const subPerms: Record<string, { create: boolean; update: boolean; delete: boolean }> = {};
        for (const e of entities) {
          const eRaw = r[e];
          if (eRaw && typeof eRaw === "object") {
            const eObj = eRaw as Record<string, unknown>;
            subPerms[e] = {
              create: eObj.create === true,
              update: eObj.update === true,
              delete: eObj.delete === true,
            };
          } else {
            subPerms[e] = { create: false, update: false, delete: false };
          }
          // Si write=false, forzar todas las sub-acciones a false
          if (!write) {
            subPerms[e] = { create: false, update: false, delete: false };
          }
        }
        out[moduleKey] = {
          read,
          write,
          scope: scope as Scope,
          vehiculos: subPerms.vehiculos,
          conductores: subPerms.conductores,
          grupos: subPerms.grupos,
        };
      } else {
        out[moduleKey] = { read, write, scope: scope as Scope };
      }
    } else {
      out[moduleKey] = { read, write };
    }
  }

  return { ok: true, permissions: out as PermissionsMap };
}

export async function updateProfile(
  profileId: string,
  input: UpdateProfileInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_perfiles")) {
    return { ok: false, message: "No tenés permiso para editar perfiles." };
  }

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, systemKey: true },
  });
  if (!profile) return { ok: false, message: "Perfil no encontrado." };

  // Anti-lock-out · el perfil SUPER_ADMIN nunca se modifica desde la UI
  if (profile.systemKey === "SUPER_ADMIN") {
    return {
      ok: false,
      message: "El perfil Super admin es del sistema · no se puede modificar.",
    };
  }

  const nameLabel = (input.nameLabel ?? "").trim();
  if (nameLabel.length === 0) {
    return { ok: false, errors: { nameLabel: "Requerido" } };
  }
  if (nameLabel.length > 60) {
    return { ok: false, errors: { nameLabel: "Máximo 60 caracteres" } };
  }

  const sanitized = sanitizePermissions(input.permissions);
  if (!sanitized.ok || !sanitized.permissions) {
    return { ok: false, message: sanitized.message ?? "Permisos inválidos" };
  }

  await db.profile.update({
    where: { id: profileId },
    data: {
      nameLabel,
      // Cast a unknown · Prisma Json recibe cualquier objeto serializable
      permissions: sanitized.permissions as unknown as object,
    },
  });

  revalidatePath("/admin/perfiles");
  // El sidebar de los usuarios afectados también puede haber cambiado
  revalidatePath("/", "layout");

  return { ok: true, message: "Perfil actualizado" };
}
